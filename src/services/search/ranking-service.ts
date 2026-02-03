import { ExtractedFilters } from '@/types/search';
import { FilterMatcherService } from './filter-matcher';
import {
  SearchConfig,
  RankedListingWithDetails,
  ListingWithSimilarity,
  DEFAULT_SEARCH_CONFIG,
} from './types';

export class RankingService {
  private filterMatcher: FilterMatcherService;

  constructor(filterMatcher: FilterMatcherService) {
    this.filterMatcher = filterMatcher;
  }

  /**
   * Rank listings using multi-factor scoring
   */
  rank(
    listings: ListingWithSimilarity[],
    filters: ExtractedFilters,
    config: Partial<SearchConfig> = {}
  ): RankedListingWithDetails[] {
    const cfg = { ...DEFAULT_SEARCH_CONFIG, ...config };

    const rankedListings = listings.map((listing) => {
      // Calculate filter match score
      const matchDetails = this.filterMatcher.calculateFilterMatch(listing, filters);

      // Calculate recency score (how new the listing is)
      const recencyScore = this.calculateRecencyScore(listing.created_at);

      // Calculate freshness score (how recently it was scraped)
      const freshnessScore = this.calculateFreshnessScore(listing.scraped_at);

      // Calculate combined score
      const combinedScore =
        cfg.semanticWeight * listing.similarity +
        cfg.filterWeight * matchDetails.score +
        cfg.recencyWeight * recencyScore +
        cfg.freshnessWeight * freshnessScore;

      return {
        listing,
        scores: {
          semanticScore: listing.similarity,
          filterMatchScore: matchDetails.score,
          recencyScore,
          freshnessScore,
          combinedScore,
        },
        matchDetails,
      };
    });

    // Sort by combined score (descending)
    return rankedListings.sort((a, b) => b.scores.combinedScore - a.scores.combinedScore);
  }

  /**
   * Re-rank existing results with new filters or weights
   */
  rerank(
    results: RankedListingWithDetails[],
    filters: ExtractedFilters,
    config: Partial<SearchConfig> = {}
  ): RankedListingWithDetails[] {
    const cfg = { ...DEFAULT_SEARCH_CONFIG, ...config };

    return results
      .map((result) => {
        // Recalculate filter match with new filters
        const matchDetails = this.filterMatcher.calculateFilterMatch(result.listing, filters);

        // Recalculate combined score
        const combinedScore =
          cfg.semanticWeight * result.scores.semanticScore +
          cfg.filterWeight * matchDetails.score +
          cfg.recencyWeight * result.scores.recencyScore +
          cfg.freshnessWeight * result.scores.freshnessScore;

        return {
          ...result,
          scores: {
            ...result.scores,
            filterMatchScore: matchDetails.score,
            combinedScore,
          },
          matchDetails,
        };
      })
      .sort((a, b) => b.scores.combinedScore - a.scores.combinedScore);
  }

  /**
   * Calculate recency score based on listing creation date
   * Newer listings get higher scores
   * Score decays linearly over 30 days
   */
  private calculateRecencyScore(createdAt: Date): number {
    const daysSinceCreated =
      (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);

    // Full score for listings < 1 day old
    if (daysSinceCreated < 1) return 1;

    // Linear decay over 30 days
    const score = 1 - daysSinceCreated / 30;
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate freshness score based on last scrape time
   * More recently scraped listings have more reliable data
   * Score decays linearly over 7 days (168 hours)
   */
  private calculateFreshnessScore(scrapedAt: Date): number {
    const hoursSinceScraped =
      (Date.now() - new Date(scrapedAt).getTime()) / (1000 * 60 * 60);

    // Full score for listings scraped < 1 hour ago
    if (hoursSinceScraped < 1) return 1;

    // Linear decay over 168 hours (7 days)
    const score = 1 - hoursSinceScraped / 168;
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Explain the ranking for a single listing
   * Useful for debugging and transparency
   */
  explainRanking(result: RankedListingWithDetails): string {
    const { scores, matchDetails } = result;
    const lines: string[] = [];

    lines.push(`Ranking Explanation for "${result.listing.title}"`);
    lines.push('='.repeat(50));
    lines.push('');

    lines.push('Score Breakdown:');
    lines.push(`  Semantic Similarity: ${(scores.semanticScore * 100).toFixed(1)}%`);
    lines.push(`  Filter Match: ${(scores.filterMatchScore * 100).toFixed(1)}%`);
    lines.push(`  Recency: ${(scores.recencyScore * 100).toFixed(1)}%`);
    lines.push(`  Freshness: ${(scores.freshnessScore * 100).toFixed(1)}%`);
    lines.push(`  Combined Score: ${(scores.combinedScore * 100).toFixed(1)}%`);
    lines.push('');

    lines.push('Filter Matches:');
    if (matchDetails.matchedFilters.length > 0) {
      lines.push(`  Matched: ${matchDetails.matchedFilters.join(', ')}`);
    }
    if (matchDetails.unmatchedFilters.length > 0) {
      lines.push(`  Unmatched: ${matchDetails.unmatchedFilters.join(', ')}`);
    }
    if (matchDetails.partialMatches.length > 0) {
      lines.push('  Partial Matches:');
      for (const pm of matchDetails.partialMatches) {
        lines.push(
          `    - ${pm.filterName}: expected ${pm.expected}, got ${pm.actual} (${(pm.matchPercentage * 100).toFixed(0)}% match)`
        );
      }
    }

    return lines.join('\n');
  }

  /**
   * Get summary statistics for a set of rankings
   */
  getRankingStats(results: RankedListingWithDetails[]): {
    avgCombinedScore: number;
    avgSemanticScore: number;
    avgFilterScore: number;
    topMatchingFilters: Record<string, number>;
    scoreDistribution: { min: number; max: number; median: number };
  } {
    if (results.length === 0) {
      return {
        avgCombinedScore: 0,
        avgSemanticScore: 0,
        avgFilterScore: 0,
        topMatchingFilters: {},
        scoreDistribution: { min: 0, max: 0, median: 0 },
      };
    }

    const combinedScores = results.map((r) => r.scores.combinedScore);
    const semanticScores = results.map((r) => r.scores.semanticScore);
    const filterScores = results.map((r) => r.scores.filterMatchScore);

    // Count filter matches
    const filterCounts: Record<string, number> = {};
    for (const result of results) {
      for (const filter of result.matchDetails.matchedFilters) {
        filterCounts[filter] = (filterCounts[filter] || 0) + 1;
      }
    }

    // Sort and get top filters
    const topFilters = Object.entries(filterCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .reduce(
        (acc, [key, value]) => {
          acc[key] = value;
          return acc;
        },
        {} as Record<string, number>
      );

    // Calculate median
    const sortedScores = [...combinedScores].sort((a, b) => a - b);
    const median =
      sortedScores.length % 2 === 0
        ? (sortedScores[sortedScores.length / 2 - 1] + sortedScores[sortedScores.length / 2]) / 2
        : sortedScores[Math.floor(sortedScores.length / 2)];

    return {
      avgCombinedScore: this.average(combinedScores),
      avgSemanticScore: this.average(semanticScores),
      avgFilterScore: this.average(filterScores),
      topMatchingFilters: topFilters,
      scoreDistribution: {
        min: Math.min(...combinedScores),
        max: Math.max(...combinedScores),
        median,
      },
    };
  }

  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }
}

// Factory function
export function createRankingService(filterMatcher: FilterMatcherService): RankingService {
  return new RankingService(filterMatcher);
}
