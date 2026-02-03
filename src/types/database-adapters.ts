/**
 * Database Type Adapters
 *
 * This file provides adapter functions to convert between:
 * - Auto-generated database types (from Supabase CLI)
 * - Application types (from listing.ts, search.ts)
 *
 * Why separate adapters?
 * - Database types match PostgreSQL schema exactly
 * - Application types are optimized for TypeScript usage
 * - Adapters handle conversions (geography → {lat, lng}, NUMERIC → number, etc.)
 *
 * Usage:
 * - Use dbListingToListing() when reading from database
 * - Use listingToDbInsert() when writing to database
 */

import { Listing, NormalizedListing, ListingType, PropertyType } from './listing';
import { UserSearch, ExtractedFilters } from './search';

// ============================================================================
// Database Type Definitions
// ============================================================================
// NOTE: These types will be replaced by auto-generated types from Supabase CLI
// Run: npm run db:types to generate database.types.ts
// For now, we define them manually to match our schema

/**
 * Database listing type (matches PostgreSQL schema)
 */
export interface DatabaseListing {
  id: string;
  source: string;
  external_id: string;
  url: string;
  title: string;
  description: string;
  price: number; // Supabase client converts NUMERIC to number
  price_currency: string;
  listing_type: ListingType;
  property_type: PropertyType;
  location_city: string;
  location_address: string;
  location_coordinates: string | {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat] in GeoJSON format
  } | null;
  rooms: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  surface_area: number | null;
  has_parking: boolean;
  has_balcony: boolean;
  has_garage: boolean;
  is_furnished: boolean;
  amenities: Record<string, any>;
  images: string[];
  embedding: number[] | null;
  scraped_at: string; // ISO timestamp
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

/**
 * Database listing insert type (for creating new listings)
 */
export interface DatabaseListingInsert {
  source: string;
  external_id: string;
  url: string;
  title: string;
  description: string;
  price: number;
  price_currency?: string;
  listing_type: ListingType;
  property_type: PropertyType;
  location_city: string;
  location_address: string;
  location_coordinates?: string; // PostGIS format: 'POINT(lng lat)'
  rooms?: number;
  bedrooms?: number;
  bathrooms?: number;
  surface_area?: number;
  has_parking?: boolean;
  has_balcony?: boolean;
  has_garage?: boolean;
  is_furnished?: boolean;
  amenities?: Record<string, any>;
  images?: string[];
  embedding?: number[];
  scraped_at?: string;
}

/**
 * Database user search type
 */
export interface DatabaseUserSearch {
  id: string;
  user_id: string;
  query_text: string;
  extracted_filters: ExtractedFilters | null;
  query_embedding: number[] | null;
  created_at: string; // ISO timestamp
}

/**
 * Database user saved listing type
 */
export interface DatabaseUserSavedListing {
  id: string;
  user_id: string;
  listing_id: string;
  search_id: string | null;
  saved_at: string; // ISO timestamp
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse location coordinates from various PostGIS/Supabase formats
 * Handles: GeoJSON object, WKT string, or null
 */
function parseLocationCoordinates(
  coords: string | { type: 'Point'; coordinates: [number, number] } | null
): { lat: number; lng: number } | undefined {
  if (!coords) return undefined;

  // Case 1: GeoJSON format (expected from Supabase)
  if (typeof coords === 'object' && 'coordinates' in coords && coords.coordinates) {
    return {
      lat: coords.coordinates[1],
      lng: coords.coordinates[0],
    };
  }

  // Case 2: WKT string format (e.g., "POINT(15.9819 45.8150)")
  if (typeof coords === 'string') {
    // Match POINT(lng lat) format
    const match = coords.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (match) {
      return {
        lng: parseFloat(match[1]),
        lat: parseFloat(match[2]),
      };
    }
  }

  // Fallback: return undefined if format is unrecognized
  console.warn('Unknown location_coordinates format:', coords);
  return undefined;
}

// ============================================================================
// Listing Adapters
// ============================================================================

/**
 * Convert database listing to application listing type
 *
 * Handles conversions:
 * - Geography point → {lat, lng}
 * - ISO timestamps → Date objects
 * - NULL → undefined
 * - NUMERIC → number (already done by Supabase client)
 */
export function dbListingToListing(dbListing: DatabaseListing): Listing {
  return {
    id: dbListing.id,
    source: dbListing.source,
    external_id: dbListing.external_id,
    url: dbListing.url,
    title: dbListing.title,
    description: dbListing.description,
    price: dbListing.price,
    price_currency: dbListing.price_currency,
    listing_type: dbListing.listing_type,
    property_type: dbListing.property_type,
    location_city: dbListing.location_city,
    location_address: dbListing.location_address,
    location_coordinates: parseLocationCoordinates(dbListing.location_coordinates),
    rooms: dbListing.rooms ?? undefined,
    bedrooms: dbListing.bedrooms ?? undefined,
    bathrooms: dbListing.bathrooms ?? undefined,
    surface_area: dbListing.surface_area ?? undefined,
    has_parking: dbListing.has_parking,
    has_balcony: dbListing.has_balcony,
    has_garage: dbListing.has_garage,
    is_furnished: dbListing.is_furnished,
    amenities: dbListing.amenities,
    images: dbListing.images,
    embedding: dbListing.embedding ?? undefined,
    scraped_at: new Date(dbListing.scraped_at),
    created_at: new Date(dbListing.created_at),
    updated_at: new Date(dbListing.updated_at),
  };
}

/**
 * Extended normalized listing with optional fields for database insert
 */
interface NormalizedListingForInsert extends NormalizedListing {
  embedding?: number[];
  scraped_at?: Date;
}

/**
 * Convert application listing to database insert format
 *
 * Handles conversions:
 * - {lat, lng} → PostGIS POINT format
 * - Date → ISO string
 * - undefined → null (for database)
 */
export function listingToDbInsert(listing: NormalizedListingForInsert): DatabaseListingInsert {
  return {
    source: listing.source,
    external_id: listing.external_id,
    url: listing.url,
    title: listing.title,
    description: listing.description,
    price: listing.price,
    price_currency: listing.price_currency || 'EUR',
    listing_type: listing.listing_type,
    property_type: listing.property_type,
    location_city: listing.location_city,
    location_address: listing.location_address,
    location_coordinates: listing.location_coordinates
      ? `POINT(${listing.location_coordinates.lng} ${listing.location_coordinates.lat})`
      : undefined,
    rooms: listing.rooms,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    surface_area: listing.surface_area,
    has_parking: listing.has_parking,
    has_balcony: listing.has_balcony,
    has_garage: listing.has_garage,
    is_furnished: listing.is_furnished,
    amenities: listing.amenities,
    images: listing.images,
    embedding: listing.embedding,
    scraped_at: listing.scraped_at ? listing.scraped_at.toISOString() : undefined,
  };
}

// ============================================================================
// User Search Adapters
// ============================================================================

/**
 * Convert database user search to application user search type
 */
export function dbUserSearchToUserSearch(dbSearch: DatabaseUserSearch): UserSearch {
  return {
    id: dbSearch.id,
    user_id: dbSearch.user_id,
    query_text: dbSearch.query_text,
    extracted_filters: dbSearch.extracted_filters || {},
    query_embedding: dbSearch.query_embedding || undefined,
    created_at: new Date(dbSearch.created_at),
  };
}

/**
 * Convert application user search to database insert format
 */
export function userSearchToDbInsert(userId: string, queryText: string, filters?: ExtractedFilters, embedding?: number[]) {
  return {
    user_id: userId,
    query_text: queryText,
    extracted_filters: filters || null,
    query_embedding: embedding || null,
  };
}

// ============================================================================
// Batch Conversion Utilities
// ============================================================================

/**
 * Convert array of database listings to application listings
 */
export function dbListingsToListings(dbListings: DatabaseListing[]): Listing[] {
  return dbListings.map(dbListingToListing);
}

/**
 * Convert array of database searches to application searches
 */
export function dbUserSearchesToUserSearches(dbSearches: DatabaseUserSearch[]): UserSearch[] {
  return dbSearches.map(dbUserSearchToUserSearch);
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a value is a valid DatabaseListing
 */
export function isDatabaseListing(value: any): value is DatabaseListing {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.id === 'string' &&
    typeof value.source === 'string' &&
    typeof value.title === 'string' &&
    typeof value.price === 'number' &&
    typeof value.listing_type === 'string' &&
    typeof value.property_type === 'string'
  );
}

/**
 * Check if a value is a valid Listing
 */
export function isListing(value: any): value is Listing {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.id === 'string' &&
    typeof value.source === 'string' &&
    typeof value.title === 'string' &&
    typeof value.price === 'number' &&
    typeof value.listing_type === 'string' &&
    typeof value.property_type === 'string' &&
    value.created_at instanceof Date
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format PostGIS POINT for database insertion
 */
export function formatPostGISPoint(lat: number, lng: number): string {
  return `POINT(${lng} ${lat})`;
}

/**
 * Parse PostGIS POINT from database
 */
export function parsePostGISPoint(point: { coordinates: [number, number] }): { lat: number; lng: number } {
  return {
    lat: point.coordinates[1],
    lng: point.coordinates[0],
  };
}

/**
 * Safely convert database NULL to undefined
 */
export function nullToUndefined<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}

/**
 * Safely convert undefined to database NULL
 */
export function undefinedToNull<T>(value: T | undefined): T | null {
  return value === undefined ? null : value;
}
