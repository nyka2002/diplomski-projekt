/**
 * Redis Cache Service
 *
 * Provides caching utilities for:
 * - Search results (TTL: 1 hour)
 * - Listing details (TTL: 30 minutes)
 * - User session data (TTL: 24 hours)
 * - Embeddings (TTL: 24 hours)
 *
 * Includes cache invalidation and metrics.
 */

import redis from '@/lib/redis';
import crypto from 'crypto';

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

export const CACHE_TTL = {
  SEARCH_RESULTS: 60 * 60,           // 1 hour
  LISTING_DETAILS: 30 * 60,          // 30 minutes
  USER_SESSION: 24 * 60 * 60,        // 24 hours
  EMBEDDINGS: 24 * 60 * 60,          // 24 hours
  CHAT_CONTEXT: 60 * 60,             // 1 hour
  LISTING_COUNT: 5 * 60,             // 5 minutes
};

export const CACHE_KEYS = {
  SEARCH_RESULTS: 'search:results:',
  LISTING: 'listing:',
  USER_SEARCHES: 'user:searches:',
  CHAT_CONTEXT: 'chat:context:',
  LISTING_COUNT: 'listings:count',
  SCRAPE_STATUS: 'scrape:status',
};

// ============================================================================
// CACHE METRICS
// ============================================================================

interface CacheMetrics {
  hits: number;
  misses: number;
  errors: number;
}

const metrics: CacheMetrics = {
  hits: 0,
  misses: 0,
  errors: 0,
};

/**
 * Get current cache metrics
 */
export function getCacheMetrics(): CacheMetrics & { hitRate: number } {
  const total = metrics.hits + metrics.misses;
  return {
    ...metrics,
    hitRate: total > 0 ? metrics.hits / total : 0,
  };
}

/**
 * Reset cache metrics
 */
export function resetCacheMetrics(): void {
  metrics.hits = 0;
  metrics.misses = 0;
  metrics.errors = 0;
}

// ============================================================================
// CORE CACHE OPERATIONS
// ============================================================================

/**
 * Check if Redis is available
 */
export function isCacheAvailable(): boolean {
  return redis !== null;
}

/**
 * Get value from cache
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;

  try {
    const value = await redis.get(key);
    if (value) {
      metrics.hits++;
      return JSON.parse(value) as T;
    }
    metrics.misses++;
    return null;
  } catch (error) {
    metrics.errors++;
    console.error('Cache get error:', error);
    return null;
  }
}

/**
 * Set value in cache
 */
export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<boolean> {
  if (!redis) return false;

  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
    return true;
  } catch (error) {
    metrics.errors++;
    console.error('Cache set error:', error);
    return false;
  }
}

/**
 * Delete value from cache
 */
export async function cacheDelete(key: string): Promise<boolean> {
  if (!redis) return false;

  try {
    await redis.del(key);
    return true;
  } catch (error) {
    metrics.errors++;
    console.error('Cache delete error:', error);
    return false;
  }
}

/**
 * Delete multiple keys by pattern
 */
export async function cacheDeletePattern(pattern: string): Promise<number> {
  if (!redis) return 0;

  try {
    const keys = await redis.keys(pattern);
    if (keys.length === 0) return 0;

    const deleted = await redis.del(...keys);
    return deleted;
  } catch (error) {
    metrics.errors++;
    console.error('Cache delete pattern error:', error);
    return 0;
  }
}

// ============================================================================
// SEARCH RESULTS CACHE
// ============================================================================

interface CachedSearchResult<T = object> {
  listings: unknown[];
  totalMatches: number;
  filters: T;
  cachedAt: number;
}

/**
 * Generate cache key for search query
 */
export function generateSearchCacheKey<T extends object>(
  query: string,
  filters: T,
  userId?: string
): string {
  const normalizedQuery = query.toLowerCase().trim();
  const sortedFilters = JSON.stringify(
    Object.keys(filters)
      .sort()
      .reduce((acc, key) => ({ ...acc, [key]: (filters as Record<string, unknown>)[key] }), {})
  );

  const hash = crypto
    .createHash('md5')
    .update(`${normalizedQuery}:${sortedFilters}:${userId || 'anon'}`)
    .digest('hex');

  return `${CACHE_KEYS.SEARCH_RESULTS}${hash}`;
}

/**
 * Get cached search results
 */
export async function getCachedSearchResults<T extends object>(
  query: string,
  filters: T,
  userId?: string
): Promise<CachedSearchResult<T> | null> {
  const key = generateSearchCacheKey(query, filters, userId);
  return cacheGet<CachedSearchResult<T>>(key);
}

/**
 * Cache search results
 */
export async function cacheSearchResults<T extends object>(
  query: string,
  filters: T,
  listings: unknown[],
  totalMatches: number,
  userId?: string
): Promise<boolean> {
  const key = generateSearchCacheKey(query, filters, userId);
  const data: CachedSearchResult<T> = {
    listings,
    totalMatches,
    filters,
    cachedAt: Date.now(),
  };

  return cacheSet(key, data, CACHE_TTL.SEARCH_RESULTS);
}

// ============================================================================
// LISTING CACHE
// ============================================================================

/**
 * Get cached listing
 */
export async function getCachedListing<T>(listingId: string): Promise<T | null> {
  const key = `${CACHE_KEYS.LISTING}${listingId}`;
  return cacheGet<T>(key);
}

/**
 * Cache listing
 */
export async function cacheListing(
  listingId: string,
  listing: unknown
): Promise<boolean> {
  const key = `${CACHE_KEYS.LISTING}${listingId}`;
  return cacheSet(key, listing, CACHE_TTL.LISTING_DETAILS);
}

/**
 * Invalidate listing cache
 */
export async function invalidateListingCache(listingId: string): Promise<boolean> {
  const key = `${CACHE_KEYS.LISTING}${listingId}`;
  return cacheDelete(key);
}

/**
 * Invalidate all listing caches
 */
export async function invalidateAllListingCaches(): Promise<number> {
  return cacheDeletePattern(`${CACHE_KEYS.LISTING}*`);
}

// ============================================================================
// CHAT CONTEXT CACHE
// ============================================================================

interface CachedChatContext {
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }>;
  currentFilters?: Record<string, unknown>;
  lastSearchResults?: string[];
  sessionStartTime: Date;
  turnCount: number;
}

/**
 * Get cached chat context
 */
export async function getCachedChatContext(
  sessionId: string
): Promise<CachedChatContext | null> {
  const key = `${CACHE_KEYS.CHAT_CONTEXT}${sessionId}`;
  return cacheGet<CachedChatContext>(key);
}

/**
 * Cache chat context
 */
export async function cacheChatContext(
  sessionId: string,
  context: CachedChatContext
): Promise<boolean> {
  const key = `${CACHE_KEYS.CHAT_CONTEXT}${sessionId}`;
  return cacheSet(key, context, CACHE_TTL.CHAT_CONTEXT);
}

/**
 * Delete chat context
 */
export async function deleteChatContext(sessionId: string): Promise<boolean> {
  const key = `${CACHE_KEYS.CHAT_CONTEXT}${sessionId}`;
  return cacheDelete(key);
}

// ============================================================================
// CACHE INVALIDATION ON SCRAPE
// ============================================================================

/**
 * Invalidate caches after new scrape completes
 * Call this after successful scraping jobs
 */
export async function invalidateCachesOnScrape(): Promise<{
  searchResultsCleared: number;
  listingsCacheCleared: number;
  countCacheCleared: boolean;
}> {
  const [searchResultsCleared, listingsCacheCleared, countCacheCleared] = await Promise.all([
    cacheDeletePattern(`${CACHE_KEYS.SEARCH_RESULTS}*`),
    cacheDeletePattern(`${CACHE_KEYS.LISTING}*`),
    cacheDelete(CACHE_KEYS.LISTING_COUNT),
  ]);

  console.log(
    `Cache invalidated: ${searchResultsCleared} search results, ${listingsCacheCleared} listings`
  );

  return {
    searchResultsCleared,
    listingsCacheCleared,
    countCacheCleared,
  };
}

// ============================================================================
// SCRAPE STATUS CACHE
// ============================================================================

interface ScrapeStatus {
  lastScrapeAt: number;
  source: string;
  listingsAdded: number;
  listingsUpdated: number;
  duration: number;
}

/**
 * Get last scrape status
 */
export async function getLastScrapeStatus(): Promise<ScrapeStatus | null> {
  return cacheGet<ScrapeStatus>(CACHE_KEYS.SCRAPE_STATUS);
}

/**
 * Update scrape status
 */
export async function updateScrapeStatus(status: Omit<ScrapeStatus, 'lastScrapeAt'>): Promise<boolean> {
  const data: ScrapeStatus = {
    ...status,
    lastScrapeAt: Date.now(),
  };
  // Keep for 7 days
  return cacheSet(CACHE_KEYS.SCRAPE_STATUS, data, 7 * 24 * 60 * 60);
}

// ============================================================================
// LISTING COUNT CACHE
// ============================================================================

/**
 * Get cached listing count
 */
export async function getCachedListingCount(): Promise<number | null> {
  return cacheGet<number>(CACHE_KEYS.LISTING_COUNT);
}

/**
 * Cache listing count
 */
export async function cacheListingCount(count: number): Promise<boolean> {
  return cacheSet(CACHE_KEYS.LISTING_COUNT, count, CACHE_TTL.LISTING_COUNT);
}
