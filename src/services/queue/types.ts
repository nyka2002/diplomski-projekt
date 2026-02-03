/**
 * Queue Types
 *
 * Types for job queue operations including job data and results.
 */

import { ListingType, PropertyType } from '@/types/listing';

/**
 * Types of scraping jobs
 */
export type JobType =
  | 'full_scrape' // Scrape all sources, all types
  | 'single_source' // Scrape a specific source
  | 'listing_type_scrape' // Scrape all sources for a listing type
  | 'update_check'; // Check for updated listings

/**
 * Who triggered the job
 */
export type JobTrigger = 'scheduler' | 'manual' | 'webhook' | 'system';

/**
 * Job data for scraping operations
 */
export interface ScrapeJobData {
  /** Type of scrape job */
  type: JobType;
  /** Source to scrape (for single_source) */
  source?: string;
  /** Listing type filter */
  listingType?: ListingType;
  /** Property type filter */
  propertyType?: PropertyType;
  /** Maximum pages to scrape per source */
  maxPages?: number;
  /** Who triggered the job */
  triggeredBy: JobTrigger;
  /** Timestamp when job was triggered */
  triggeredAt: string;
}

/**
 * Result of a scrape job
 */
export interface ScrapeJobResult {
  /** Job ID */
  jobId: string;
  /** Job type */
  type: JobType;
  /** Sources scraped */
  sources: string[];
  /** Total listings scraped across all sources */
  totalListingsScraped: number;
  /** Total listings saved to database */
  totalListingsSaved: number;
  /** Total duplicate listings found */
  totalDuplicates: number;
  /** Total errors encountered */
  totalErrors: number;
  /** Per-source results */
  sourceResults: SourceResult[];
  /** Total duration in milliseconds */
  duration: number;
  /** Timestamp when job started */
  startedAt: string;
  /** Timestamp when job completed */
  completedAt: string;
}

/**
 * Result for a single source scrape
 */
export interface SourceResult {
  source: string;
  listingType: ListingType;
  propertyType: PropertyType;
  listingsScraped: number;
  listingsSaved: number;
  duplicates: number;
  errors: number;
  duration: number;
}

/**
 * Job progress update
 */
export interface JobProgress {
  /** Current scraper index */
  currentScraper: number;
  /** Total scrapers to run */
  totalScrapers: number;
  /** Current source being scraped */
  currentSource: string;
  /** Current listing type */
  currentListingType: ListingType;
  /** Current property type */
  currentPropertyType: PropertyType;
  /** Current page being scraped */
  currentPage: number;
  /** Total listings processed so far */
  listingsProcessed: number;
  /** Job status */
  status: 'running' | 'completed' | 'failed';
  /** Status message */
  message?: string;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  /** Number of jobs waiting */
  waiting: number;
  /** Number of jobs currently active */
  active: number;
  /** Number of completed jobs */
  completed: number;
  /** Number of failed jobs */
  failed: number;
  /** Number of delayed jobs */
  delayed: number;
}
