# Supabase Database Migrations

This directory contains all database schema migrations, seed data, and documentation for the Real Estate Agent application.

## Overview

The database is designed to support:
- **Listings aggregation**: Store properties from multiple sources
- **Vector search**: Semantic search using pgvector (HNSW indexes)
- **Geographic search**: Radius-based location search using PostGIS
- **User management**: Search history and saved listings
- **Row Level Security**: Proper access control for user data

## Migration Files

Migrations are numbered and must be run in order:

1. **`20260131000001_enable_extensions.sql`**
   - Enables pgvector, PostGIS, and uuid-ossp extensions
   - **Must run first** before any tables are created

2. **`20260131000002_create_listings_table.sql`**
   - Creates main `listings` table with 25+ columns
   - Creates enum types for listing_type and property_type
   - Adds auto-update trigger for `updated_at` column

3. **`20260131000003_create_user_searches_table.sql`**
   - Creates `user_searches` table for search history
   - Links to `auth.users` (Supabase Auth)
   - Includes JSONB filters and vector embeddings

4. **`20260131000004_create_user_saved_listings_table.sql`**
   - Creates junction table for user favorites
   - Prevents duplicate saves with unique constraint

5. **`20260131000005_create_indexes.sql`**
   - Creates HNSW vector indexes (15x faster than IVFFlat)
   - Creates B-tree indexes for filtering
   - Creates GiST index for geographic queries
   - Creates GIN index for JSONB queries
   - Expected: 20+ indexes total

6. **`20260131000006_create_rls_policies.sql`**
   - Enables Row Level Security on all tables
   - Creates 10 policies for access control
   - Public read for listings, private user data

7. **`20260131000007_create_helper_functions.sql`**
   - Creates 9 PostgreSQL functions for common operations
   - Semantic search, geographic search, analytics, cleanup

## Running Migrations

### Option 1: Supabase Dashboard (Recommended for Development)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of each migration file **in order**
4. Run each migration and verify success

### Option 2: Supabase CLI

If you have Supabase CLI installed:

```bash
# Link your project (first time only)
supabase link --project-ref your-project-ref

# Run all migrations
supabase db push

# Or run migrations individually
psql $DATABASE_URL -f supabase/migrations/20260131000001_enable_extensions.sql
psql $DATABASE_URL -f supabase/migrations/20260131000002_create_listings_table.sql
# ... etc
```

### Option 3: Direct PostgreSQL Connection

If you have the database connection string:

```bash
export DATABASE_URL="postgresql://postgres:[password]@[host]:5432/postgres"

# Run migrations in order
psql $DATABASE_URL -f supabase/migrations/20260131000001_enable_extensions.sql
psql $DATABASE_URL -f supabase/migrations/20260131000002_create_listings_table.sql
psql $DATABASE_URL -f supabase/migrations/20260131000003_create_user_searches_table.sql
psql $DATABASE_URL -f supabase/migrations/20260131000004_create_user_saved_listings_table.sql
psql $DATABASE_URL -f supabase/migrations/20260131000005_create_indexes.sql
psql $DATABASE_URL -f supabase/migrations/20260131000006_create_rls_policies.sql
psql $DATABASE_URL -f supabase/migrations/20260131000007_create_helper_functions.sql
```

## Verification

After running all migrations, verify the setup:

### 1. Check Extensions

```sql
SELECT extname, extversion
FROM pg_extension
WHERE extname IN ('vector', 'postgis', 'uuid-ossp');
```

Expected: 3 rows (vector, postgis, uuid-ossp)

### 2. Check Tables

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Expected: `listings`, `user_saved_listings`, `user_searches`

### 3. Check Indexes

```sql
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

Expected: 20+ indexes

### 4. Check RLS Policies

```sql
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Expected: 10 policies

### 5. Check Functions

```sql
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;
```

Expected: 9+ functions (including auto-update trigger function)

### 6. Test Insert (Service Role)

Use Supabase Admin client or service_role key:

```sql
INSERT INTO listings (source, external_id, title, description, price, listing_type, property_type, location_city, location_address, url)
VALUES ('test', 'test-001', 'Test Listing', 'Test description', 1000, 'rent', 'apartment', 'Zagreb', 'Test Street 123', 'https://test.com/listing/001');
```

Expected: 1 row inserted

### 7. Test Public Read

Use anonymous or authenticated user:

```sql
SELECT COUNT(*) FROM listings;
```

Expected: Count of listings (at least 1 from test insert)

## Generating TypeScript Types

After migrations are complete, generate TypeScript types:

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Link your project (first time only)
supabase link --project-ref your-project-ref

# Generate types
npm run db:types

# Or manually:
supabase gen types typescript --local > src/types/database.types.ts
```

## Schema Overview

### Tables

#### `listings`
- **Purpose**: Main table for real estate properties
- **Rows**: Thousands to millions (depends on scraping frequency)
- **Key columns**: embedding (vector), location_coordinates (geography)
- **Indexes**: HNSW on embedding, GiST on location, B-tree on filters

#### `user_searches`
- **Purpose**: User search history with AI-extracted filters
- **Rows**: One per user search
- **Key columns**: query_text, extracted_filters (JSONB), query_embedding
- **Indexes**: HNSW on embedding, GIN on filters

#### `user_saved_listings`
- **Purpose**: Junction table for user favorites
- **Rows**: One per user-listing save
- **Key columns**: user_id, listing_id, search_id (optional)
- **Unique constraint**: (user_id, listing_id)

### Functions

1. **`search_listings_semantic(embedding, threshold, limit)`**
   - Vector similarity search using cosine distance
   - Returns listings ranked by similarity

2. **`search_listings_nearby(lat, lng, radius, limit)`**
   - Geographic radius search
   - Returns listings within distance

3. **`get_user_search_stats(user_id)`**
   - Aggregated user search analytics
   - Returns most common city, average price, etc.

4. **`is_listing_saved(user_id, listing_id)`**
   - Check if user saved a listing
   - Returns boolean

5. **`find_similar_listings(listing_id, threshold, limit)`**
   - Find similar properties using embeddings
   - Useful for "Similar properties" feature

6. **`update_listing_embedding(listing_id, embedding)`**
   - Update embedding vector for a listing
   - Used by AI service

7. **`get_fresh_listings(hours_old, limit)`**
   - Get recently scraped listings
   - Useful for "New listings" feature

8. **`cleanup_old_searches(days_to_keep)`**
   - Delete old search history
   - Data retention policy (default 90 days)

9. **`cleanup_stale_listings(days_stale)`**
   - Delete outdated listings
   - Data freshness policy (default 30 days)

## Row Level Security (RLS)

### Listings Table
- **Public read**: Anyone can view listings (anon + authenticated)
- **Service role write**: Only scraping service can insert/update/delete

### User Searches Table
- **Private to user**: Users can only see their own searches
- **CRUD**: Users can create, read, delete (no update - immutable)

### User Saved Listings Table
- **Private to user**: Users can only see their own saved listings
- **CRUD**: Users can create, read, delete (no update - immutable)

### Testing RLS

```typescript
// As anonymous user (can read listings)
const { data } = await supabase.from('listings').select('*');

// As authenticated user (can read own searches)
const { data } = await supabase.from('user_searches').select('*');

// As service role (can write listings)
const { data } = await supabaseAdmin.from('listings').insert({ ... });
```

## Index Tuning

### Vector Indexes (HNSW)

Current parameters:
- `m = 16`: Number of connections per layer
- `ef_construction = 64`: Build quality

For better recall on larger datasets:
- `m = 32`: More connections (better recall, more memory)
- `ef_construction = 128`: Higher quality build (slower, better search)

Query-time tuning (set before query):
```sql
SET hnsw.ef_search = 100;  -- Default is 40, increase for better recall
```

### Maintenance

- **ANALYZE**: Run monthly to update query planner statistics
  ```sql
  ANALYZE listings;
  ANALYZE user_searches;
  ANALYZE user_saved_listings;
  ```

- **REINDEX**: Only if insert performance degrades significantly
  ```sql
  REINDEX INDEX CONCURRENTLY idx_listings_embedding;
  ```

- **Monitor**: Check index bloat and usage
  ```sql
  SELECT * FROM pg_stat_user_indexes WHERE schemaname = 'public';
  ```

## Rollback Strategy

If a migration fails or needs to be rolled back:

### Rolling Back Individual Migrations

1. **Extensions** (Migration 001):
   ```sql
   DROP EXTENSION IF EXISTS vector CASCADE;
   DROP EXTENSION IF EXISTS postgis CASCADE;
   DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;
   ```

2. **Tables** (Migrations 002-004):
   ```sql
   DROP TABLE IF EXISTS user_saved_listings CASCADE;
   DROP TABLE IF EXISTS user_searches CASCADE;
   DROP TABLE IF EXISTS listings CASCADE;
   DROP TYPE IF EXISTS listing_type_enum CASCADE;
   DROP TYPE IF EXISTS property_type_enum CASCADE;
   ```

3. **Indexes** (Migration 005):
   ```sql
   -- Drop all custom indexes (not primary keys or constraints)
   DROP INDEX IF EXISTS idx_listings_embedding;
   DROP INDEX IF EXISTS idx_listings_listing_type;
   -- ... etc
   ```

4. **RLS Policies** (Migration 006):
   ```sql
   DROP POLICY IF EXISTS "Listings are viewable by everyone" ON listings;
   -- ... etc for all policies

   ALTER TABLE listings DISABLE ROW LEVEL SECURITY;
   ALTER TABLE user_searches DISABLE ROW LEVEL SECURITY;
   ALTER TABLE user_saved_listings DISABLE ROW LEVEL SECURITY;
   ```

5. **Functions** (Migration 007):
   ```sql
   DROP FUNCTION IF EXISTS search_listings_semantic;
   DROP FUNCTION IF EXISTS search_listings_nearby;
   -- ... etc for all functions
   ```

### Full Database Reset

**WARNING**: This will delete all data!

```sql
-- Drop all tables
DROP TABLE IF EXISTS user_saved_listings CASCADE;
DROP TABLE IF EXISTS user_searches CASCADE;
DROP TABLE IF EXISTS listings CASCADE;

-- Drop types
DROP TYPE IF EXISTS listing_type_enum CASCADE;
DROP TYPE IF EXISTS property_type_enum CASCADE;

-- Drop extensions
DROP EXTENSION IF EXISTS vector CASCADE;
DROP EXTENSION IF EXISTS postgis CASCADE;
DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;
```

## Troubleshooting

### Issue: "extension vector does not exist"
**Solution**: Run migration 001 first to enable extensions.

### Issue: "type vector does not exist"
**Solution**: pgvector extension must be enabled before creating tables with vector columns.

### Issue: "permission denied for table listings"
**Solution**: Check RLS policies. Use supabaseAdmin client for service operations.

### Issue: "index build taking too long"
**Solution**: HNSW indexes take time. Consider using `CREATE INDEX CONCURRENTLY` or start with IVFFlat.

### Issue: "out of memory" during index build
**Solution**: Reduce `ef_construction` parameter or use IVFFlat initially.

### Issue: "duplicate key value violates unique constraint"
**Solution**: Listing already exists. Check source + external_id uniqueness.

## Seed Data

To populate the database with test data:

```bash
psql $DATABASE_URL -f supabase/seed.sql
```

See `seed.sql` for sample listings.

## Performance Benchmarks

Expected performance (depends on dataset size and hardware):

- **Semantic search**: < 500ms for 100k listings
- **Geographic search**: < 200ms within 10km radius
- **Filter search**: < 100ms with proper indexes
- **Listing insert**: < 50ms per listing
- **Batch insert**: 100-1000 listings/second

## Next Steps

After completing Phase 2:

1. **Phase 3**: Implement web scraping to populate `listings` table
2. **Phase 4**: Implement AI services to generate embeddings
3. **Phase 5**: Build API endpoints using db-helpers functions
4. **Phase 6**: Build frontend with listing display

## Resources

- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [PostGIS Documentation](https://postgis.net/documentation/)
- [Supabase RLS Guide](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [PostgreSQL HNSW Indexes](https://github.com/pgvector/pgvector#hnsw)

## Support

For issues or questions:
- Check verification queries above
- Review error messages in SQL Editor
- Consult Supabase logs for RLS policy issues
- Test with simplified queries first
