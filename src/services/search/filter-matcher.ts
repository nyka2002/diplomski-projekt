import { Listing } from '@/types/listing';
import { ExtractedFilters } from '@/types/search';
import {
  FilterMatchResult,
  PartialMatch,
  FilterImportanceWeights,
  DEFAULT_FILTER_IMPORTANCE,
} from './types';

export class FilterMatcherService {
  private weights: FilterImportanceWeights;

  constructor(weights: Partial<FilterImportanceWeights> = {}) {
    this.weights = { ...DEFAULT_FILTER_IMPORTANCE, ...weights };
  }

  /**
   * Calculate how well a listing matches the requested filters
   */
  calculateFilterMatch(listing: Listing, filters: ExtractedFilters): FilterMatchResult {
    const matchedFilters: string[] = [];
    const unmatchedFilters: string[] = [];
    const partialMatches: PartialMatch[] = [];
    let totalWeight = 0;
    let matchedWeight = 0;

    // Listing type match
    if (filters.listing_type) {
      const weight = this.weights.listing_type;
      totalWeight += weight;
      if (listing.listing_type === filters.listing_type) {
        matchedFilters.push('listing_type');
        matchedWeight += weight;
      } else {
        unmatchedFilters.push('listing_type');
      }
    }

    // Property type match
    if (filters.property_type) {
      const weight = this.weights.property_type;
      totalWeight += weight;
      if (listing.property_type === filters.property_type) {
        matchedFilters.push('property_type');
        matchedWeight += weight;
      } else {
        unmatchedFilters.push('property_type');
      }
    }

    // Price max match
    if (filters.price_max !== undefined) {
      const weight = this.weights.price;
      totalWeight += weight;
      if (listing.price <= filters.price_max) {
        matchedFilters.push('price_max');
        matchedWeight += weight;
      } else {
        // Partial match if within 10% over budget
        const overagePercent = (listing.price - filters.price_max) / filters.price_max;
        if (overagePercent <= 0.1) {
          const matchPct = 1 - overagePercent;
          partialMatches.push({
            filterName: 'price_max',
            expected: filters.price_max,
            actual: listing.price,
            matchPercentage: matchPct,
          });
          matchedWeight += weight * matchPct;
        } else {
          unmatchedFilters.push('price_max');
        }
      }
    }

    // Price min match
    if (filters.price_min !== undefined) {
      const weight = this.weights.price;
      totalWeight += weight;
      if (listing.price >= filters.price_min) {
        matchedFilters.push('price_min');
        matchedWeight += weight;
      } else {
        // Partial match if within 10% under minimum
        const underagePercent = (filters.price_min - listing.price) / filters.price_min;
        if (underagePercent <= 0.1) {
          const matchPct = 1 - underagePercent;
          partialMatches.push({
            filterName: 'price_min',
            expected: filters.price_min,
            actual: listing.price,
            matchPercentage: matchPct,
          });
          matchedWeight += weight * matchPct;
        } else {
          unmatchedFilters.push('price_min');
        }
      }
    }

    // Location match (case-insensitive contains)
    if (filters.location) {
      const weight = this.weights.location;
      totalWeight += weight;
      const filterLocation = filters.location.toLowerCase();
      const listingCity = (listing.location_city || '').toLowerCase();
      const listingAddress = (listing.location_address || '').toLowerCase();

      if (listingCity.includes(filterLocation) || listingAddress.includes(filterLocation)) {
        matchedFilters.push('location');
        matchedWeight += weight;
      } else if (filterLocation.includes(listingCity) && listingCity.length > 0) {
        // Partial match if filter is more specific
        partialMatches.push({
          filterName: 'location',
          expected: filters.location,
          actual: listing.location_city,
          matchPercentage: 0.5,
        });
        matchedWeight += weight * 0.5;
      } else {
        unmatchedFilters.push('location');
      }
    }

    // Rooms min match
    if (filters.rooms_min !== undefined) {
      const weight = this.weights.rooms;
      totalWeight += weight;
      if (listing.rooms !== undefined && listing.rooms >= filters.rooms_min) {
        matchedFilters.push('rooms_min');
        matchedWeight += weight;
      } else if (listing.rooms !== undefined) {
        // Partial match for close room counts
        const diff = filters.rooms_min - listing.rooms;
        if (diff === 1) {
          partialMatches.push({
            filterName: 'rooms_min',
            expected: filters.rooms_min,
            actual: listing.rooms,
            matchPercentage: 0.7,
          });
          matchedWeight += weight * 0.7;
        } else {
          unmatchedFilters.push('rooms_min');
        }
      } else {
        // Unknown room count - neutral
        partialMatches.push({
          filterName: 'rooms_min',
          expected: filters.rooms_min,
          actual: 'unknown',
          matchPercentage: 0.5,
        });
        matchedWeight += weight * 0.5;
      }
    }

    // Rooms max match
    if (filters.rooms_max !== undefined) {
      const weight = this.weights.rooms;
      totalWeight += weight;
      if (listing.rooms !== undefined && listing.rooms <= filters.rooms_max) {
        matchedFilters.push('rooms_max');
        matchedWeight += weight;
      } else if (listing.rooms !== undefined) {
        const diff = listing.rooms - filters.rooms_max;
        if (diff === 1) {
          partialMatches.push({
            filterName: 'rooms_max',
            expected: filters.rooms_max,
            actual: listing.rooms,
            matchPercentage: 0.7,
          });
          matchedWeight += weight * 0.7;
        } else {
          unmatchedFilters.push('rooms_max');
        }
      } else {
        partialMatches.push({
          filterName: 'rooms_max',
          expected: filters.rooms_max,
          actual: 'unknown',
          matchPercentage: 0.5,
        });
        matchedWeight += weight * 0.5;
      }
    }

    // Surface area min match
    if (filters.surface_area_min !== undefined) {
      const weight = this.weights.surface_area;
      totalWeight += weight;
      if (listing.surface_area !== undefined && listing.surface_area >= filters.surface_area_min) {
        matchedFilters.push('surface_area_min');
        matchedWeight += weight;
      } else if (listing.surface_area !== undefined) {
        const underagePercent =
          (filters.surface_area_min - listing.surface_area) / filters.surface_area_min;
        if (underagePercent <= 0.15) {
          const matchPct = 1 - underagePercent;
          partialMatches.push({
            filterName: 'surface_area_min',
            expected: filters.surface_area_min,
            actual: listing.surface_area,
            matchPercentage: matchPct,
          });
          matchedWeight += weight * matchPct;
        } else {
          unmatchedFilters.push('surface_area_min');
        }
      }
    }

    // Surface area max match
    if (filters.surface_area_max !== undefined) {
      const weight = this.weights.surface_area;
      totalWeight += weight;
      if (listing.surface_area !== undefined && listing.surface_area <= filters.surface_area_max) {
        matchedFilters.push('surface_area_max');
        matchedWeight += weight;
      } else if (listing.surface_area !== undefined) {
        const overagePercent =
          (listing.surface_area - filters.surface_area_max) / filters.surface_area_max;
        if (overagePercent <= 0.15) {
          const matchPct = 1 - overagePercent;
          partialMatches.push({
            filterName: 'surface_area_max',
            expected: filters.surface_area_max,
            actual: listing.surface_area,
            matchPercentage: matchPct,
          });
          matchedWeight += weight * matchPct;
        } else {
          unmatchedFilters.push('surface_area_max');
        }
      }
    }

    // Boolean amenities
    const booleanFilters: Array<{
      key: keyof ExtractedFilters;
      listingKey: keyof Listing;
      name: string;
    }> = [
      { key: 'has_parking', listingKey: 'has_parking', name: 'parking' },
      { key: 'has_balcony', listingKey: 'has_balcony', name: 'balcony' },
      { key: 'has_garage', listingKey: 'has_garage', name: 'garage' },
      { key: 'is_furnished', listingKey: 'is_furnished', name: 'furnished' },
    ];

    for (const { key, listingKey, name } of booleanFilters) {
      if (filters[key] === true) {
        const weight = this.weights.amenities;
        totalWeight += weight;
        if (listing[listingKey] === true) {
          matchedFilters.push(name);
          matchedWeight += weight;
        } else {
          unmatchedFilters.push(name);
        }
      }
    }

    // Calculate final score
    const score = totalWeight > 0 ? matchedWeight / totalWeight : 1;

    return {
      score,
      matchedFilters,
      unmatchedFilters,
      partialMatches,
      totalWeight,
      matchedWeight,
    };
  }

  /**
   * Filter listings that don't meet hard requirements
   * Returns listings that pass critical filters
   */
  filterByHardRequirements(
    listings: Listing[],
    filters: ExtractedFilters
  ): Listing[] {
    return listings.filter((listing) => {
      // Listing type is a hard requirement if specified
      if (filters.listing_type && listing.listing_type !== filters.listing_type) {
        return false;
      }

      // Price max with 15% tolerance
      if (filters.price_max && listing.price > filters.price_max * 1.15) {
        return false;
      }

      return true;
    });
  }
}

// Export factory function
export function createFilterMatcher(
  weights?: Partial<FilterImportanceWeights>
): FilterMatcherService {
  return new FilterMatcherService(weights);
}
