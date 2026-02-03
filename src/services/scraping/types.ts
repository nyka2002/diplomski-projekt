/**
 * Scraping Module Types
 *
 * Types for web scraping operations including:
 * - Raw scraped data before normalization
 * - Scraper configuration
 * - Scrape results and errors
 */

import { ListingType, PropertyType } from '@/types/listing';

// ============================================================================
// RAW DATA TYPES
// ============================================================================

/**
 * Raw listing data scraped from a website before normalization
 */
export interface RawListingData {
  /** External ID from the source website */
  externalId: string;
  /** Full URL to the listing */
  url: string;
  /** Listing title */
  title: string;
  /** Full description text */
  description: string;
  /** Raw price string (e.g., "850 €/mj" or "125.000 €") */
  priceText: string;
  /** Raw location string (e.g., "Zagreb, Trešnjevka") */
  location: string;
  /** Number of rooms as string (e.g., "3" or "3 sobe") */
  rooms?: string;
  /** Surface area as string (e.g., "75 m²") */
  surfaceArea?: string;
  /** Array of image URLs */
  images: string[];
  /** Raw amenity strings in Croatian */
  rawAmenities: string[];
  /** Any additional extracted data */
  additionalData: Record<string, string>;
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

/**
 * Configuration for a scraper instance
 */
export interface ScraperConfig {
  /** Source identifier (e.g., "njuskalo", "index-oglasi") */
  source: string;
  /** Base URL of the website */
  baseUrl: string;
  /** Type of listings to scrape */
  listingType: ListingType;
  /** Type of property to scrape */
  propertyType?: PropertyType;
  /** Maximum number of pages to scrape */
  maxPages?: number;
  /** Delay between requests in milliseconds */
  delayBetweenRequests?: number;
  /** Timeout per page in milliseconds */
  timeout?: number;
}

// ============================================================================
// RESULT TYPES
// ============================================================================

/**
 * Result of a scraping operation
 */
export interface ScrapeResult {
  /** Whether the scrape completed without critical errors */
  success: boolean;
  /** Source identifier */
  source: string;
  /** Number of listings scraped */
  listingsScraped: number;
  /** Number of listings successfully saved to database */
  listingsSaved: number;
  /** Number of listings that were duplicates (already existed) */
  listingsDuplicate: number;
  /** Array of errors encountered */
  errors: ScrapeError[];
  /** Total duration in milliseconds */
  duration: number;
  /** Timestamp when scraping started */
  startedAt: Date;
  /** Timestamp when scraping completed */
  completedAt: Date;
}

/**
 * Error encountered during scraping
 */
export interface ScrapeError {
  /** URL where error occurred (if applicable) */
  url?: string;
  /** Error message */
  message: string;
  /** Error code for categorization */
  code: ScrapeErrorCode;
  /** Timestamp when error occurred */
  timestamp: Date;
}

export type ScrapeErrorCode =
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'RATE_LIMITED'
  | 'PARSE_ERROR'
  | 'NAVIGATION_ERROR'
  | 'SELECTOR_ERROR'
  | 'NORMALIZATION_ERROR'
  | 'DATABASE_ERROR'
  | 'UNKNOWN';

// ============================================================================
// PAGE DATA TYPES
// ============================================================================

/**
 * Data extracted from a listing page (search results)
 */
export interface ListingPageData {
  /** Array of listing previews from the page */
  listings: RawListingData[];
  /** URL of the next page (if any) */
  nextPageUrl?: string;
  /** Total number of listings (if available) */
  totalListings?: number;
}

/**
 * Pagination information
 */
export interface PaginationInfo {
  /** Current page number (1-indexed) */
  currentPage: number;
  /** Total number of pages (if known) */
  totalPages?: number;
  /** Whether there is a next page */
  hasNextPage: boolean;
  /** URL of the next page */
  nextPageUrl?: string;
}

// ============================================================================
// BROWSER POOL TYPES
// ============================================================================

/**
 * Browser pool statistics
 */
export interface BrowserPoolStats {
  /** Number of active browsers */
  activeBrowsers: number;
  /** Maximum browsers allowed */
  maxBrowsers: number;
  /** Number of browsers currently in use */
  busyBrowsers: number;
  /** Number of available browsers */
  availableBrowsers: number;
}
