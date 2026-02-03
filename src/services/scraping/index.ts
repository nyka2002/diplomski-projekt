/**
 * Scraping Module
 *
 * Main exports for web scraping functionality.
 */

// Types
export * from './types';

// Configuration
export { SCRAPING_CONFIG } from './config';

// Browser pool
export { browserPool, BrowserPool } from './browser';

// Base scraper
export { BaseScraper } from './base';
export { RateLimiter } from './base/rate-limiter';
export { RetryHandler } from './base/retry-handler';

// Normalizers
export { PriceNormalizer } from './normalizers/price-normalizer';
export { LocationNormalizer } from './normalizers/location-normalizer';
export { AmenityMapper } from './normalizers/amenity-mapper';

// Scrapers
export { NjuskaloScraper } from './scrapers/njuskalo';
export { IndexOglasiScraper } from './scrapers/index-oglasi';

// Scraper registry
export { getScraperForSource, getAllScrapers } from './scrapers';
