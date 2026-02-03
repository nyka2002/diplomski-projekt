/**
 * Base Scraper Abstract Class
 *
 * Template method pattern for web scrapers.
 * Subclasses implement site-specific logic while this class handles:
 * - Browser management
 * - Rate limiting
 * - Retry logic
 * - Error collection
 * - Database persistence
 */

import { Page, BrowserContext, Browser } from 'playwright';
import { browserPool } from '../browser';
import { RateLimiter } from './rate-limiter';
import { RetryHandler } from './retry-handler';
import {
  ScraperConfig,
  RawListingData,
  ScrapeResult,
  ScrapeError,
  ScrapeErrorCode,
  ListingPageData,
  PaginationInfo,
} from '../types';
import { NormalizedListing } from '@/types/listing';
import { insertListing } from '@/lib/db-helpers';
import { SCRAPING_CONFIG } from '../config';

export abstract class BaseScraper {
  protected config: ScraperConfig;
  protected rateLimiter: RateLimiter;
  protected retryHandler: RetryHandler;
  protected errors: ScrapeError[] = [];

  constructor(config: ScraperConfig) {
    this.config = {
      ...config,
      maxPages: config.maxPages ?? SCRAPING_CONFIG.defaults.maxPages,
      timeout: config.timeout ?? SCRAPING_CONFIG.browser.timeout,
    };
    this.rateLimiter = new RateLimiter();
    this.retryHandler = new RetryHandler();
  }

  // ============================================================================
  // ABSTRACT METHODS - Must be implemented by subclasses
  // ============================================================================

  /**
   * Get the URL for a specific page of listings
   */
  abstract getListingPageUrl(page: number): string;

  /**
   * Parse a listing page and extract raw listing data
   */
  abstract parseListingPage(page: Page): Promise<ListingPageData>;

  /**
   * Parse a detail page for a single listing
   */
  abstract parseDetailPage(page: Page, url: string): Promise<RawListingData | null>;

  /**
   * Get pagination information from the current page
   */
  abstract getPagination(page: Page): Promise<PaginationInfo>;

  /**
   * Normalize raw scraped data to the standard listing format
   */
  protected abstract normalizeRawData(raw: RawListingData): NormalizedListing;

  // ============================================================================
  // MAIN SCRAPE METHOD
  // ============================================================================

  /**
   * Execute the scraping operation
   */
  async scrape(): Promise<ScrapeResult> {
    const startTime = Date.now();
    let listingsScraped = 0;
    let listingsSaved = 0;
    let listingsDuplicate = 0;
    this.errors = [];
    this.rateLimiter.reset();

    let browser: Browser | null = null;
    let context: BrowserContext | null = null;

    try {
      console.log(`🕷️  Starting scrape: ${this.config.source} (${this.config.listingType} ${this.config.propertyType})`);

      browser = await browserPool.acquireBrowser();
      context = await browserPool.acquireContext(browser);

      let currentPage = 1;
      let hasMorePages = true;
      const maxPages = this.config.maxPages!;

      while (hasMorePages && currentPage <= maxPages) {
        const pageUrl = this.getListingPageUrl(currentPage);
        console.log(`📄 Scraping page ${currentPage}/${maxPages}: ${pageUrl}`);

        try {
          await this.rateLimiter.throttle();

          const page = await browserPool.acquirePage(context);

          try {
            // Navigate and parse listing page
            const pageData = await this.retryHandler.withRetry(async () => {
              await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
              return this.parseListingPage(page);
            }, `Page ${currentPage}`);

            console.log(`   Found ${pageData.listings.length} listings on page ${currentPage}`);

            // Process each listing
            for (const rawListing of pageData.listings) {
              try {
                const result = await this.processListing(rawListing);
                listingsScraped++;

                if (result === 'saved') {
                  listingsSaved++;
                } else if (result === 'duplicate') {
                  listingsDuplicate++;
                }
              } catch (error) {
                this.addError(rawListing.url, error as Error, 'NORMALIZATION_ERROR');
              }
            }

            // Check for next page
            const pagination = await this.getPagination(page);
            hasMorePages = pagination.hasNextPage;
            currentPage++;
          } finally {
            await page.close();
          }
        } catch (error) {
          this.addError(pageUrl, error as Error, this.retryHandler.getErrorCode(error));
          // Continue to next page on error
          currentPage++;
        }
      }

      console.log(`✅ Scrape complete: ${listingsSaved} saved, ${listingsDuplicate} duplicates, ${this.errors.length} errors`);
    } catch (error) {
      this.addError(undefined, error as Error, 'UNKNOWN');
      console.error(`❌ Scrape failed: ${(error as Error).message}`);
    } finally {
      if (context) await browserPool.releaseContext(context);
      if (browser) browserPool.releaseBrowser(browser);
    }

    return {
      success: this.errors.length === 0,
      source: this.config.source,
      listingsScraped,
      listingsSaved,
      listingsDuplicate,
      errors: this.errors,
      duration: Date.now() - startTime,
      startedAt: new Date(startTime),
      completedAt: new Date(),
    };
  }

  // ============================================================================
  // PROTECTED HELPER METHODS
  // ============================================================================

  /**
   * Process a single listing - normalize and save
   */
  protected async processListing(
    raw: RawListingData
  ): Promise<'saved' | 'duplicate' | 'error'> {
    try {
      const normalized = this.normalizeRawData(raw);
      const saved = await insertListing(normalized);

      if (saved) {
        return 'saved';
      } else {
        return 'duplicate';
      }
    } catch (error) {
      const errorMessage = (error as Error).message;

      // Check for duplicate constraint error
      if (errorMessage.includes('duplicate') || errorMessage.includes('23505')) {
        return 'duplicate';
      }

      throw error;
    }
  }

  /**
   * Add an error to the error collection
   */
  protected addError(
    url: string | undefined,
    error: Error,
    code: ScrapeErrorCode = 'UNKNOWN'
  ): void {
    this.errors.push({
      url,
      message: error.message,
      code,
      timestamp: new Date(),
    });
    console.error(`   ⚠️  Error${url ? ` at ${url}` : ''}: ${error.message}`);
  }

  /**
   * Get the source name for this scraper
   */
  getSource(): string {
    return this.config.source;
  }

  /**
   * Get the scraper configuration
   */
  getConfig(): ScraperConfig {
    return { ...this.config };
  }
}
