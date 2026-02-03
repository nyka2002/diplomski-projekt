import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RankingService, createRankingService } from '@/services/search/ranking-service';
import { FilterMatcherService } from '@/services/search/filter-matcher';
import { createMockListing } from '../../../fixtures/listings';
import { ListingWithSimilarity, RankedListingWithDetails } from '@/services/search/types';
import { ExtractedFilters } from '@/types/search';

describe('RankingService', () => {
  let rankingService: RankingService;
  let filterMatcher: FilterMatcherService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-02T12:00:00Z'));
    filterMatcher = new FilterMatcherService();
    rankingService = new RankingService(filterMatcher);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createListingWithSimilarity = (
    overrides: Partial<ReturnType<typeof createMockListing>> & { similarity: number }
  ): ListingWithSimilarity => {
    const { similarity, ...listingOverrides } = overrides;
    const listing = createMockListing(listingOverrides);
    return {
      ...listing,
      similarity,
    } as ListingWithSimilarity;
  };

  describe('rank', () => {
    it('should rank listings by combined score', () => {
      const listings: ListingWithSimilarity[] = [
        createListingWithSimilarity({
          id: '1',
          similarity: 0.5,
          listing_type: 'rent',
          created_at: new Date('2026-02-01').toISOString(),
          scraped_at: new Date('2026-02-02').toISOString(),
        }),
        createListingWithSimilarity({
          id: '2',
          similarity: 0.9,
          listing_type: 'rent',
          created_at: new Date('2026-02-01').toISOString(),
          scraped_at: new Date('2026-02-02').toISOString(),
        }),
        createListingWithSimilarity({
          id: '3',
          similarity: 0.7,
          listing_type: 'rent',
          created_at: new Date('2026-02-01').toISOString(),
          scraped_at: new Date('2026-02-02').toISOString(),
        }),
      ];

      const filters: ExtractedFilters = { listing_type: 'rent' };

      const ranked = rankingService.rank(listings, filters);

      // Higher similarity should rank higher (all else equal)
      expect(ranked[0].listing.id).toBe('2');
      expect(ranked[1].listing.id).toBe('3');
      expect(ranked[2].listing.id).toBe('1');
    });

    it('should include all score components', () => {
      const listing = createListingWithSimilarity({
        similarity: 0.8,
        listing_type: 'rent',
        created_at: new Date('2026-02-01').toISOString(),
        scraped_at: new Date('2026-02-02').toISOString(),
      });

      const ranked = rankingService.rank([listing], { listing_type: 'rent' });

      expect(ranked[0].scores).toHaveProperty('semanticScore');
      expect(ranked[0].scores).toHaveProperty('filterMatchScore');
      expect(ranked[0].scores).toHaveProperty('recencyScore');
      expect(ranked[0].scores).toHaveProperty('freshnessScore');
      expect(ranked[0].scores).toHaveProperty('combinedScore');
    });

    it('should include match details', () => {
      const listing = createListingWithSimilarity({
        similarity: 0.8,
        listing_type: 'rent',
        price: 650,
        created_at: new Date().toISOString(),
        scraped_at: new Date().toISOString(),
      });

      const ranked = rankingService.rank([listing], {
        listing_type: 'rent',
        price_max: 700,
      });

      expect(ranked[0].matchDetails).toHaveProperty('matchedFilters');
      expect(ranked[0].matchDetails).toHaveProperty('unmatchedFilters');
      expect(ranked[0].matchDetails).toHaveProperty('score');
    });

    it('should give higher scores to newer listings', () => {
      const oldListing = createListingWithSimilarity({
        id: 'old',
        similarity: 0.8,
        listing_type: 'rent',
        created_at: new Date('2026-01-01').toISOString(), // ~32 days old
        scraped_at: new Date('2026-02-02').toISOString(),
      });

      const newListing = createListingWithSimilarity({
        id: 'new',
        similarity: 0.8,
        listing_type: 'rent',
        created_at: new Date('2026-02-01').toISOString(), // 1 day old
        scraped_at: new Date('2026-02-02').toISOString(),
      });

      const ranked = rankingService.rank([oldListing, newListing], { listing_type: 'rent' });

      expect(ranked[0].listing.id).toBe('new');
      expect(ranked[0].scores.recencyScore).toBeGreaterThan(ranked[1].scores.recencyScore);
    });

    it('should give higher freshness scores to recently scraped listings', () => {
      const staleListing = createListingWithSimilarity({
        id: 'stale',
        similarity: 0.8,
        listing_type: 'rent',
        created_at: new Date('2026-02-01').toISOString(),
        scraped_at: new Date('2026-01-20').toISOString(), // ~13 days ago
      });

      const freshListing = createListingWithSimilarity({
        id: 'fresh',
        similarity: 0.8,
        listing_type: 'rent',
        created_at: new Date('2026-02-01').toISOString(),
        scraped_at: new Date('2026-02-02T10:00:00Z').toISOString(), // 2 hours ago
      });

      const ranked = rankingService.rank([staleListing, freshListing], {
        listing_type: 'rent',
      });

      expect(ranked[0].listing.id).toBe('fresh');
      expect(ranked[0].scores.freshnessScore).toBeGreaterThan(
        ranked[1].scores.freshnessScore
      );
    });

    it('should apply custom config weights', () => {
      const listings: ListingWithSimilarity[] = [
        createListingWithSimilarity({
          id: '1',
          similarity: 0.9, // High semantic
          listing_type: 'sale', // Doesn't match filter
          created_at: new Date().toISOString(),
          scraped_at: new Date().toISOString(),
        }),
        createListingWithSimilarity({
          id: '2',
          similarity: 0.5, // Lower semantic
          listing_type: 'rent', // Matches filter
          created_at: new Date().toISOString(),
          scraped_at: new Date().toISOString(),
        }),
      ];

      // With high filter weight, the matching listing should rank higher
      const ranked = rankingService.rank(listings, { listing_type: 'rent' }, {
        semanticWeight: 0.1,
        filterWeight: 0.8,
        recencyWeight: 0.05,
        freshnessWeight: 0.05,
      });

      expect(ranked[0].listing.id).toBe('2');
    });
  });

  describe('rerank', () => {
    it('should rerank results with new filters', () => {
      const initialResults: RankedListingWithDetails[] = [
        {
          listing: createListingWithSimilarity({
            id: '1',
            similarity: 0.9,
            listing_type: 'rent',
            price: 800,
            created_at: new Date().toISOString(),
            scraped_at: new Date().toISOString(),
          }),
          scores: {
            semanticScore: 0.9,
            filterMatchScore: 1,
            recencyScore: 1,
            freshnessScore: 1,
            combinedScore: 0.9,
          },
          matchDetails: {
            score: 1,
            matchedFilters: ['listing_type'],
            unmatchedFilters: [],
            partialMatches: [],
            totalWeight: 1.1,
            matchedWeight: 1.1,
          },
        },
        {
          listing: createListingWithSimilarity({
            id: '2',
            similarity: 0.7,
            listing_type: 'rent',
            price: 600,
            created_at: new Date().toISOString(),
            scraped_at: new Date().toISOString(),
          }),
          scores: {
            semanticScore: 0.7,
            filterMatchScore: 1,
            recencyScore: 1,
            freshnessScore: 1,
            combinedScore: 0.7,
          },
          matchDetails: {
            score: 1,
            matchedFilters: ['listing_type'],
            unmatchedFilters: [],
            partialMatches: [],
            totalWeight: 1.1,
            matchedWeight: 1.1,
          },
        },
      ];

      // Add price filter - listing 2 should now rank higher
      const reranked = rankingService.rerank(initialResults, {
        listing_type: 'rent',
        price_max: 650,
      });

      // Listing 2 (price 600) matches price filter, listing 1 (price 800) doesn't
      expect(reranked[0].listing.id).toBe('2');
    });

    it('should preserve semantic scores during rerank', () => {
      const initialResults: RankedListingWithDetails[] = [
        {
          listing: createListingWithSimilarity({
            id: '1',
            similarity: 0.85,
            created_at: new Date().toISOString(),
            scraped_at: new Date().toISOString(),
          }),
          scores: {
            semanticScore: 0.85,
            filterMatchScore: 0.5,
            recencyScore: 0.9,
            freshnessScore: 0.9,
            combinedScore: 0.7,
          },
          matchDetails: {
            score: 0.5,
            matchedFilters: [],
            unmatchedFilters: [],
            partialMatches: [],
            totalWeight: 0,
            matchedWeight: 0,
          },
        },
      ];

      const reranked = rankingService.rerank(initialResults, {});

      expect(reranked[0].scores.semanticScore).toBe(0.85);
    });
  });

  describe('recency score calculation', () => {
    it('should return 1 for listings less than 1 day old', () => {
      const listing = createListingWithSimilarity({
        similarity: 0.8,
        created_at: new Date('2026-02-02T06:00:00Z').toISOString(), // 6 hours old
        scraped_at: new Date().toISOString(),
      });

      const ranked = rankingService.rank([listing], {});

      expect(ranked[0].scores.recencyScore).toBe(1);
    });

    it('should decay linearly over 30 days', () => {
      const listing15DaysOld = createListingWithSimilarity({
        similarity: 0.8,
        created_at: new Date('2026-01-18T12:00:00Z').toISOString(), // 15 days old
        scraped_at: new Date().toISOString(),
      });

      const ranked = rankingService.rank([listing15DaysOld], {});

      // After 15 days, score should be around 0.5
      expect(ranked[0].scores.recencyScore).toBeCloseTo(0.5, 1);
    });

    it('should return 0 for listings older than 30 days', () => {
      const listing35DaysOld = createListingWithSimilarity({
        similarity: 0.8,
        created_at: new Date('2025-12-29T12:00:00Z').toISOString(), // 35 days old
        scraped_at: new Date().toISOString(),
      });

      const ranked = rankingService.rank([listing35DaysOld], {});

      expect(ranked[0].scores.recencyScore).toBe(0);
    });
  });

  describe('freshness score calculation', () => {
    it('should return 1 for listings scraped less than 1 hour ago', () => {
      const listing = createListingWithSimilarity({
        similarity: 0.8,
        created_at: new Date().toISOString(),
        scraped_at: new Date('2026-02-02T11:30:00Z').toISOString(), // 30 minutes ago
      });

      const ranked = rankingService.rank([listing], {});

      expect(ranked[0].scores.freshnessScore).toBe(1);
    });

    it('should decay linearly over 168 hours (7 days)', () => {
      const listing84HoursOld = createListingWithSimilarity({
        similarity: 0.8,
        created_at: new Date().toISOString(),
        scraped_at: new Date('2026-01-30T00:00:00Z').toISOString(), // 84 hours before 2026-02-02T12:00:00Z
      });

      const ranked = rankingService.rank([listing84HoursOld], {});

      // After 84 hours (half of 168), score should be around 0.5
      expect(ranked[0].scores.freshnessScore).toBeCloseTo(0.5, 1);
    });

    it('should return 0 for listings scraped more than 7 days ago', () => {
      const listing10DaysOld = createListingWithSimilarity({
        similarity: 0.8,
        created_at: new Date().toISOString(),
        scraped_at: new Date('2026-01-20T12:00:00Z').toISOString(), // ~13 days ago
      });

      const ranked = rankingService.rank([listing10DaysOld], {});

      expect(ranked[0].scores.freshnessScore).toBe(0);
    });
  });

  describe('explainRanking', () => {
    it('should return a human-readable explanation', () => {
      const result: RankedListingWithDetails = {
        listing: createListingWithSimilarity({
          title: 'Test Stan',
          similarity: 0.85,
          created_at: new Date().toISOString(),
          scraped_at: new Date().toISOString(),
        }),
        scores: {
          semanticScore: 0.85,
          filterMatchScore: 0.9,
          recencyScore: 0.95,
          freshnessScore: 0.98,
          combinedScore: 0.88,
        },
        matchDetails: {
          score: 0.9,
          matchedFilters: ['listing_type', 'price_max'],
          unmatchedFilters: ['has_parking'],
          partialMatches: [
            { filterName: 'rooms_min', expected: 3, actual: 2, matchPercentage: 0.7 },
          ],
          totalWeight: 5,
          matchedWeight: 4.5,
        },
      };

      const explanation = rankingService.explainRanking(result);

      expect(explanation).toContain('Test Stan');
      expect(explanation).toContain('Semantic Similarity');
      expect(explanation).toContain('Filter Match');
      expect(explanation).toContain('Matched: listing_type, price_max');
      expect(explanation).toContain('Unmatched: has_parking');
      expect(explanation).toContain('rooms_min');
    });
  });

  describe('getRankingStats', () => {
    it('should return aggregate statistics', () => {
      const results: RankedListingWithDetails[] = [
        {
          listing: createMockListing() as ListingWithSimilarity,
          scores: {
            semanticScore: 0.9,
            filterMatchScore: 0.8,
            recencyScore: 1,
            freshnessScore: 1,
            combinedScore: 0.85,
          },
          matchDetails: {
            score: 0.8,
            matchedFilters: ['listing_type', 'price_max'],
            unmatchedFilters: [],
            partialMatches: [],
            totalWeight: 2.6,
            matchedWeight: 2.6,
          },
        },
        {
          listing: createMockListing() as ListingWithSimilarity,
          scores: {
            semanticScore: 0.7,
            filterMatchScore: 0.6,
            recencyScore: 0.8,
            freshnessScore: 0.9,
            combinedScore: 0.65,
          },
          matchDetails: {
            score: 0.6,
            matchedFilters: ['listing_type'],
            unmatchedFilters: ['price_max'],
            partialMatches: [],
            totalWeight: 2.6,
            matchedWeight: 1.1,
          },
        },
      ];

      const stats = rankingService.getRankingStats(results);

      expect(stats.avgCombinedScore).toBeCloseTo(0.75, 2);
      expect(stats.avgSemanticScore).toBeCloseTo(0.8, 2);
      expect(stats.avgFilterScore).toBeCloseTo(0.7, 2);
      expect(stats.topMatchingFilters).toHaveProperty('listing_type', 2);
      expect(stats.scoreDistribution.min).toBe(0.65);
      expect(stats.scoreDistribution.max).toBe(0.85);
      expect(stats.scoreDistribution.median).toBe(0.75);
    });

    it('should handle empty results', () => {
      const stats = rankingService.getRankingStats([]);

      expect(stats.avgCombinedScore).toBe(0);
      expect(stats.avgSemanticScore).toBe(0);
      expect(stats.avgFilterScore).toBe(0);
      expect(stats.topMatchingFilters).toEqual({});
    });
  });

  describe('createRankingService factory', () => {
    it('should create a RankingService instance', () => {
      const service = createRankingService(filterMatcher);

      expect(service).toBeInstanceOf(RankingService);
    });
  });
});
