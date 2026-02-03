-- ============================================================================
-- Migration: Create Database Helper Functions
-- Created: 2026-01-31
-- Purpose: PostgreSQL functions for common operations
--
-- Functions:
-- 1. search_listings_semantic - Vector similarity search
-- 2. search_listings_nearby - Geographic radius search
-- 3. get_user_search_stats - User search analytics
-- 4. is_listing_saved - Check if user saved a listing
-- 5. find_similar_listings - Find similar properties
-- 6. update_listing_embedding - Update embedding
-- 7. get_fresh_listings - Get recent scrapes
-- 8. cleanup_old_searches - Data retention
-- 9. cleanup_stale_listings - Remove outdated listings
-- ============================================================================

-- ============================================================================
-- 1. SEMANTIC SEARCH FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION search_listings_semantic(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  price NUMERIC,
  listing_type listing_type_enum,
  property_type property_type_enum,
  location_city TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.title,
    l.description,
    l.price,
    l.listing_type,
    l.property_type,
    l.location_city,
    1 - (l.embedding <=> query_embedding) AS similarity
  FROM listings l
  WHERE l.embedding IS NOT NULL
    AND 1 - (l.embedding <=> query_embedding) > match_threshold
  ORDER BY l.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION search_listings_semantic IS 'Semantic search using cosine similarity on embeddings. Returns listings ranked by similarity to query embedding.';

-- ============================================================================
-- 2. GEOGRAPHIC RADIUS SEARCH FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION search_listings_nearby(
  search_lat FLOAT,
  search_lng FLOAT,
  radius_meters INT DEFAULT 5000,
  match_count INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  price NUMERIC,
  location_city TEXT,
  location_address TEXT,
  distance_meters FLOAT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  search_point GEOGRAPHY;
BEGIN
  -- Create geography point from lat/lng (lng comes first in PostGIS)
  search_point := ST_MakePoint(search_lng, search_lat)::geography;

  RETURN QUERY
  SELECT
    l.id,
    l.title,
    l.price,
    l.location_city,
    l.location_address,
    ST_Distance(l.location_coordinates, search_point)::FLOAT AS distance_meters
  FROM listings l
  WHERE l.location_coordinates IS NOT NULL
    AND ST_DWithin(l.location_coordinates, search_point, radius_meters)
  ORDER BY l.location_coordinates <-> search_point
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION search_listings_nearby IS 'Geographic radius search. Returns listings within specified distance from coordinates, sorted by distance.';

-- ============================================================================
-- 3. USER SEARCH STATISTICS FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_search_stats(search_user_id UUID)
RETURNS TABLE (
  total_searches BIGINT,
  most_common_city TEXT,
  avg_price_max NUMERIC,
  most_searched_listing_type listing_type_enum
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_searches,
    MODE() WITHIN GROUP (ORDER BY (extracted_filters->>'location')::TEXT) AS most_common_city,
    AVG((extracted_filters->>'price_max')::NUMERIC) AS avg_price_max,
    MODE() WITHIN GROUP (ORDER BY (extracted_filters->>'listing_type')::listing_type_enum) AS most_searched_listing_type
  FROM user_searches
  WHERE user_id = search_user_id;
END;
$$;

COMMENT ON FUNCTION get_user_search_stats IS 'Get aggregated statistics about user search patterns for analytics and personalization.';

-- ============================================================================
-- 4. CHECK IF LISTING IS SAVED FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION is_listing_saved(
  check_user_id UUID,
  check_listing_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_saved_listings
    WHERE user_id = check_user_id
      AND listing_id = check_listing_id
  );
$$;

COMMENT ON FUNCTION is_listing_saved IS 'Check if a user has saved/favorited a specific listing. Returns true if saved, false otherwise.';

-- ============================================================================
-- 5. FIND SIMILAR LISTINGS FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION find_similar_listings(
  base_listing_id UUID,
  similarity_threshold FLOAT DEFAULT 0.8,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  price NUMERIC,
  similarity FLOAT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  base_embedding VECTOR(1536);
BEGIN
  -- Get the embedding of the base listing
  SELECT embedding INTO base_embedding
  FROM listings
  WHERE id = base_listing_id;

  IF base_embedding IS NULL THEN
    RAISE EXCEPTION 'Listing not found or has no embedding: %', base_listing_id;
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.title,
    l.price,
    1 - (l.embedding <=> base_embedding) AS similarity
  FROM listings l
  WHERE l.id != base_listing_id
    AND l.embedding IS NOT NULL
    AND 1 - (l.embedding <=> base_embedding) > similarity_threshold
  ORDER BY l.embedding <=> base_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION find_similar_listings IS 'Find listings similar to a given listing using vector embeddings. Useful for "Similar properties" feature.';

-- ============================================================================
-- 6. UPDATE LISTING EMBEDDING FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION update_listing_embedding(
  listing_id UUID,
  new_embedding VECTOR(1536)
)
RETURNS VOID
LANGUAGE sql
VOLATILE
AS $$
  UPDATE listings
  SET embedding = new_embedding,
      updated_at = NOW()
  WHERE id = listing_id;
$$;

COMMENT ON FUNCTION update_listing_embedding IS 'Update the vector embedding for a specific listing. Used by AI service after generating embeddings.';

-- ============================================================================
-- 7. GET FRESH LISTINGS FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION get_fresh_listings(
  hours_old INT DEFAULT 24,
  match_count INT DEFAULT 50
)
RETURNS SETOF listings
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM listings
  WHERE scraped_at >= NOW() - (hours_old || ' hours')::INTERVAL
  ORDER BY scraped_at DESC
  LIMIT match_count;
$$;

COMMENT ON FUNCTION get_fresh_listings IS 'Get recently scraped listings within specified hours. Useful for "New listings" feature.';

-- ============================================================================
-- 8. CLEANUP OLD SEARCHES FUNCTION (Data Retention)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_searches(days_to_keep INT DEFAULT 90)
RETURNS BIGINT
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  deleted_count BIGINT;
BEGIN
  WITH deleted AS (
    DELETE FROM user_searches
    WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL
    RETURNING *
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RAISE NOTICE 'Deleted % old searches (older than % days)', deleted_count, days_to_keep;

  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_old_searches IS 'Delete search history older than specified days (default 90). Use for data retention policy.';

-- ============================================================================
-- 9. CLEANUP STALE LISTINGS FUNCTION (Data Freshness)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_stale_listings(days_stale INT DEFAULT 30)
RETURNS BIGINT
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  deleted_count BIGINT;
BEGIN
  WITH deleted AS (
    DELETE FROM listings
    WHERE scraped_at < NOW() - (days_stale || ' days')::INTERVAL
    RETURNING *
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RAISE NOTICE 'Deleted % stale listings (not updated in % days)', deleted_count, days_stale;

  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_stale_listings IS 'Delete listings that haven''t been updated in specified days (default 30). Run weekly to maintain data freshness.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify all functions were created successfully
DO $$
DECLARE
  function_count INTEGER;
  expected_count INTEGER := 9;
BEGIN
  SELECT COUNT(*) INTO function_count
  FROM information_schema.routines
  WHERE routine_schema = 'public'
    AND routine_type = 'FUNCTION'
    AND routine_name IN (
      'search_listings_semantic',
      'search_listings_nearby',
      'get_user_search_stats',
      'is_listing_saved',
      'find_similar_listings',
      'update_listing_embedding',
      'get_fresh_listings',
      'cleanup_old_searches',
      'cleanup_stale_listings'
    );

  RAISE NOTICE 'Created % helper functions (expected %)', function_count, expected_count;

  IF function_count != expected_count THEN
    RAISE WARNING 'Expected % functions, found %. Some functions may be missing.', expected_count, function_count;
  END IF;
END $$;

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================

-- Example 1: Semantic search
-- SELECT * FROM search_listings_semantic('[0.1, 0.2, ...]'::vector(1536), 0.7, 10);

-- Example 2: Geographic search (5km radius around Zagreb center)
-- SELECT * FROM search_listings_nearby(45.8150, 15.9819, 5000, 20);

-- Example 3: Get user search statistics
-- SELECT * FROM get_user_search_stats('user-uuid-here');

-- Example 4: Check if listing is saved
-- SELECT is_listing_saved('user-uuid', 'listing-uuid');

-- Example 5: Find similar listings
-- SELECT * FROM find_similar_listings('listing-uuid', 0.85, 10);

-- Example 6: Update listing embedding
-- SELECT update_listing_embedding('listing-uuid', '[0.1, 0.2, ...]'::vector(1536));

-- Example 7: Get fresh listings from last 24 hours
-- SELECT * FROM get_fresh_listings(24, 50);

-- Example 8: Cleanup old searches (delete searches older than 90 days)
-- SELECT cleanup_old_searches(90);

-- Example 9: Cleanup stale listings (delete listings not updated in 30 days)
-- SELECT cleanup_stale_listings(30);

-- ============================================================================
-- PERFORMANCE NOTES
-- ============================================================================

-- Vector Search Performance:
-- - search_listings_semantic uses HNSW index (fast with proper indexing)
-- - Adjust match_threshold to balance precision/recall
-- - Lower threshold = more results, potentially less relevant
-- - Higher threshold = fewer results, more relevant
--
-- Geographic Search Performance:
-- - search_listings_nearby uses GiST index on location_coordinates
-- - Increase radius_meters for broader search (slower with larger radius)
-- - Consider caching results for common locations
--
-- Cleanup Functions:
-- - Run cleanup_old_searches monthly (low impact)
-- - Run cleanup_stale_listings weekly (depends on scraping frequency)
-- - Consider running during off-peak hours
-- - Monitor deleted_count to adjust retention periods
