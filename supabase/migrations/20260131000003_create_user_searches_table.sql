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
