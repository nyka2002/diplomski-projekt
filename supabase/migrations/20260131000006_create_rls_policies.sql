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
