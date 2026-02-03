import { ExtractedFilters } from '@/types/search';
import { PropertyType } from '@/types/listing';
import { searchListingsSemantic, getListings } from '@/lib/db-helpers';
import { EmbeddingService } from '../ai/embedding-service';
import { FilterMatcherService } from './filter-matcher';
import { RankingService } from './ranking-service';
import {
  SearchConfig,
  SearchResult,
  ListingWithSimilarity,
  DEFAULT_SEARCH_CONFIG,
  SearchError,
} from './types';

export class SemanticSearchService {
  private embeddingService: EmbeddingService;
  private filterMatcher: FilterMatcherService;
  private rankingService: RankingService;

  constructor(
    embeddingService: EmbeddingService,
    filterMatcher: FilterMatcherService,
    rankingService: RankingService
  ) {
    this.embeddingService = embeddingService;
    this.filterMatcher = filterMatcher;
    this.rankingService = rankingService;
  }

  /**
   * Perform semantic search with filters and ranking
   */
  async search(
    query: string,
    filters: ExtractedFilters,
    config: Partial<SearchConfig> = {}
  ): Promise<SearchResult> {
    const startTime = Date.now();
    const searchConfig = { ...DEFAULT_SEARCH_CONFIG, ...config };

    try {
      // Generate query embedding
      const embeddingResult = await this.embeddingService.generateQueryEmbedding(query);

      // Execute semantic search with pgvector
      // Fetch more results than needed to allow for filtering
      const semanticResults = await searchListingsSemantic(
        embeddingResult.embedding,
        searchConfig.similarityThreshold,
        searchConfig.maxResults * 3 // Fetch 3x to allow for filtering
      );

      if (!semanticResults || semanticResults.length === 0) {
        // Fallback to filter-only search if no semantic results
        return this.fallbackFilterSearch(filters, searchConfig, startTime);
      }

      // Apply hard filter requirements
      const filteredResults = this.filterMatcher.filterByHardRequirements(
        semanticResults,
        filters
      );

      // Rank the results
      const rankedResults = this.rankingService.rank(
        filteredResults as ListingWithSimilarity[],
        filters,
        searchConfig
      );

      // Return top results
      const topResults = rankedResults.slice(0, searchConfig.maxResults);

      return {
        listings: topResults,
        totalMatches: rankedResults.length,
        searchTimeMs: Date.now() - startTime,
        filters,
        queryEmbedding: embeddingResult.embedding,
      };
    } catch (error) {
      console.error('Semantic search failed:', error);

      // Attempt fallback to filter-only search
      try {
        return this.fallbackFilterSearch(filters, searchConfig, startTime);
      } catch (fallbackError) {
        throw new SearchError(
          'Search failed and fallback also failed',
          'DATABASE_ERROR',
          error as Error
        );
      }
    }
  }

  /**
   * Perform filter-only search without semantic ranking
   * Used as fallback when embedding is not available
   */
  async filterOnlySearch(
    filters: ExtractedFilters,
    config: Partial<SearchConfig> = {}
  ): Promise<SearchResult> {
    const startTime = Date.now();
    const searchConfig = { ...DEFAULT_SEARCH_CONFIG, ...config };

    try {
      // Use getListings with filters
      const listings = await getListings({
        listing_type: filters.listing_type,
        property_type: filters.property_type as PropertyType | undefined,
        price_min: filters.price_min,
        price_max: filters.price_max,
        rooms_min: filters.rooms_min,
        rooms_max: filters.rooms_max,
        location: filters.location,
        has_parking: filters.has_parking,
        has_balcony: filters.has_balcony,
        is_furnished: filters.is_furnished,
        limit: searchConfig.maxResults * 2,
      });

      // Add default similarity score since we don't have embeddings
      const listingsWithSimilarity: ListingWithSimilarity[] = listings.map((l) => ({
        ...l,
        similarity: 0.5, // Neutral score
      }));

      // Rank by filter match only
      const rankedResults = this.rankingService.rank(
        listingsWithSimilarity,
        filters,
        {
          ...searchConfig,
          semanticWeight: 0, // No semantic scoring
          filterWeight: 0.7, // Increase filter weight
          recencyWeight: 0.2,
          freshnessWeight: 0.1,
        }
      );

      return {
        listings: rankedResults.slice(0, searchConfig.maxResults),
        totalMatches: rankedResults.length,
        searchTimeMs: Date.now() - startTime,
        filters,
      };
    } catch (error) {
      throw new SearchError(
        'Filter-only search failed',
        'DATABASE_ERROR',
        error as Error
      );
    }
  }

  /**
   * Fallback search when semantic search fails
   */
  private async fallbackFilterSearch(
    filters: ExtractedFilters,
    config: SearchConfig,
    startTime: number
  ): Promise<SearchResult> {
    console.warn('Falling back to filter-only search');

    const listings = await getListings({
      listing_type: filters.listing_type,
      property_type: filters.property_type as PropertyType | undefined,
      price_min: filters.price_min,
      price_max: filters.price_max,
      rooms_min: filters.rooms_min,
      rooms_max: filters.rooms_max,
      location: filters.location,
      has_parking: filters.has_parking,
      has_balcony: filters.has_balcony,
      is_furnished: filters.is_furnished,
      limit: config.maxResults * 2,
    });

    const listingsWithSimilarity: ListingWithSimilarity[] = listings.map((l) => ({
      ...l,
      similarity: 0.5,
    }));

    const rankedResults = this.rankingService.rank(listingsWithSimilarity, filters, {
      ...config,
      semanticWeight: 0,
      filterWeight: 0.8,
      recencyWeight: 0.15,
      freshnessWeight: 0.05,
    });

    return {
      listings: rankedResults.slice(0, config.maxResults),
      totalMatches: rankedResults.length,
      searchTimeMs: Date.now() - startTime,
      filters,
    };
  }

  /**
   * Find similar listings to a given listing
   */
  async findSimilar(
    listingId: string,
    limit: number = 5
  ): Promise<SearchResult> {
    const startTime = Date.now();

    try {
      // Get the listing's embedding
      const supabaseModule = await import('@/lib/supabase');
      if (!supabaseModule.supabase) {
        throw new SearchError('Database not configured', 'DATABASE_ERROR');
      }

      const { data: listing, error } = await supabaseModule.supabase
        .from('listings')
        .select('*')
        .eq('id', listingId)
        .single();

      if (error || !listing || !listing.embedding) {
        throw new SearchError('Listing not found or has no embedding', 'NO_EMBEDDING');
      }

      // Search for similar listings
      const similarListings = await searchListingsSemantic(
        listing.embedding,
        0.5,
        limit + 1 // +1 to exclude the original listing
      );

      // Filter out the original listing
      const filteredListings = similarListings.filter((l) => l.id !== listingId);

      // Create basic ranking (no filters, just similarity)
      const rankedResults = filteredListings.slice(0, limit).map((l) => ({
        listing: l,
        scores: {
          semanticScore: l.similarity,
          filterMatchScore: 1,
          recencyScore: this.calculateRecencyScore(l.created_at),
          freshnessScore: this.calculateFreshnessScore(l.scraped_at),
          combinedScore: l.similarity,
        },
        matchDetails: {
          score: 1,
          matchedFilters: [],
          unmatchedFilters: [],
          partialMatches: [],
          totalWeight: 0,
          matchedWeight: 0,
        },
      }));

      return {
        listings: rankedResults,
        totalMatches: rankedResults.length,
        searchTimeMs: Date.now() - startTime,
        filters: {},
      };
    } catch (error) {
      if (error instanceof SearchError) throw error;
      throw new SearchError(
        'Failed to find similar listings',
        'DATABASE_ERROR',
        error as Error
      );
    }
  }

  private calculateRecencyScore(createdAt: Date): number {
    const daysSinceCreated =
      (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, 1 - daysSinceCreated / 30);
  }

  private calculateFreshnessScore(scrapedAt: Date): number {
    const hoursSinceScraped =
      (Date.now() - new Date(scrapedAt).getTime()) / (1000 * 60 * 60);
    return Math.max(0, 1 - hoursSinceScraped / 168);
  }
}

// Factory function
export function createSemanticSearch(
  embeddingService: EmbeddingService,
  filterMatcher: FilterMatcherService,
  rankingService: RankingService
): SemanticSearchService {
  return new SemanticSearchService(embeddingService, filterMatcher, rankingService);
}
