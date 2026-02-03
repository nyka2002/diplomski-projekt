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
