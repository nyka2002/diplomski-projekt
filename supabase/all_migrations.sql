-- ============================================================================
-- Migration: Enable Required PostgreSQL Extensions
-- Created: 2026-01-31
-- Purpose: Enable pgvector, PostGIS, and uuid-ossp extensions
--
-- CRITICAL: This migration MUST run FIRST before any tables are created
-- ============================================================================

-- Enable pgvector extension for vector similarity search
-- Used for storing and querying embeddings (1536-dimensional vectors from OpenAI)
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable PostGIS for geography and geometry types
-- Used for accurate geographic distance calculations (location_coordinates column)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enable UUID generation
-- Used for generating UUIDs as primary keys (uuid_generate_v4())
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Verification
-- ============================================================================

-- Verify extensions are enabled
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    RAISE EXCEPTION 'pgvector extension is not enabled';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    RAISE EXCEPTION 'PostGIS extension is not enabled';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') THEN
    RAISE EXCEPTION 'uuid-ossp extension is not enabled';
  END IF;

  RAISE NOTICE 'All required extensions are enabled successfully';
END $$;

-- ============================================================================
-- Extension Information
-- ============================================================================

COMMENT ON EXTENSION vector IS 'Vector similarity search for embeddings (pgvector)';
COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial objects';
COMMENT ON EXTENSION "uuid-ossp" IS 'UUID generation functions';
-- ============================================================================
-- Migration: Create Listings Table
-- Created: 2026-01-31
-- Purpose: Create main listings table for real estate properties
-- ============================================================================

-- ============================================================================
-- Create Enum Types
-- ============================================================================

-- Enum for listing type (rent or sale)
CREATE TYPE listing_type_enum AS ENUM ('rent', 'sale');

-- Enum for property type
CREATE TYPE property_type_enum AS ENUM ('apartment', 'house', 'office', 'land', 'other');

-- ============================================================================
-- Create Listings Table
-- ============================================================================

CREATE TABLE listings (
  -- ========================================
  -- Primary Identification
  -- ========================================
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- ========================================
  -- Source Information
  -- ========================================
  source TEXT NOT NULL,                              -- Website source (e.g., 'njuskalo.hr', 'index.hr')
  external_id TEXT NOT NULL,                         -- ID from source website
  url TEXT NOT NULL,                                 -- Original listing URL

  -- ========================================
  -- Basic Information
  -- ========================================
  title TEXT NOT NULL,
  description TEXT NOT NULL,

  -- ========================================
  -- Price Information
  -- ========================================
  price NUMERIC(12,2) NOT NULL,                      -- Price with 2 decimal precision
  price_currency TEXT NOT NULL DEFAULT 'EUR',        -- Currency code
  listing_type listing_type_enum NOT NULL,           -- 'rent' or 'sale'
  property_type property_type_enum NOT NULL,         -- Type of property

  -- ========================================
  -- Location Information
  -- ========================================
  location_city TEXT NOT NULL,                       -- City name
  location_address TEXT NOT NULL,                    -- Full address
  location_coordinates GEOGRAPHY(Point, 4326),       -- Geographic coordinates (WGS84)

  -- ========================================
  -- Property Details
  -- ========================================
  rooms INTEGER,                                     -- Total number of rooms
  bedrooms INTEGER,                                  -- Number of bedrooms
  bathrooms INTEGER,                                 -- Number of bathrooms
  surface_area NUMERIC(10,2),                        -- Surface area in square meters

  -- ========================================
  -- Features (Boolean flags for fast filtering)
  -- ========================================
  has_parking BOOLEAN NOT NULL DEFAULT false,
  has_balcony BOOLEAN NOT NULL DEFAULT false,
  has_garage BOOLEAN NOT NULL DEFAULT false,
  is_furnished BOOLEAN NOT NULL DEFAULT false,

  -- ========================================
  -- Additional Features (Flexible JSONB)
  -- ========================================
  amenities JSONB DEFAULT '{}'::jsonb,               -- Additional features (e.g., {"elevator": true, "heating": "central"})

  -- ========================================
  -- Media
  -- ========================================
  images TEXT[] DEFAULT ARRAY[]::TEXT[],             -- Array of image URLs

  -- ========================================
  -- Vector Embedding for Semantic Search
  -- ========================================
  embedding VECTOR(1536),                            -- Embedding vector (text-embedding-3-small dimension)

  -- ========================================
  -- Timestamps
  -- ========================================
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),     -- When the listing was scraped
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),     -- Record creation time
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),     -- Last update time

  -- ========================================
  -- Constraints
  -- ========================================
  CONSTRAINT unique_source_external_id UNIQUE (source, external_id),  -- Prevent duplicate listings from same source
  CONSTRAINT positive_price CHECK (price > 0),                        -- Price must be positive
  CONSTRAINT positive_surface_area CHECK (surface_area IS NULL OR surface_area > 0),  -- Surface area must be positive if provided
  CONSTRAINT valid_rooms CHECK (rooms IS NULL OR rooms > 0),          -- Rooms must be positive if provided
  CONSTRAINT valid_bedrooms CHECK (bedrooms IS NULL OR bedrooms > 0), -- Bedrooms must be positive if provided
  CONSTRAINT valid_bathrooms CHECK (bathrooms IS NULL OR bathrooms > 0) -- Bathrooms must be positive if provided
);

-- ============================================================================
-- Table and Column Comments (Self-Documenting Schema)
-- ============================================================================

COMMENT ON TABLE listings IS 'Aggregated real estate listings from multiple sources with vector embeddings for semantic search';

COMMENT ON COLUMN listings.id IS 'Unique identifier (UUID)';
COMMENT ON COLUMN listings.source IS 'Website source where listing was scraped (e.g., njuskalo.hr)';
COMMENT ON COLUMN listings.external_id IS 'Original listing ID from source website';
COMMENT ON COLUMN listings.url IS 'Direct URL to the listing on source website';
COMMENT ON COLUMN listings.price IS 'Listing price with 2 decimal precision (NUMERIC avoids floating-point errors)';
COMMENT ON COLUMN listings.location_coordinates IS 'Geographic coordinates in WGS84 (SRID 4326) for accurate worldwide distance calculations';
COMMENT ON COLUMN listings.surface_area IS 'Property surface area in square meters';
COMMENT ON COLUMN listings.amenities IS 'Additional features in flexible JSON format (e.g., {"elevator": true, "heating": "central", "air_conditioning": true})';
COMMENT ON COLUMN listings.images IS 'Array of image URLs for the property';
COMMENT ON COLUMN listings.embedding IS 'Vector embedding (1536-dimensional) generated from title + description using OpenAI text-embedding-3-small for semantic search';
COMMENT ON COLUMN listings.scraped_at IS 'Timestamp when the listing was scraped from the source (used for data freshness checks)';

-- ============================================================================
-- Create Function to Auto-Update updated_at Timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_updated_at_column() IS 'Automatically updates the updated_at column to current timestamp on row update';

-- ============================================================================
-- Create Trigger for Auto-Updating updated_at
-- ============================================================================

CREATE TRIGGER update_listings_updated_at
  BEFORE UPDATE ON listings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TRIGGER update_listings_updated_at ON listings IS 'Automatically updates updated_at timestamp whenever a listing is modified';

-- ============================================================================
-- Verification
-- ============================================================================

-- Verify table was created successfully
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'listings'
  ) THEN
    RAISE EXCEPTION 'Listings table was not created';
  END IF;

  RAISE NOTICE 'Listings table created successfully with % columns',
    (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'listings');
END $$;
-- ============================================================================
-- Migration: Create User Searches Table
-- Created: 2026-01-31
-- Purpose: Store user search history with AI-extracted filters and embeddings
-- ============================================================================

CREATE TABLE user_searches (
  -- ========================================
  -- Primary Identification
  -- ========================================
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- ========================================
  -- User Reference
  -- ========================================
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- ========================================
  -- Query Information
  -- ========================================
  query_text TEXT NOT NULL,                          -- Original natural language query from user
  extracted_filters JSONB,                           -- AI-extracted structured filters from the query
  query_embedding VECTOR(1536),                      -- Embedding of the query for similarity search

  -- ========================================
  -- Timestamp
  -- ========================================
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()      -- When the search was performed
);

-- ============================================================================
-- Table and Column Comments
-- ============================================================================

COMMENT ON TABLE user_searches IS 'User search history with AI-extracted filters and embeddings for finding similar past searches';

COMMENT ON COLUMN user_searches.id IS 'Unique identifier for the search';
COMMENT ON COLUMN user_searches.user_id IS 'Reference to the user who performed the search (CASCADE delete when user is deleted)';
COMMENT ON COLUMN user_searches.query_text IS 'Original natural language query entered by the user';
COMMENT ON COLUMN user_searches.extracted_filters IS 'Structured filters extracted by AI from the natural language query (JSONB for flexible querying)';
COMMENT ON COLUMN user_searches.query_embedding IS 'Vector embedding of the query for finding similar past searches and query suggestions';
COMMENT ON COLUMN user_searches.created_at IS 'Timestamp when the search was performed (for chronological history)';

-- ============================================================================
-- Create Indexes for User Searches
-- ============================================================================

-- Index on user_id for fast retrieval of user's search history
CREATE INDEX idx_user_searches_user_id ON user_searches(user_id);

COMMENT ON INDEX idx_user_searches_user_id IS 'Fast lookup of all searches by a specific user';

-- Index on created_at for chronological sorting (most recent first)
CREATE INDEX idx_user_searches_created_at ON user_searches(created_at DESC);

COMMENT ON INDEX idx_user_searches_created_at IS 'Fast chronological sorting of search history';

-- GIN index on extracted_filters for fast JSONB queries
CREATE INDEX idx_user_searches_filters ON user_searches USING GIN (extracted_filters);

COMMENT ON INDEX idx_user_searches_filters IS 'Fast JSONB queries on extracted filters (e.g., finding all searches for apartments in Zagreb)';

-- ============================================================================
-- Verification
-- ============================================================================

-- Verify table and indexes were created successfully
DO $$
DECLARE
  index_count INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_searches'
  ) THEN
    RAISE EXCEPTION 'user_searches table was not created';
  END IF;

  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE schemaname = 'public' AND tablename = 'user_searches';

  RAISE NOTICE 'user_searches table created successfully with % indexes', index_count;
END $$;
-- ============================================================================
-- Migration: Create User Saved Listings Table
-- Created: 2026-01-31
-- Purpose: Junction table for users to save/favorite listings
-- ============================================================================

CREATE TABLE user_saved_listings (
  -- ========================================
  -- Primary Identification
  -- ========================================
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- ========================================
  -- Foreign Key References
  -- ========================================
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  search_id UUID REFERENCES user_searches(id) ON DELETE SET NULL,  -- Optional: which search led to this save (for analytics)

  -- ========================================
  -- Timestamp
  -- ========================================
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),       -- When the listing was saved

  -- ========================================
  -- Constraints
  -- ========================================
  CONSTRAINT unique_user_listing UNIQUE (user_id, listing_id)  -- Prevent duplicate saves
);

-- ============================================================================
-- Table and Column Comments
-- ============================================================================

COMMENT ON TABLE user_saved_listings IS 'Junction table for user favorites/saved listings with optional analytics tracking';

COMMENT ON COLUMN user_saved_listings.id IS 'Unique identifier for the saved listing entry';
COMMENT ON COLUMN user_saved_listings.user_id IS 'Reference to the user (CASCADE delete when user is deleted)';
COMMENT ON COLUMN user_saved_listings.listing_id IS 'Reference to the saved listing (CASCADE delete when listing is removed)';
COMMENT ON COLUMN user_saved_listings.search_id IS 'Optional reference to the search that found this listing (SET NULL when search is deleted, useful for analytics)';
COMMENT ON COLUMN user_saved_listings.saved_at IS 'Timestamp when the listing was saved by the user';
COMMENT ON CONSTRAINT unique_user_listing ON user_saved_listings IS 'Ensures a user cannot save the same listing multiple times';

-- ============================================================================
-- Create Indexes for User Saved Listings
-- ============================================================================

-- Index on user_id for fast retrieval of user's saved listings
CREATE INDEX idx_user_saved_listings_user_id ON user_saved_listings(user_id);

COMMENT ON INDEX idx_user_saved_listings_user_id IS 'Fast lookup of all listings saved by a specific user';

-- Index on listing_id for checking if a listing is saved
CREATE INDEX idx_user_saved_listings_listing_id ON user_saved_listings(listing_id);

COMMENT ON INDEX idx_user_saved_listings_listing_id IS 'Fast lookup to check if a specific listing is saved by any users';

-- Index on saved_at for chronological sorting
CREATE INDEX idx_user_saved_listings_saved_at ON user_saved_listings(saved_at DESC);

COMMENT ON INDEX idx_user_saved_listings_saved_at IS 'Fast chronological sorting of saved listings (most recently saved first)';

-- ============================================================================
-- Verification
-- ============================================================================

-- Verify table and indexes were created successfully
DO $$
DECLARE
  index_count INTEGER;
  constraint_count INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_saved_listings'
  ) THEN
    RAISE EXCEPTION 'user_saved_listings table was not created';
  END IF;

  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE schemaname = 'public' AND tablename = 'user_saved_listings';

  SELECT COUNT(*) INTO constraint_count
  FROM information_schema.table_constraints
  WHERE table_schema = 'public'
    AND table_name = 'user_saved_listings'
    AND constraint_type = 'UNIQUE';

  RAISE NOTICE 'user_saved_listings table created successfully with % indexes and % unique constraints',
    index_count, constraint_count;
END $$;
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
-- ============================================================================
-- Migration: Create Row Level Security Policies
-- Created: 2026-01-31
-- Purpose: Define security policies for data access control
--
-- Security Model:
-- - listings: Public read access, service_role write access
-- - user_searches: Private to user (can only see own searches)
-- - user_saved_listings: Private to user (can only see own saved listings)
-- ============================================================================

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_saved_listings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- LISTINGS TABLE POLICIES (Public Read, Service Role Write)
-- ============================================================================

-- Policy 1: Allow public read access to all listings
-- Applies to: Anonymous (anon) and authenticated users
-- Purpose: Users can browse listings without authentication
CREATE POLICY "Listings are viewable by everyone"
  ON listings
  FOR SELECT
  TO anon, authenticated
  USING (true);

COMMENT ON POLICY "Listings are viewable by everyone" ON listings
  IS 'Public read access for all users - no authentication required to browse listings';

-- Policy 2: Only service role can insert listings
-- Purpose: Scraping service uses service_role to insert new listings
CREATE POLICY "Service role can insert listings"
  ON listings
  FOR INSERT
  TO service_role
  WITH CHECK (true);

COMMENT ON POLICY "Service role can insert listings" ON listings
  IS 'Only the scraping service (using service_role) can add new listings';

-- Policy 3: Only service role can update listings
-- Purpose: Scraping service updates existing listings (price changes, etc.)
CREATE POLICY "Service role can update listings"
  ON listings
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "Service role can update listings" ON listings
  IS 'Only the scraping service can update listing information';

-- Policy 4: Only service role can delete listings
-- Purpose: Scraping service removes stale listings
CREATE POLICY "Service role can delete listings"
  ON listings
  FOR DELETE
  TO service_role
  USING (true);

COMMENT ON POLICY "Service role can delete listings" ON listings
  IS 'Only the scraping service can remove listings from the database';

-- ============================================================================
-- USER_SEARCHES TABLE POLICIES (Private to User)
-- ============================================================================

-- Policy 1: Users can view only their own searches
-- Purpose: Search history is private to each user
CREATE POLICY "Users can view their own searches"
  ON user_searches
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON POLICY "Users can view their own searches" ON user_searches
  IS 'Users can only access their own search history - privacy protection';

-- Policy 2: Users can create their own searches
-- Purpose: Users can save their search queries
CREATE POLICY "Users can create their own searches"
  ON user_searches
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY "Users can create their own searches" ON user_searches
  IS 'Users can save their search queries to their history';

-- Policy 3: Users can delete their own searches
-- Purpose: Users can clear their search history
CREATE POLICY "Users can delete their own searches"
  ON user_searches
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON POLICY "Users can delete their own searches" ON user_searches
  IS 'Users can delete searches from their history';

-- Note: No UPDATE policy - searches are immutable once created

-- ============================================================================
-- USER_SAVED_LISTINGS TABLE POLICIES (Private to User)
-- ============================================================================

-- Policy 1: Users can view only their own saved listings
-- Purpose: Saved listings are private to each user
CREATE POLICY "Users can view their own saved listings"
  ON user_saved_listings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON POLICY "Users can view their own saved listings" ON user_saved_listings
  IS 'Users can only access their own saved/favorited listings';

-- Policy 2: Users can save listings
-- Purpose: Users can add listings to their favorites
CREATE POLICY "Users can save listings"
  ON user_saved_listings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY "Users can save listings" ON user_saved_listings
  IS 'Users can save/favorite listings to their collection';

-- Policy 3: Users can unsave listings
-- Purpose: Users can remove listings from favorites
CREATE POLICY "Users can unsave listings"
  ON user_saved_listings
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON POLICY "Users can unsave listings" ON user_saved_listings
  IS 'Users can remove listings from their favorites';

-- Note: No UPDATE policy - saved listings are immutable (only save/unsave actions)

-- ============================================================================
-- GRANT PERMISSIONS TO ROLES
-- ============================================================================

-- Grant usage on custom enum types to all users
GRANT USAGE ON TYPE listing_type_enum TO anon, authenticated;
GRANT USAGE ON TYPE property_type_enum TO anon, authenticated;

-- Grant select on listings to public (redundant with RLS but explicit)
GRANT SELECT ON listings TO anon, authenticated;

-- Grant permissions on user tables to authenticated users only
GRANT SELECT, INSERT, DELETE ON user_searches TO authenticated;
GRANT SELECT, INSERT, DELETE ON user_saved_listings TO authenticated;

-- ============================================================================
-- SECURITY VERIFICATION
-- ============================================================================

-- Verify RLS is enabled on all tables
DO $$
DECLARE
  listings_rls BOOLEAN;
  user_searches_rls BOOLEAN;
  user_saved_listings_rls BOOLEAN;
BEGIN
  -- Check if RLS is enabled
  SELECT relrowsecurity INTO listings_rls
  FROM pg_class
  WHERE relname = 'listings' AND relnamespace = 'public'::regnamespace;

  SELECT relrowsecurity INTO user_searches_rls
  FROM pg_class
  WHERE relname = 'user_searches' AND relnamespace = 'public'::regnamespace;

  SELECT relrowsecurity INTO user_saved_listings_rls
  FROM pg_class
  WHERE relname = 'user_saved_listings' AND relnamespace = 'public'::regnamespace;

  -- Verify all tables have RLS enabled
  IF NOT listings_rls THEN
    RAISE EXCEPTION 'RLS is not enabled on listings table';
  END IF;

  IF NOT user_searches_rls THEN
    RAISE EXCEPTION 'RLS is not enabled on user_searches table';
  END IF;

  IF NOT user_saved_listings_rls THEN
    RAISE EXCEPTION 'RLS is not enabled on user_saved_listings table';
  END IF;

  RAISE NOTICE 'RLS verification passed: All tables have RLS enabled';
END $$;

-- Count and display policies for each table
DO $$
DECLARE
  listings_policy_count INTEGER;
  user_searches_policy_count INTEGER;
  user_saved_listings_policy_count INTEGER;
  total_policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO listings_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'listings';

  SELECT COUNT(*) INTO user_searches_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'user_searches';

  SELECT COUNT(*) INTO user_saved_listings_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'user_saved_listings';

  total_policy_count := listings_policy_count + user_searches_policy_count + user_saved_listings_policy_count;

  RAISE NOTICE 'RLS policies created:';
  RAISE NOTICE '  - listings: % policies', listings_policy_count;
  RAISE NOTICE '  - user_searches: % policies', user_searches_policy_count;
  RAISE NOTICE '  - user_saved_listings: % policies', user_saved_listings_policy_count;
  RAISE NOTICE '  - Total: % policies', total_policy_count;

  IF total_policy_count != 10 THEN
    RAISE WARNING 'Expected 10 RLS policies, found %. Some policies may be missing.', total_policy_count;
  END IF;
END $$;

-- ============================================================================
-- SECURITY NOTES
-- ============================================================================

-- RLS Performance:
-- - Policies are applied to every query automatically
-- - Indexed columns (user_id) ensure policies don't slow down queries
-- - service_role bypasses RLS for administrative operations
--
-- Testing RLS Policies:
-- - Test as anon user: Can read listings, cannot access user data
-- - Test as authenticated user: Can read listings, own searches/saves only
-- - Test as service_role: Full access to all tables
--
-- Bypassing RLS:
-- - Use supabaseAdmin client with service_role key
-- - Only for backend operations (scraping, migrations, admin tasks)
-- - Never expose service_role key to frontend
--
-- Common RLS Pitfalls:
-- - Forgetting to enable RLS: Tables without RLS are fully accessible
-- - Missing policies: Users get "permission denied" errors
-- - Wrong role in policy: Check TO clause (anon vs authenticated)
-- - Service operations: Use admin client to bypass RLS
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
