// Types
export * from './types';

// Services
export { FilterMatcherService, createFilterMatcher } from './filter-matcher';
export { RankingService, createRankingService } from './ranking-service';
export { SemanticSearchService, createSemanticSearch } from './semantic-search';

// Factory function to create all search services
import { createFilterMatcher } from './filter-matcher';
import { createRankingService } from './ranking-service';
import { createSemanticSearch } from './semantic-search';
import { EmbeddingService } from '../ai/embedding-service';
import { FilterImportanceWeights } from './types';

export interface SearchServices {
  filterMatcher: ReturnType<typeof createFilterMatcher>;
  ranking: ReturnType<typeof createRankingService>;
  semantic: ReturnType<typeof createSemanticSearch>;
}

/**
 * Create all search services
 */
export function createSearchServices(
  embeddingService: EmbeddingService,
  filterWeights?: Partial<FilterImportanceWeights>
): SearchServices {
  const filterMatcher = createFilterMatcher(filterWeights);
  const ranking = createRankingService(filterMatcher);
  const semantic = createSemanticSearch(embeddingService, filterMatcher, ranking);

  return {
    filterMatcher,
    ranking,
    semantic,
  };
}
