-- ============================================================================
-- Migration: Create Database Indexes
-- Created: 2026-01-31
-- Purpose: Create indexes for performance optimization
--
-- Index Types:
-- - HNSW: Vector similarity search (fast queries, slower build)
-- - B-tree: Standard indexes for filtering and sorting
-- - GiST: Geographic/spatial queries
-- - GIN: JSONB queries
-- ============================================================================

-- ============================================================================
-- VECTOR INDEXES (HNSW for Semantic Search)
-- ============================================================================

-- Main listing embedding index for semantic search
-- HNSW provides 15x better query performance than IVFFlat at high recall
-- Trade-off: 32x slower build time (acceptable for dataset size)
-- Parameters:
--   m = 16: Number of connections per layer (default, good balance)
--   ef_construction = 64: Dynamic candidate list size (higher = better quality, slower build)
CREATE INDEX idx_listings_embedding ON listings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

COMMENT ON INDEX idx_listings_embedding IS 'HNSW index for fast cosine similarity search on listing embeddings (15x faster than IVFFlat)';

-- User searches embedding index for finding similar past searches
CREATE INDEX idx_user_searches_embedding ON user_searches
  USING hnsw (query_embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

COMMENT ON INDEX idx_user_searches_embedding IS 'HNSW index for finding similar past searches and query suggestions';

-- ============================================================================
-- B-TREE INDEXES (Filtering and Sorting)
-- ============================================================================

-- Single-column indexes for common filters
CREATE INDEX idx_listings_listing_type ON listings(listing_type);
CREATE INDEX idx_listings_property_type ON listings(property_type);
CREATE INDEX idx_listings_price ON listings(price);
CREATE INDEX idx_listings_location_city ON listings(location_city);
CREATE INDEX idx_listings_scraped_at ON listings(scraped_at DESC);
CREATE INDEX idx_listings_source ON listings(source);

COMMENT ON INDEX idx_listings_listing_type IS 'Filter by rent or sale';
COMMENT ON INDEX idx_listings_property_type IS 'Filter by apartment, house, office, etc.';
COMMENT ON INDEX idx_listings_price IS 'Sort and filter by price';
COMMENT ON INDEX idx_listings_location_city IS 'Filter by city';
COMMENT ON INDEX idx_listings_scraped_at IS 'Sort by recency (most recent first)';
COMMENT ON INDEX idx_listings_source IS 'Filter by source website';

-- ============================================================================
-- COMPOSITE INDEXES (Common Filter Combinations)
-- ============================================================================

-- Index for "rent/sale in [city]" queries (most common)
CREATE INDEX idx_listings_type_city ON listings(listing_type, location_city);

COMMENT ON INDEX idx_listings_type_city IS 'Fast filtering for "rent in Zagreb" or "sale in Split" queries';

-- Index for price range queries with type
CREATE INDEX idx_listings_type_price ON listings(listing_type, price);

COMMENT ON INDEX idx_listings_type_price IS 'Fast filtering for "rent under 1000 EUR" queries';

-- ============================================================================
-- PARTIAL INDEXES (Features)
-- ============================================================================

-- Partial index for listings with specific features
-- Only indexes rows where at least one feature is true (reduces index size)
CREATE INDEX idx_listings_features ON listings(has_parking, has_balcony, is_furnished)
  WHERE has_parking = true OR has_balcony = true OR is_furnished = true;

COMMENT ON INDEX idx_listings_features IS 'Partial index for listings with parking, balcony, or furnished (reduces index size)';

-- Partial index for listings with rooms specified
CREATE INDEX idx_listings_rooms ON listings(rooms)
  WHERE rooms IS NOT NULL;

COMMENT ON INDEX idx_listings_rooms IS 'Index for "2-bedroom apartment" queries (partial to exclude NULL values)';

-- Partial index for listings with bedrooms specified
CREATE INDEX idx_listings_bedrooms ON listings(bedrooms)
  WHERE bedrooms IS NOT NULL;

COMMENT ON INDEX idx_listings_bedrooms IS 'Index for bedroom count queries (partial to exclude NULL values)';

-- Partial index for listings with embeddings (for vector search)
CREATE INDEX idx_listings_has_embedding ON listings(id)
  WHERE embedding IS NOT NULL;

COMMENT ON INDEX idx_listings_has_embedding IS 'Quick check for listings with embeddings generated';

-- ============================================================================
-- GEOGRAPHIC INDEX (GiST for Spatial Queries)
-- ============================================================================

-- GiST index for geographic radius searches
-- Used with ST_DWithin for "listings within 5km of location" queries
CREATE INDEX idx_listings_location ON listings
  USING GIST (location_coordinates);

COMMENT ON INDEX idx_listings_location IS 'GiST index for geographic radius searches using ST_DWithin';

-- ============================================================================
-- JSONB INDEX (GIN for Amenities)
-- ============================================================================

-- GIN index for amenities JSONB column
-- Enables fast queries like: WHERE amenities @> '{"elevator": true}'
CREATE INDEX idx_listings_amenities ON listings
  USING GIN (amenities);

COMMENT ON INDEX idx_listings_amenities IS 'GIN index for fast JSONB queries on amenities (e.g., "elevator", "heating")';

-- ============================================================================
-- TEXT SEARCH INDEX (Optional - for future full-text search)
-- ============================================================================

-- GIN index for full-text search on title and description (optional)
-- Uncomment if implementing full-text search in addition to semantic search
-- CREATE INDEX idx_listings_fulltext ON listings
--   USING GIN (to_tsvector('simple', title || ' ' || description));

-- COMMENT ON INDEX idx_listings_fulltext IS 'Full-text search index on title and description (optional)';

-- ============================================================================
-- ANALYZE TABLES FOR QUERY PLANNER
-- ============================================================================

-- Update statistics for PostgreSQL query planner
-- This helps the query planner choose optimal execution plans
ANALYZE listings;
ANALYZE user_searches;
ANALYZE user_saved_listings;

-- ============================================================================
-- Verification
-- ============================================================================

-- Verify all indexes were created successfully
DO $$
DECLARE
  listings_index_count INTEGER;
  user_searches_index_count INTEGER;
  user_saved_listings_index_count INTEGER;
  total_index_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO listings_index_count
  FROM pg_indexes
  WHERE schemaname = 'public' AND tablename = 'listings';

  SELECT COUNT(*) INTO user_searches_index_count
  FROM pg_indexes
  WHERE schemaname = 'public' AND tablename = 'user_searches';

  SELECT COUNT(*) INTO user_saved_listings_index_count
  FROM pg_indexes
  WHERE schemaname = 'public' AND tablename = 'user_saved_listings';

  total_index_count := listings_index_count + user_searches_index_count + user_saved_listings_index_count;

  RAISE NOTICE 'Index creation complete:';
  RAISE NOTICE '  - listings: % indexes', listings_index_count;
  RAISE NOTICE '  - user_searches: % indexes', user_searches_index_count;
  RAISE NOTICE '  - user_saved_listings: % indexes', user_saved_listings_index_count;
  RAISE NOTICE '  - Total: % indexes', total_index_count;

  IF total_index_count < 20 THEN
    RAISE WARNING 'Expected at least 20 indexes, found %. Some indexes may be missing.', total_index_count;
  END IF;
END $$;

-- ============================================================================
-- Performance Notes
-- ============================================================================

-- HNSW Index Parameters:
-- - Current: m=16, ef_construction=64 (balanced speed/quality)
-- - For larger datasets (millions of listings), consider:
--   - m=32, ef_construction=128 for better recall (slower build, faster search)
-- - Query-time parameter: ef_search (default 40, increase for better recall)
--
-- Index Maintenance:
-- - HNSW indexes don't require REINDEX as often as IVFFlat
-- - Run ANALYZE monthly to update statistics
-- - Monitor index bloat with pg_stat_user_indexes
-- - Consider REINDEX CONCURRENTLY if insert performance degrades
--
-- Memory Usage:
-- - HNSW uses more memory than IVFFlat (~50% more)
-- - Each 1536-dim vector: ~6KB per row with HNSW
-- - For 100k listings: ~600MB for embedding index
