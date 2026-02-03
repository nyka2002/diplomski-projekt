/**
 * Retry Handler
 *
 * Provides retry logic with exponential backoff for scraping operations.
 * Features:
 * - Configurable retry attempts
 * - Exponential backoff
 * - Retryable error detection
 */

import { SCRAPING_CONFIG } from '../config';
import { ScrapeErrorCode } from '../types';

type RetryableFunction<T> = () => Promise<T>;

export class RetryHandler {
  private readonly config = SCRAPING_CONFIG.retry;

  /**
   * Execute a function with automatic retry on failure
   */
  async withRetry<T>(fn: RetryableFunction<T>, context: string): Promise<T> {
    let lastError: Error | null = null;
    let delay: number = this.config.initialDelay;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        const errorCode = this.getErrorCode(error);

        if (!this.isRetryable(errorCode)) {
          console.error(`[${context}] Non-retryable error: ${lastError.message}`);
          throw error;
        }

        if (attempt < this.config.maxRetries) {
          console.warn(
            `[${context}] Attempt ${attempt}/${this.config.maxRetries} failed: ${lastError.message}. ` +
              `Retrying in ${Math.ceil(delay / 1000)}s...`
          );
          await this.delay(delay);
          delay = Math.min(delay * this.config.backoffMultiplier, this.config.maxDelay);
        }
      }
    }

    console.error(
      `[${context}] All ${this.config.maxRetries} attempts failed. Last error: ${lastError?.message}`
    );
    throw lastError;
  }

  /**
   * Determine error code from error object
   */
  getErrorCode(error: unknown): ScrapeErrorCode {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Timeout errors
      if (message.includes('timeout') || message.includes('exceeded')) {
        return 'TIMEOUT';
      }

      // Network errors
      if (
        message.includes('net::') ||
        message.includes('network') ||
        message.includes('econnrefused') ||
        message.includes('enotfound')
      ) {
        return 'NETWORK_ERROR';
      }

      // Rate limiting (HTTP 429)
      if (message.includes('429') || message.includes('rate limit') || message.includes('too many')) {
        return 'RATE_LIMITED';
      }

      // Navigation errors
      if (message.includes('navigation') || message.includes('goto')) {
        return 'NAVIGATION_ERROR';
      }

      // Selector errors
      if (message.includes('selector') || message.includes('element')) {
        return 'SELECTOR_ERROR';
      }

      // Parse errors
      if (message.includes('parse') || message.includes('json')) {
        return 'PARSE_ERROR';
      }
    }

    return 'UNKNOWN';
  }

  /**
   * Check if an error code is retryable
   */
  isRetryable(code: ScrapeErrorCode): boolean {
    return (this.config.retryableErrors as readonly string[]).includes(code);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
