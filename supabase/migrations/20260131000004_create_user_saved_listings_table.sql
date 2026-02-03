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
