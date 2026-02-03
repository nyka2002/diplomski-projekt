/**
 * Njuskalo Parser
 *
 * Extracts data from Njuskalo.hr pages using Playwright.
 */

import { Page } from 'playwright';
import { NJUSKALO_SELECTORS } from './selectors';
import { RawListingData, ListingPageData, PaginationInfo } from '../../types';

export class NjuskaloParser {
  private readonly selectors = NJUSKALO_SELECTORS;

  /**
   * Parse a listing page (search results) and extract listing data
   */
  async parseListingPage(page: Page): Promise<ListingPageData> {
    const listings: RawListingData[] = [];
    const { listingPage } = this.selectors;

    // Wait for listings to load
    await page.waitForSelector(listingPage.listingCard, { timeout: 10000 }).catch(() => null);

    // Get all listing cards
    const cards = await page.$$(listingPage.listingCard);

    for (const card of cards) {
      try {
        // Get link and URL
        const linkElement = await card.$(listingPage.listingLink);
        if (!linkElement) continue;

        const href = await linkElement.getAttribute('href');
        if (!href || !href.includes('/oglas/')) continue;

        const url = href.startsWith('http') ? href : `https://www.njuskalo.hr${href}`;
        const externalId = this.extractExternalId(url);

        // Get title
        const titleElement = await card.$(listingPage.listingTitle);
        const title = titleElement ? (await titleElement.textContent())?.trim() || '' : '';

        // Get price
        const priceElement = await card.$(listingPage.listingPrice);
        const priceText = priceElement ? (await priceElement.textContent())?.trim() || '' : '';

        // Get location
        const locationElement = await card.$(listingPage.listingLocation);
        const location = locationElement ? (await locationElement.textContent())?.trim() || '' : '';

        // Get image
        const imageElement = await card.$(listingPage.listingImage);
        const imageSrc = imageElement ? await imageElement.getAttribute('src') : null;
        const images = imageSrc ? [imageSrc] : [];

        // Get surface area and rooms from description
        let surfaceArea: string | undefined;
        let rooms: string | undefined;

        const surfaceElement = await card.$(listingPage.listingSurface);
        if (surfaceElement) {
          const surfaceText = (await surfaceElement.textContent())?.trim() || '';
          if (surfaceText.includes('m²') || surfaceText.includes('m2')) {
            surfaceArea = surfaceText;
          }
        }

        const roomsElement = await card.$(listingPage.listingRooms);
        if (roomsElement) {
          const roomsText = (await roomsElement.textContent())?.trim() || '';
          if (roomsText.includes('sob') || /\d/.test(roomsText)) {
            rooms = roomsText;
          }
        }

        listings.push({
          externalId,
          url,
          title,
          description: '',
          priceText,
          location,
          rooms,
          surfaceArea,
          images,
          rawAmenities: [],
          additionalData: {},
        });
      } catch (error) {
        // Skip problematic cards
        console.warn('Failed to parse listing card:', (error as Error).message);
      }
    }

    return { listings };
  }

  /**
   * Parse a detail page and extract full listing data
   */
  async parseDetailPage(page: Page): Promise<RawListingData> {
    const { detailPage } = this.selectors;

    // Get title
    const titleElement = await page.$(detailPage.title);
    const title = titleElement ? (await titleElement.textContent())?.trim() || '' : '';

    // Get price
    const priceElement = await page.$(detailPage.price);
    const priceText = priceElement ? (await priceElement.textContent())?.trim() || '' : '';

    // Get description
    const descElement = await page.$(detailPage.description);
    const description = descElement ? (await descElement.textContent())?.trim() || '' : '';

    // Get location
    const locationElement = await page.$(detailPage.location);
    const location = locationElement ? (await locationElement.textContent())?.trim() || '' : '';

    // Get images
    const imageElements = await page.$$(detailPage.images);
    const images: string[] = [];
    for (const img of imageElements) {
      const src = await img.getAttribute('src');
      if (src && !src.includes('placeholder')) {
        // Convert thumbnail to full size if possible
        const fullSrc = src.replace(/\/\d+x\d+\//, '/').replace('_thumb', '');
        images.push(fullSrc);
      }
    }

    // Get property info
    const additionalData = await this.extractPropertyInfo(page);

    // Get amenities
    const amenityElements = await page.$$(detailPage.amenities);
    const rawAmenities: string[] = [];
    for (const amenity of amenityElements) {
      const text = (await amenity.textContent())?.trim();
      if (text) rawAmenities.push(text);
    }

    // Extract rooms and surface from additionalData
    const rooms = this.findInAdditionalData(additionalData, this.selectors.propertyLabels.rooms);
    const surfaceArea = this.findInAdditionalData(
      additionalData,
      this.selectors.propertyLabels.surfaceArea
    );

    return {
      externalId: this.extractExternalId(page.url()),
      url: page.url(),
      title,
      description,
      priceText,
      location,
      rooms,
      surfaceArea,
      images,
      rawAmenities,
      additionalData,
    };
  }

  /**
   * Get pagination information from the page
   */
  async getPagination(page: Page): Promise<PaginationInfo> {
    const { listingPage } = this.selectors;

    // Try to find next page button
    const nextButton = await page.$(listingPage.nextPageButton);
    const hasNextPage = nextButton !== null;

    let nextPageUrl: string | undefined;
    if (hasNextPage && nextButton) {
      nextPageUrl = (await nextButton.getAttribute('href')) || undefined;
      if (nextPageUrl && !nextPageUrl.startsWith('http')) {
        nextPageUrl = `https://www.njuskalo.hr${nextPageUrl}`;
      }
    }

    // Extract current page from URL
    const url = new URL(page.url());
    const pageParam = url.searchParams.get('page');
    const currentPage = pageParam ? parseInt(pageParam, 10) : 1;

    // Try to get total pages
    let totalPages: number | undefined;
    const paginationItems = await page.$$('.Pagination-item');
    if (paginationItems.length > 0) {
      const lastItem = paginationItems[paginationItems.length - 2]; // -2 because last is "next"
      if (lastItem) {
        const text = await lastItem.textContent();
        if (text) {
          const num = parseInt(text.trim(), 10);
          if (!isNaN(num)) totalPages = num;
        }
      }
    }

    return {
      currentPage,
      totalPages,
      hasNextPage,
      nextPageUrl,
    };
  }

  /**
   * Extract property information from detail page
   */
  private async extractPropertyInfo(page: Page): Promise<Record<string, string>> {
    const info: Record<string, string> = {};
    const { detailPage } = this.selectors;

    const items = await page.$$(detailPage.propertyInfo);

    for (const item of items) {
      try {
        // Try to get label and value separately
        const labelElement = await item.$(detailPage.propertyInfoLabel);
        const valueElement = await item.$(detailPage.propertyInfoValue);

        if (labelElement && valueElement) {
          const label = (await labelElement.textContent())?.trim() || '';
          const value = (await valueElement.textContent())?.trim() || '';
          if (label && value) {
            info[label] = value;
          }
        } else {
          // Try to parse as "Label: Value" format
          const text = (await item.textContent())?.trim() || '';
          const colonIndex = text.indexOf(':');
          if (colonIndex > 0) {
            const label = text.substring(0, colonIndex).trim();
            const value = text.substring(colonIndex + 1).trim();
            if (label && value) {
              info[label] = value;
            }
          }
        }
      } catch {
        // Skip problematic items
      }
    }

    return info;
  }

  /**
   * Extract external ID from URL
   */
  private extractExternalId(url: string): string {
    // URL format examples:
    // /prodaja-stanova/stan-zagreb-tresnjevka-oglas-12345678
    // /iznajmljivanje-stanova/stan-2-sobni-oglas-98765432

    const match = url.match(/oglas[/-](\d+)/i);
    if (match) return match[1];

    // Fallback: get last segment that looks like an ID
    const segments = url.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1];

    // Try to extract number from last segment
    const numMatch = lastSegment?.match(/(\d+)/);
    if (numMatch) return numMatch[1];

    // Last resort: hash the URL
    return this.hashString(url);
  }

  /**
   * Find a value in additionalData by matching labels
   */
  private findInAdditionalData(
    data: Record<string, string>,
    labelPatterns: readonly string[]
  ): string | undefined {
    for (const pattern of labelPatterns) {
      for (const [key, value] of Object.entries(data)) {
        if (key.toLowerCase().includes(pattern.toLowerCase())) {
          return value;
        }
      }
    }
    return undefined;
  }

  /**
   * Simple hash function for generating IDs
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}
