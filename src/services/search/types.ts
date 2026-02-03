import { Listing } from '@/types/listing';
import { ExtractedFilters } from '@/types/search';

// Search configuration
export interface SearchConfig {
  semanticWeight: number; // Weight for semantic similarity (default: 0.4)
  filterWeight: number; // Weight for filter matching (default: 0.4)
  recencyWeight: number; // Weight for listing recency (default: 0.1)
  freshnessWeight: number; // Weight for data freshness (default: 0.1)
  similarityThreshold: number; // Minimum similarity score (default: 0.5)
  maxResults: number; // Maximum results to return (default: 20)
}

// Default search configuration
export const DEFAULT_SEARCH_CONFIG: SearchConfig = {
  semanticWeight: 0.4,
  filterWeight: 0.4,
  recencyWeight: 0.1,
  freshnessWeight: 0.1,
  similarityThreshold: 0.5,
  maxResults: 20,
};

// Filter importance weights for ranking
export interface FilterImportanceWeights {
  price: number;
  location: number;
  rooms: number;
  listing_type: number;
  property_type: number;
  surface_area: number;
  amenities: number;
}

// Default filter importance weights
export const DEFAULT_FILTER_IMPORTANCE: FilterImportanceWeights = {
  price: 1.5, // Price is most important
  location: 1.3, // Location is second most important
  rooms: 1.2, // Room count matters
  listing_type: 1.1, // Rent vs sale is important
  property_type: 1.0, // Property type is baseline
  surface_area: 1.0, // Surface area is baseline
  amenities: 0.8, // Amenities are nice-to-have
};

// Partial match result
export interface PartialMatch {
  filterName: string;
  expected: string | number | boolean;
  actual: string | number | boolean;
  matchPercentage: number; // 0-1
}

// Filter match result
export interface FilterMatchResult {
  score: number; // 0-1 normalized score
  matchedFilters: string[]; // Names of fully matched filters
  unmatchedFilters: string[]; // Names of unmatched filters
  partialMatches: PartialMatch[]; // Partial matches with percentages
  totalWeight: number; // Total weight of all requested filters
  matchedWeight: number; // Weight of matched filters
}

// Individual ranking scores
export interface RankingScores {
  semanticScore: number; // 0-1, from pgvector similarity
  filterMatchScore: number; // 0-1, from filter matching
  recencyScore: number; // 0-1, based on listing age
  freshnessScore: number; // 0-1, based on last scrape time
  combinedScore: number; // Weighted combination of all scores
}

// Listing with similarity from database
export interface ListingWithSimilarity extends Listing {
  similarity: number;
}

// Ranked listing with full scoring details
export interface RankedListingWithDetails {
  listing: Listing;
  scores: RankingScores;
  matchDetails: FilterMatchResult;
}

// Search result
export interface SearchResult {
  listings: RankedListingWithDetails[];
  totalMatches: number;
  searchTimeMs: number;
  filters: ExtractedFilters;
  queryEmbedding?: number[];
}

// Search error
export class SearchError extends Error {
  constructor(
    message: string,
    public code: 'NO_EMBEDDING' | 'DATABASE_ERROR' | 'INVALID_FILTERS' | 'NO_RESULTS',
    public cause?: Error
  ) {
    super(message);
    this.name = 'SearchError';
  }
}
