/**
 * Price Normalizer
 *
 * Normalizes price data from Croatian real estate websites.
 * Features:
 * - Parse various Croatian price formats
 * - Convert legacy HRK to EUR (Croatia adopted EUR on Jan 1, 2023)
 * - Handle monthly vs total prices
 */

import { ListingType } from '@/types/listing';

export interface NormalizedPrice {
  /** Normalized price value */
  price: number;
  /** Currency code (always EUR) */
  currency: string;
  /** Whether this is a monthly price (for rentals) */
  isMonthly: boolean;
}

export class PriceNormalizer {
  // Official fixed exchange rate (Croatia joined Eurozone Jan 1, 2023)
  private readonly HRK_TO_EUR = 7.5345;

  /**
   * Normalize a price string to a structured price object
   */
  normalize(priceText: string, listingType: ListingType): NormalizedPrice {
    // Clean the price text
    const cleaned = priceText.replace(/\s+/g, ' ').trim().toLowerCase();

    // Extract numeric value
    const numericMatch = cleaned.match(/[\d.,]+/);
    if (!numericMatch) {
      return { price: 0, currency: 'EUR', isMonthly: listingType === 'rent' };
    }

    let price = this.parseNumeric(numericMatch[0]);

    // Detect currency and convert if needed
    if (cleaned.includes('kn') || cleaned.includes('hrk')) {
      // Legacy HRK price - convert to EUR
      price = Math.round(price / this.HRK_TO_EUR);
    }

    // Detect if monthly (for rentals)
    const isMonthly =
      listingType === 'rent' &&
      (cleaned.includes('/mj') ||
        cleaned.includes('mjesec') ||
        cleaned.includes('monthly') ||
        cleaned.includes('mj.') ||
        cleaned.includes('najam'));

    return {
      price: Math.round(price),
      currency: 'EUR',
      isMonthly,
    };
  }

  /**
   * Parse a numeric string handling both European and US formats
   */
  private parseNumeric(value: string): number {
    // Determine which format is used based on separators
    const lastComma = value.lastIndexOf(',');
    const lastDot = value.lastIndexOf('.');

    let cleaned: string;

    if (lastComma > lastDot) {
      // European format: 1.234,56 or 1234,56
      // Comma is decimal separator
      cleaned = value.replace(/\./g, '').replace(',', '.');
    } else if (lastDot > lastComma) {
      // Could be US format: 1,234.56 or 1234.56
      // Or European without decimals: 1.234
      // Check if there are 3 digits after the dot (likely thousands separator)
      const afterDot = value.slice(lastDot + 1);
      if (afterDot.length === 3 && !value.includes(',')) {
        // European format with thousands separator: 1.234 = 1234
        cleaned = value.replace(/\./g, '');
      } else {
        // US format: comma is thousands, dot is decimal
        cleaned = value.replace(/,/g, '');
      }
    } else {
      // No separators or only one type
      cleaned = value.replace(/,/g, '').replace(/\./g, '');
    }

    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Format a price for display
   */
  formatPrice(price: number, currency: string = 'EUR'): string {
    return new Intl.NumberFormat('hr-HR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  }
}
