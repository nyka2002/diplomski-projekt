import { describe, it, expect, beforeEach } from 'vitest';
import { FilterMatcherService, createFilterMatcher } from '@/services/search/filter-matcher';
import { createMockListing } from '../../../fixtures/listings';
import { ExtractedFilters } from '@/types/search';

describe('FilterMatcherService', () => {
  let filterMatcher: FilterMatcherService;

  beforeEach(() => {
    filterMatcher = new FilterMatcherService();
  });

  describe('calculateFilterMatch', () => {
    describe('listing_type matching', () => {
      it('should match when listing type equals filter', () => {
        const listing = createMockListing({ listing_type: 'rent' });
        const filters: ExtractedFilters = { listing_type: 'rent' };

        const result = filterMatcher.calculateFilterMatch(listing, filters);

        expect(result.matchedFilters).toContain('listing_type');
        expect(result.score).toBe(1);
      });

      it('should not match when listing type differs', () => {
        const listing = createMockListing({ listing_type: 'sale' });
        const filters: ExtractedFilters = { listing_type: 'rent' };

        const result = filterMatcher.calculateFilterMatch(listing, filters);

        expect(result.unmatchedFilters).toContain('listing_type');
        expect(result.score).toBe(0);
      });
    });

    describe('property_type matching', () => {
      it('should match when property type equals filter', () => {
        const listing = createMockListing({ property_type: 'house' });
        const filters: ExtractedFilters = { property_type: 'house' };

        const result = filterMatcher.calculateFilterMatch(listing, filters);

        expect(result.matchedFilters).toContain('property_type');
      });

      it('should not match when property type differs', () => {
        const listing = createMockListing({ property_type: 'apartment' });
        const filters: ExtractedFilters = { property_type: 'house' };

        const result = filterMatcher.calculateFilterMatch(listing, filters);

        expect(result.unmatchedFilters).toContain('property_type');
      });
    });

    describe('price_max matching', () => {
      it('should match when listing price is under max', () => {
        const listing = createMockListing({ price: 600 });
        const filters: ExtractedFilters = { price_max: 700 };

        const result = filterMatcher.calculateFilterMatch(listing, filters);

        expect(result.matchedFilters).toContain('price_max');
      });

      it('should match when listing price equals max', () => {
        const listing = createMockListing({ price: 700 });
        const filters: ExtractedFilters = { price_max: 700 };

        const result = filterMatcher.calculateFilterMatch(listing, filters);

        expect(result.matchedFilters).toContain('price_max');
      });

      it('should give partial match within 10% over budget', () => {
        const listing = createMockListing({ price: 770 }); // 10% over 700
        const filters: ExtractedFilters = { price_max: 700 };

        const result = filterMatcher.calculateFilterMatch(listing, filters);

        expect(result.partialMatches.some((pm) => pm.filterName === 'price_max')).toBe(true);
        const partialMatch = result.partialMatches.find((pm) => pm.filterName === 'price_max');
        expect(partialMatch?.matchPercentage).toBeCloseTo(0.9, 1);
      });

      it('should not match when more than 10% over budget', () => {
        const listing = createMockListing({ price: 800 }); // ~14% over 700
        const filters: ExtractedFilters = { price_max: 700 };

        const result = filterMatcher.calculateFilterMatch(listing, filters);

        expect(result.unmatchedFilters).toContain('price_max');
      });
    });

    describe('price_min matching', () => {
      it('should match when listing price is above min', () => {
        const listing = createMockListing({ price: 600 });
        const filters: ExtractedFilters = { price_min: 500 };

        const result = filterMatcher.calculateFilterMatch(listing, filters);

        expect(result.matchedFilters).toContain('price_min');
      });

      it('should give partial match within 10% under minimum', () => {
        const listing = createMockListing({ price: 450 }); // 10% under 500
        const filters: ExtractedFilters = { price_min: 500 };

        const result = filterMatcher.calculateFilterMatch(listing, filters);

        expect(result.partialMatches.some((pm) => pm.filterName === 'price_min')).toBe(true);
      });
    });

    describe('location matching', () => {
      it('should match when city contains filter location', () => {
        const listing = createMockListing({ location_city: 'Zagreb' });
        const filters: ExtractedFilters = { location: 'Zagreb' };

        const result = filterMatcher.calculateFilterMatch(listing, filters);

        expect(result.matchedFilters).toContain('location');
      });

      it('should match case-insensitively', () => {
        const listing = createMockListing({ location_city: 'ZAGREB' });
        const filters: ExtractedFilters = { location: 'zagreb' };

        const result = filterMatcher.calculateFilterMatch(listing, filters);

        expect(result.matchedFilters).toContain('location');
      });

      it('should match when address contains filter location', () => {
        const listing = createMockListing({
          location_city: 'Zagreb',
          location_address: 'Trešnjevka',
        });
        const filters: ExtractedFilters = { location: 'Trešnjevka' };

        const result = filterMatcher.calculateFilterMatch(listing, filters);

        expect(result.matchedFilters).toContain('location');
      });

      it('should give partial match when filter is more specific', () => {
        const listing = createMockListing({
          location_city: 'Zagreb',
          location_address: 'Centar',
        });
        const filters: ExtractedFilters = { location: 'Zagreb, Trešnjevka' };

        const result = filterMatcher.calculateFilterMatch(listing, filters);

        expect(result.partialMatches.some((pm) => pm.filterName === 'location')).toBe(true);
      });

      it('should not match when locations are different', () => {
        const listing = createMockListing({ location_city: 'Split' });
        const filters: ExtractedFilters = { location: 'Zagreb' };

        const result = filterMatcher.calculateFilterMatch(listing, filters);

        expect(result.unmatchedFilters).toContain('location');
      });
    });

    describe('rooms_min matching', () => {
      it('should match when rooms >= min', () => {
        const listing = createMockListing({ rooms: 3 });
        const filters: ExtractedFilters = { rooms_min: 2 };

        const result = filterMatcher.calculateFilterMatch(listing, filters);

        expect(result.matchedFilters).toContain('rooms_min');
      });

      it('should give partial match when off by 1 room', () => {
        const listing = createMockListing({ rooms: 2 });
        const filters: ExtractedFilters = { rooms_min: 3 };

        const result = filterMatcher.calculateFilterMatch(listing, filters);

        const partialMatch = result.partialMatches.find((pm) => pm.filterName === 'rooms_min');
        expect(partialMatch).toBeDefined();
        expect(partialMatch?.matchPercentage).toBe(0.7);
      });

      it('should not match when more than 1 room off', () => {
        const listing = createMockListing({ rooms: 1 });
        const filters: ExtractedFilters = { rooms_min: 3 };

        const result = filterMatcher.calculateFilterMatch(listing, filters);

        expect(result.unmatchedFilters).toContain('rooms_min');
      });

      it('should handle unknown room count with neutral score', () => {
        const listing = createMockListing({ rooms: undefined });
        const filters: ExtractedFilters = { rooms_min: 2 };

        const result = filterMatcher.calculateFilterMatch(listing, filters);

        const partialMatch = result.partialMatches.find((pm) => pm.filterName === 'rooms_min');
        expect(partialMatch?.matchPercentage).toBe(0.5);
      });
    });

    describe('rooms_max matching', () => {
      it('should match when rooms <= max', () => {
        const listing = createMockListing({ rooms: 2 });
        const filters: ExtractedFilters = { rooms_max: 3 };

        const result = filterMatcher.calculateFilterMatch(listing, filters);

        expect(result.matchedFilters).toContain('rooms_max');
      });

      it('should give partial match when off by 1 room', () => {
        const listing = createMockListing({ rooms: 4 });
        const filters: ExtractedFilters = { rooms_max: 3 };

        const result = filterMatcher.calculateFilterMatch(listing, filters);

        const partialMatch = result.partialMatches.find((pm) => pm.filterName === 'rooms_max');
        expect(partialMatch).toBeDefined();
        expect(partialMatch?.matchPercentage).toBe(0.7);
      });
    });

    describe('surface_area matching', () => {
      it('should match when surface area >= min', () => {
        const listing = createMockListing({ surface_area: 60 });
        const filters: ExtractedFilters = { surface_area_min: 50 };

        const result = filterMatcher.calculateFilterMatch(listing, filters);

        expect(result.matchedFilters).toContain('surface_area_min');
      });

      it('should give partial match within 15% tolerance', () => {
        const listing = createMockListing({ surface_area: 45 }); // 10% under 50
        const filters: ExtractedFilters = { surface_area_min: 50 };

        const result = filterMatcher.calculateFilterMatch(listing, filters);

        expect(result.partialMatches.some((pm) => pm.filterName === 'surface_area_min')).toBe(
          true
        );
      });

      it('should match when surface area <= max', () => {
        const listing = createMockListing({ surface_area: 60 });
        const filters: ExtractedFilters = { surface_area_max: 80 };

        const result = filterMatcher.calculateFilterMatch(listing, filters);

        expect(result.matchedFilters).toContain('surface_area_max');
      });
    });

    describe('boolean amenities matching', () => {
      it('should match parking when available', () => {
        const listing = createMockListing({ has_parking: true });
        const filters: ExtractedFilters = { has_parking: true };

        const result = filterMatcher.calculateFilterMatch(listing, filters);

        expect(result.matchedFilters).toContain('parking');
      });

      it('should not match parking when not available', () => {
        const listing = createMockListing({ has_parking: false });
        const filters: ExtractedFilters = { has_parking: true };

        const result = filterMatcher.calculateFilterMatch(listing, filters);

        expect(result.unmatchedFilters).toContain('parking');
      });

      it('should match balcony when available', () => {
        const listing = createMockListing({ has_balcony: true });
        const filters: ExtractedFilters = { has_balcony: true };

        const result = filterMatcher.calculateFilterMatch(listing, filters);

        expect(result.matchedFilters).toContain('balcony');
      });

      it('should match furnished when available', () => {
        const listing = createMockListing({ is_furnished: true });
        const filters: ExtractedFilters = { is_furnished: true };

        const result = filterMatcher.calculateFilterMatch(listing, filters);

        expect(result.matchedFilters).toContain('furnished');
      });

      it('should match garage when available', () => {
        const listing = createMockListing({ has_garage: true });
        const filters: ExtractedFilters = { has_garage: true };

        const result = filterMatcher.calculateFilterMatch(listing, filters);

        expect(result.matchedFilters).toContain('garage');
      });
    });

    describe('combined filters', () => {
      it('should calculate weighted score for multiple filters', () => {
        const listing = createMockListing({
          listing_type: 'rent',
          price: 650,
          location_city: 'Zagreb',
          rooms: 2,
          has_parking: true,
        });
        const filters: ExtractedFilters = {
          listing_type: 'rent',
          price_max: 700,
          location: 'Zagreb',
          rooms_min: 2,
          has_parking: true,
        };

        const result = filterMatcher.calculateFilterMatch(listing, filters);

        expect(result.score).toBe(1); // All filters match
        expect(result.matchedFilters).toHaveLength(5);
        expect(result.unmatchedFilters).toHaveLength(0);
      });

      it('should return score of 1 when no filters specified', () => {
        const listing = createMockListing();
        const filters: ExtractedFilters = {};

        const result = filterMatcher.calculateFilterMatch(listing, filters);

        expect(result.score).toBe(1);
      });
    });
  });

  describe('filterByHardRequirements', () => {
    it('should filter out wrong listing types', () => {
      const listings = [
        createMockListing({ id: '1', listing_type: 'rent' }),
        createMockListing({ id: '2', listing_type: 'sale' }),
        createMockListing({ id: '3', listing_type: 'rent' }),
      ];
      const filters: ExtractedFilters = { listing_type: 'rent' };

      const filtered = filterMatcher.filterByHardRequirements(listings, filters);

      expect(filtered).toHaveLength(2);
      expect(filtered.every((l) => l.listing_type === 'rent')).toBe(true);
    });

    it('should filter out listings more than 15% over budget', () => {
      const listings = [
        createMockListing({ id: '1', price: 700 }), // Under budget
        createMockListing({ id: '2', price: 800 }), // ~14% over - allowed
        createMockListing({ id: '3', price: 900 }), // ~29% over - filtered
      ];
      const filters: ExtractedFilters = { price_max: 700 };

      const filtered = filterMatcher.filterByHardRequirements(listings, filters);

      expect(filtered).toHaveLength(2);
      expect(filtered.map((l) => l.id)).toEqual(['1', '2']);
    });

    it('should allow listings within 15% over budget', () => {
      const listings = [createMockListing({ price: 800 })]; // ~14% over 700, within 15% tolerance
      const filters: ExtractedFilters = { price_max: 700 };

      const filtered = filterMatcher.filterByHardRequirements(listings, filters);

      expect(filtered).toHaveLength(1);
    });

    it('should return all listings when no hard filters specified', () => {
      const listings = [
        createMockListing({ id: '1' }),
        createMockListing({ id: '2' }),
        createMockListing({ id: '3' }),
      ];
      const filters: ExtractedFilters = { has_parking: true }; // Not a hard filter

      const filtered = filterMatcher.filterByHardRequirements(listings, filters);

      expect(filtered).toHaveLength(3);
    });
  });

  describe('custom weights', () => {
    it('should use custom weights when provided', () => {
      const customWeightMatcher = new FilterMatcherService({
        price: 2.0, // Double importance
        amenities: 0.5, // Half importance
      });

      const listing = createMockListing({
        price: 800,
        has_parking: false,
      });
      const filters: ExtractedFilters = {
        price_max: 700, // Will not match
        has_parking: true, // Will not match
      };

      const result = customWeightMatcher.calculateFilterMatch(listing, filters);

      // With custom weights, price (2.0) affects score more than amenities (0.5)
      expect(result.totalWeight).toBe(2.5); // 2.0 + 0.5
    });
  });

  describe('createFilterMatcher factory', () => {
    it('should create a FilterMatcherService instance', () => {
      const service = createFilterMatcher();

      expect(service).toBeInstanceOf(FilterMatcherService);
    });

    it('should accept custom weights', () => {
      const service = createFilterMatcher({ price: 2.0 });

      expect(service).toBeInstanceOf(FilterMatcherService);
    });
  });
});
