/**
 * Rate Limiter
 *
 * Throttles requests to avoid overwhelming target websites and getting blocked.
 * Features:
 * - Requests per minute limiting
 * - Minimum delay between requests
 * - Random variance to avoid detection
 */

import { SCRAPING_CONFIG } from '../config';

export class RateLimiter {
  private lastRequestTime = 0;
  private requestCount = 0;
  private windowStart = Date.now();
  private readonly config = SCRAPING_CONFIG.rateLimit;

  /**
   * Wait if necessary before making the next request
   */
  async throttle(): Promise<void> {
    const now = Date.now();

    // Reset window if minute has passed
    if (now - this.windowStart >= 60000) {
      this.windowStart = now;
      this.requestCount = 0;
    }

    // Check if we've exceeded rate limit
    if (this.requestCount >= this.config.requestsPerMinute) {
      const waitTime = 60000 - (now - this.windowStart);
      console.log(`⏳ Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)}s...`);
      await this.delay(waitTime);
      this.windowStart = Date.now();
      this.requestCount = 0;
    }

    // Ensure minimum delay between requests
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.config.delayBetweenRequests) {
      const baseWait = this.config.delayBetweenRequests - timeSinceLastRequest;
      // Add random variance to avoid detection patterns
      const variance = Math.random() * this.config.delayVariance;
      await this.delay(baseWait + variance);
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * Shorter delay for detail page fetches
   */
  async throttleDetail(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.config.delayBetweenListings) {
      const baseWait = this.config.delayBetweenListings - timeSinceLastRequest;
      const variance = Math.random() * (this.config.delayVariance / 2);
      await this.delay(baseWait + variance);
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * Get current rate limiter statistics
   */
  getStats(): { requestsInWindow: number; windowRemaining: number } {
    const now = Date.now();
    return {
      requestsInWindow: this.requestCount,
      windowRemaining: Math.max(0, 60000 - (now - this.windowStart)),
    };
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.lastRequestTime = 0;
    this.requestCount = 0;
    this.windowStart = Date.now();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
