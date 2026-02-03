/**
 * Browser Pool Manager
 *
 * Manages a pool of Playwright browser instances for efficient scraping.
 * Features:
 * - Browser instance pooling and reuse
 * - Automatic cleanup of idle browsers
 * - Context management for isolation
 * - Concurrent scraping support
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { SCRAPING_CONFIG } from '../config';
import { BrowserPoolStats } from '../types';

interface PooledBrowser {
  browser: Browser;
  contexts: Set<BrowserContext>;
  lastUsed: number;
  inUse: boolean;
  id: string;
}

export class BrowserPool {
  private browsers: Map<string, PooledBrowser> = new Map();
  private isInitialized = false;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private browserIdCounter = 0;

  /**
   * Initialize the browser pool
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Start cleanup interval for idle browsers
    this.cleanupInterval = setInterval(
      () => this.cleanupIdleBrowsers(),
      SCRAPING_CONFIG.pool.browserIdleTimeout / 2
    );

    this.isInitialized = true;
    console.log('🌐 Browser pool initialized');
  }

  /**
   * Acquire a browser from the pool
   */
  async acquireBrowser(): Promise<Browser> {
    await this.initialize();

    // Find an available browser
    for (const pooled of Array.from(this.browsers.values())) {
      if (!pooled.inUse) {
        pooled.inUse = true;
        pooled.lastUsed = Date.now();
        console.log(`🔄 Reusing browser ${pooled.id}`);
        return pooled.browser;
      }
    }

    // Check if we can create a new browser
    if (this.browsers.size < SCRAPING_CONFIG.pool.maxBrowsers) {
      const browser = await this.createBrowser();
      return browser;
    }

    // Wait for an available browser
    console.log('⏳ Waiting for available browser...');
    return this.waitForAvailableBrowser();
  }

  /**
   * Create a new browser context
   */
  async acquireContext(browser: Browser): Promise<BrowserContext> {
    const context = await browser.newContext({
      userAgent: SCRAPING_CONFIG.browser.userAgent,
      viewport: SCRAPING_CONFIG.browser.viewport,
      locale: SCRAPING_CONFIG.browser.locale,
      // Disable images to speed up scraping
      // bypassCSP: true,
    });

    // Track the context
    const pooled = this.findPooledBrowser(browser);
    if (pooled) {
      pooled.contexts.add(context);
    }

    return context;
  }

  /**
   * Create a new page in the context
   */
  async acquirePage(context: BrowserContext): Promise<Page> {
    const page = await context.newPage();
    page.setDefaultTimeout(SCRAPING_CONFIG.browser.timeout);

    // Block unnecessary resources to speed up scraping
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      // Block fonts and media to speed up loading
      if (['font', 'media'].includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    return page;
  }

  /**
   * Release a browser back to the pool
   */
  releaseBrowser(browser: Browser): void {
    const pooled = this.findPooledBrowser(browser);
    if (pooled) {
      pooled.inUse = false;
      pooled.lastUsed = Date.now();
      console.log(`✅ Released browser ${pooled.id}`);
    }
  }

  /**
   * Release and close a context
   */
  async releaseContext(context: BrowserContext): Promise<void> {
    for (const pooled of Array.from(this.browsers.values())) {
      if (pooled.contexts.has(context)) {
        pooled.contexts.delete(context);
        await context.close().catch(() => {});
        return;
      }
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): BrowserPoolStats {
    let busyBrowsers = 0;
    for (const pooled of Array.from(this.browsers.values())) {
      if (pooled.inUse) busyBrowsers++;
    }

    return {
      activeBrowsers: this.browsers.size,
      maxBrowsers: SCRAPING_CONFIG.pool.maxBrowsers,
      busyBrowsers,
      availableBrowsers: this.browsers.size - busyBrowsers,
    };
  }

  /**
   * Cleanup all browsers and shutdown the pool
   */
  async cleanup(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    for (const [id, pooled] of Array.from(this.browsers.entries())) {
      // Close all contexts
      for (const context of Array.from(pooled.contexts)) {
        await context.close().catch(() => {});
      }
      // Close browser
      await pooled.browser.close().catch(() => {});
      console.log(`🧹 Closed browser ${id}`);
    }

    this.browsers.clear();
    this.isInitialized = false;
    console.log('🔒 Browser pool shutdown complete');
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async createBrowser(): Promise<Browser> {
    const browser = await chromium.launch({
      headless: SCRAPING_CONFIG.browser.headless,
    });

    const id = `browser-${++this.browserIdCounter}`;
    const pooled: PooledBrowser = {
      browser,
      contexts: new Set(),
      lastUsed: Date.now(),
      inUse: true,
      id,
    };

    this.browsers.set(id, pooled);
    console.log(`🚀 Created new browser ${id} (total: ${this.browsers.size})`);

    // Handle browser disconnect
    browser.on('disconnected', () => {
      this.browsers.delete(id);
      console.log(`❌ Browser ${id} disconnected`);
    });

    return browser;
  }

  private findPooledBrowser(browser: Browser): PooledBrowser | undefined {
    for (const pooled of Array.from(this.browsers.values())) {
      if (pooled.browser === browser) {
        return pooled;
      }
    }
    return undefined;
  }

  private async waitForAvailableBrowser(): Promise<Browser> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        for (const pooled of Array.from(this.browsers.values())) {
          if (!pooled.inUse) {
            clearInterval(checkInterval);
            pooled.inUse = true;
            pooled.lastUsed = Date.now();
            resolve(pooled.browser);
            return;
          }
        }
      }, 100);

      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        // Force create a browser if waiting too long
        this.createBrowser().then(resolve);
      }, 30000);
    });
  }

  private async cleanupIdleBrowsers(): Promise<void> {
    const now = Date.now();
    const idleTimeout = SCRAPING_CONFIG.pool.browserIdleTimeout;

    for (const [id, pooled] of Array.from(this.browsers.entries())) {
      // Don't close browsers that are in use
      if (pooled.inUse) continue;

      // Close idle browsers (keep at least one)
      if (now - pooled.lastUsed > idleTimeout && this.browsers.size > 1) {
        for (const context of Array.from(pooled.contexts)) {
          await context.close().catch(() => {});
        }
        await pooled.browser.close().catch(() => {});
        this.browsers.delete(id);
        console.log(`🧹 Cleaned up idle browser ${id}`);
      }
    }
  }
}

// Singleton instance
export const browserPool = new BrowserPool();
