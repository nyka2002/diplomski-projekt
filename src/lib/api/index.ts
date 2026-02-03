/**
 * API Utilities
 *
 * Re-exports all API-related utilities including:
 * - Middleware (auth, rate limiting, error handling, logging)
 * - Cache (Redis caching utilities)
 * - Response helpers
 */

// Middleware
export {
  // Types
  type AuthenticatedUser,
  type RequestContext,
  type MiddlewareResult,

  // Authentication
  authenticateRequest,
  requireAuth,
  optionalAuth,

  // Rate limiting
  checkRateLimit,
  applyRateLimit,

  // Error handling
  ApiError,
  handleApiError,

  // Logging
  logRequest,
  logResponse,

  // Response helpers
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,

  // Utilities
  parsePaginationParams,
  addResponseHeaders,
} from './middleware';

// Cache
export {
  // Configuration
  CACHE_TTL,
  CACHE_KEYS,

  // Metrics
  getCacheMetrics,
  resetCacheMetrics,

  // Core operations
  isCacheAvailable,
  cacheGet,
  cacheSet,
  cacheDelete,
  cacheDeletePattern,

  // Search results cache
  generateSearchCacheKey,
  getCachedSearchResults,
  cacheSearchResults,

  // Listing cache
  getCachedListing,
  cacheListing,
  invalidateListingCache,
  invalidateAllListingCaches,

  // Chat context cache
  getCachedChatContext,
  cacheChatContext,
  deleteChatContext,

  // Scrape-related cache
  invalidateCachesOnScrape,
  getLastScrapeStatus,
  updateScrapeStatus,

  // Listing count cache
  getCachedListingCount,
  cacheListingCount,
} from './cache';
