/**
 * Njuskalo Scraper
 *
 * Scrapes real estate listings from Njuskalo.hr
 */

import { Page } from 'playwright';
import { BaseScraper } from '../../base';
import { NjuskaloParser } from './parser';
import { RawListingData, ListingPageData, PaginationInfo } from '../../types';
import { NormalizedListing, ListingType, PropertyType } from '@/types/listing';
import { SCRAPING_CONFIG } from '../../config';
import { PriceNormalizer } from '../../normalizers/price-normalizer';
import { LocationNormalizer } from '../../normalizers/location-normalizer';
import { AmenityMapper } from '../../normalizers/amenity-mapper';

export class NjuskaloScraper extends BaseScraper {
  private parser: NjuskaloParser;
  private priceNormalizer: PriceNormalizer;
  private locationNormalizer: LocationNormalizer;
  private amenityMapper: AmenityMapper;

  constructor(listingType: ListingType, propertyType: PropertyType = 'apartment') {
    super({
      source: 'njuskalo',
      baseUrl: SCRAPING_CONFIG.sources.njuskalo.baseUrl,
      listingType,
      propertyType,
      maxPages: SCRAPING_CONFIG.sources.njuskalo.maxPagesPerScrape,
    });

    this.parser = new NjuskaloParser();
    this.priceNormalizer = new PriceNormalizer();
    this.locationNormalizer = new LocationNormalizer();
    this.amenityMapper = new AmenityMapper();
  }

  /**
   * Get the URL for a specific page of listings
   */
  getListingPageUrl(page: number): string {
    const { baseUrl } = SCRAPING_CONFIG.sources.njuskalo;
    const path = this.getPathForType();

    const url = new URL(`${baseUrl}${path}`);

    if (page > 1) {
      url.searchParams.set('page', String(page));
    }

    return url.toString();
  }

  /**
   * Parse a listing page and extract raw listing data
   */
  async parseListingPage(page: Page): Promise<ListingPageData> {
    return this.parser.parseListingPage(page);
  }

  /**
   * Parse a detail page for a single listing
   */
  async parseDetailPage(page: Page, url: string): Promise<RawListingData | null> {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      return this.parser.parseDetailPage(page);
    } catch (error) {
      console.error(`Failed to parse detail page ${url}:`, (error as Error).message);
      return null;
    }
  }

  /**
   * Get pagination information from the current page
   */
  async getPagination(page: Page): Promise<PaginationInfo> {
    return this.parser.getPagination(page);
  }

  /**
   * Normalize raw scraped data to the standard listing format
   */
  protected normalizeRawData(raw: RawListingData): NormalizedListing {
    // Normalize price
    const { price, currency } = this.priceNormalizer.normalize(
      raw.priceText,
      this.config.listingType
    );

    // Normalize location
    const { city, address } = this.locationNormalizer.normalize(raw.location);

    // Map amenities
    const amenities = this.amenityMapper.mapAmenities(raw.rawAmenities);

    // Also extract amenities from description
    if (raw.description) {
      const descAmenities = this.amenityMapper.extractFromDescription(raw.description);
      Object.assign(amenities, this.amenityMapper.mergeAmenities(amenities, descAmenities));
    }

    // Parse rooms
    let rooms: number | undefined;
    if (raw.rooms) {
      const roomMatch = raw.rooms.match(/(\d+)/);
      if (roomMatch) {
        rooms = parseInt(roomMatch[1], 10);
      }
    }

    // Parse surface area
    let surfaceArea: number | undefined;
    if (raw.surfaceArea) {
      const areaMatch = raw.surfaceArea.match(/[\d.,]+/);
      if (areaMatch) {
        surfaceArea = parseFloat(areaMatch[0].replace(',', '.'));
      }
    }

    // Extract bedrooms and bathrooms from additionalData if available
    let bedrooms: number | undefined;
    let bathrooms: number | undefined;

    for (const [key, value] of Object.entries(raw.additionalData)) {
      const keyLower = key.toLowerCase();
      if (keyLower.includes('spava') || keyLower.includes('bedroom')) {
        const match = value.match(/(\d+)/);
        if (match) bedrooms = parseInt(match[1], 10);
      }
      if (keyLower.includes('kupao') || keyLower.includes('bathroom')) {
        const match = value.match(/(\d+)/);
        if (match) bathrooms = parseInt(match[1], 10);
      }
    }

    return {
      source: 'njuskalo',
      external_id: raw.externalId,
      title: raw.title,
      description: raw.description,
      price,
      price_currency: currency,
      listing_type: this.config.listingType,
      property_type: this.config.propertyType || 'apartment',
      location_city: city,
      location_address: address,
      rooms,
      bedrooms,
      bathrooms,
      surface_area: surfaceArea,
      has_parking: amenities.has_parking,
      has_balcony: amenities.has_balcony,
      has_garage: amenities.has_garage,
      is_furnished: amenities.is_furnished,
      amenities: amenities.additional,
      images: raw.images,
      url: raw.url,
    };
  }

  /**
   * Get the URL path for the current listing and property type
   */
  private getPathForType(): string {
    const { njuskalo } = SCRAPING_CONFIG.sources;
    const { listingType, propertyType } = this.config;

    if (propertyType === 'apartment') {
      return listingType === 'rent'
        ? njuskalo.rentApartmentsPath
        : njuskalo.saleApartmentsPath;
    } else if (propertyType === 'house') {
      return listingType === 'rent' ? njuskalo.rentHousesPath : njuskalo.saleHousesPath;
    }

    // Default to apartments
    return listingType === 'rent' ? njuskalo.rentApartmentsPath : njuskalo.saleApartmentsPath;
  }
}
