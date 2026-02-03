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
