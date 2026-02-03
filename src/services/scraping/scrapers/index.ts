/**
 * Scraper Registry
 *
 * Central registry for all available scrapers.
 * Provides factory methods for creating scraper instances.
 */

import { ListingType, PropertyType } from '@/types/listing';
import { BaseScraper } from '../base';
import { NjuskaloScraper } from './njuskalo';
import { IndexOglasiScraper } from './index-oglasi';

// Re-export scrapers
export { NjuskaloScraper } from './njuskalo';
export { IndexOglasiScraper } from './index-oglasi';

/**
 * Available scraper sources
 */
export type ScraperSource = 'njuskalo' | 'index-oglasi';

/**
 * Scraper configuration for factory method
 */
export interface ScraperOptions {
  source: ScraperSource;
  listingType: ListingType;
  propertyType?: PropertyType;
}

/**
 * Get a scraper instance for a specific source
 */
export function getScraperForSource(options: ScraperOptions): BaseScraper {
  const { source, listingType, propertyType = 'apartment' } = options;

  switch (source) {
    case 'njuskalo':
      return new NjuskaloScraper(listingType, propertyType);
    case 'index-oglasi':
      return new IndexOglasiScraper(listingType, propertyType);
    default:
      throw new Error(`Unknown scraper source: ${source}`);
  }
}

/**
 * Get all scrapers for a full scrape operation
 */
export function getAllScrapers(): BaseScraper[] {
  const sources: ScraperSource[] = ['njuskalo', 'index-oglasi'];
  const listingTypes: ListingType[] = ['rent', 'sale'];
  const propertyTypes: PropertyType[] = ['apartment', 'house'];

  const scrapers: BaseScraper[] = [];

  for (const source of sources) {
    for (const listingType of listingTypes) {
      for (const propertyType of propertyTypes) {
        scrapers.push(
          getScraperForSource({
            source,
            listingType,
            propertyType,
          })
        );
      }
    }
  }

  return scrapers;
}

/**
 * Get scraper sources for a specific listing type
 */
export function getScrapersForListingType(listingType: ListingType): BaseScraper[] {
  const sources: ScraperSource[] = ['njuskalo', 'index-oglasi'];
  const propertyTypes: PropertyType[] = ['apartment', 'house'];

  const scrapers: BaseScraper[] = [];

  for (const source of sources) {
    for (const propertyType of propertyTypes) {
      scrapers.push(
        getScraperForSource({
          source,
          listingType,
          propertyType,
        })
      );
    }
  }

  return scrapers;
}

/**
 * List of all available sources
 */
export const AVAILABLE_SOURCES: ScraperSource[] = ['njuskalo', 'index-oglasi'];
