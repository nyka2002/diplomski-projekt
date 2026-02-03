/**
 * Database Helper Functions
 *
 * TypeScript wrapper functions around Supabase database queries.
 * Provides:
 * - Type-safe database operations
 * - Automatic type conversion (database types ↔ application types)
 * - Error handling
 * - Proper use of RLS (user client vs admin client)
 *
 * Usage:
 * - Use supabase client for user operations (respects RLS)
 * - Use supabaseAdmin client for service operations (bypasses RLS)
 */

import { supabase, supabaseAdmin } from './supabase';
import { Listing, NormalizedListing, ListingType, PropertyType } from '@/types/listing';
import { UserSearch, ExtractedFilters } from '@/types/search';
import {
  DatabaseListing,
  DatabaseListingInsert,
  DatabaseUserSearch,
  dbListingToListing,
  dbListingsToListings,
  listingToDbInsert,
  dbUserSearchToUserSearch,
  userSearchToDbInsert,
} from '@/types/database-adapters';

// ============================================================================
// LISTINGS QUERIES
// ============================================================================

/**
 * Get listings with optional filters
 *
 * @param filters - Optional filters for listings
 * @returns Array of listings
 */
export async function getListings(filters?: {
  listing_type?: ListingType;
  property_type?: PropertyType;
  city?: string;
  location?: string; // Alias for city
  price_min?: number;
  price_max?: number;
  rooms_min?: number;
  rooms_max?: number;
  has_parking?: boolean;
  has_balcony?: boolean;
  is_furnished?: boolean;
  limit?: number;
  offset?: number;
}): Promise<Listing[]> {
  if (!supabase) {
    throw new Error('Supabase client is not initialized');
  }

  let query = supabase.from('listings').select('*');

  // Apply filters
  if (filters?.listing_type) {
    query = query.eq('listing_type', filters.listing_type);
  }
  if (filters?.property_type) {
    query = query.eq('property_type', filters.property_type);
  }
  // Support both 'city' and 'location' (alias)
  const cityFilter = filters?.city || filters?.location;
  if (cityFilter) {
    query = query.ilike('location_city', `%${cityFilter}%`);
  }
  if (filters?.price_min !== undefined) {
    query = query.gte('price', filters.price_min);
  }
  if (filters?.price_max !== undefined) {
    query = query.lte('price', filters.price_max);
  }
  if (filters?.rooms_min !== undefined) {
    query = query.gte('rooms', filters.rooms_min);
  }
  if (filters?.rooms_max !== undefined) {
    query = query.lte('rooms', filters.rooms_max);
  }
  if (filters?.has_parking !== undefined) {
    query = query.eq('has_parking', filters.has_parking);
  }
  if (filters?.has_balcony !== undefined) {
    query = query.eq('has_balcony', filters.has_balcony);
  }
  if (filters?.is_furnished !== undefined) {
    query = query.eq('is_furnished', filters.is_furnished);
  }

  // Apply pagination
  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  // Order by most recent
  query = query.order('scraped_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get listings: ${error.message}`);
  }

  return data ? dbListingsToListings(data as DatabaseListing[]) : [];
}

/**
 * Get a single listing by ID
 *
 * @param id - Listing UUID
 * @returns Listing or null if not found
 */
export async function getListingById(id: string): Promise<Listing | null> {
  if (!supabase) {
    throw new Error('Supabase client is not initialized');
  }

  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null;
    }
    throw new Error(`Failed to get listing: ${error.message}`);
  }

  return data ? dbListingToListing(data as DatabaseListing) : null;
}

/**
 * Search listings using semantic similarity (vector search)
 *
 * @param embedding - Query embedding vector (1536 dimensions)
 * @param threshold - Similarity threshold (0-1, default 0.7)
 * @param limit - Maximum number of results (default 20)
 * @returns Array of listings with similarity scores
 */
export async function searchListingsSemantic(
  embedding: number[],
  threshold: number = 0.7,
  limit: number = 20
): Promise<Array<Listing & { similarity: number }>> {
  if (!supabase) {
    throw new Error('Supabase client is not initialized');
  }

  const { data, error } = await supabase.rpc('search_listings_semantic', {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: limit,
  });

  if (error) {
    throw new Error(`Failed to search listings: ${error.message}`);
  }

  return (data || []) as Array<Listing & { similarity: number }>;
}

/**
 * Search listings within geographic radius
 *
 * @param lat - Latitude
 * @param lng - Longitude
 * @param radiusMeters - Search radius in meters (default 5000)
 * @param limit - Maximum number of results (default 20)
 * @returns Array of listings with distance
 */
export async function searchListingsNearby(
  lat: number,
  lng: number,
  radiusMeters: number = 5000,
  limit: number = 20
): Promise<Array<{ id: string; title: string; price: number; location_city: string; location_address: string; distance_meters: number }>> {
  if (!supabase) {
    throw new Error('Supabase client is not initialized');
  }

  const { data, error } = await supabase.rpc('search_listings_nearby', {
    search_lat: lat,
    search_lng: lng,
    radius_meters: radiusMeters,
    match_count: limit,
  });

  if (error) {
    throw new Error(`Failed to search nearby listings: ${error.message}`);
  }

  return data || [];
}

/**
 * Find listings similar to a given listing
 *
 * @param listingId - Base listing UUID
 * @param threshold - Similarity threshold (0-1, default 0.8)
 * @param limit - Maximum number of results (default 10)
 * @returns Array of similar listings
 */
export async function findSimilarListings(
  listingId: string,
  threshold: number = 0.8,
  limit: number = 10
): Promise<Array<{ id: string; title: string; price: number; similarity: number }>> {
  if (!supabase) {
    throw new Error('Supabase client is not initialized');
  }

  const { data, error } = await supabase.rpc('find_similar_listings', {
    base_listing_id: listingId,
    similarity_threshold: threshold,
    match_count: limit,
  });

  if (error) {
    throw new Error(`Failed to find similar listings: ${error.message}`);
  }

  return data || [];
}

/**
 * Insert a new listing (requires admin client - bypasses RLS)
 *
 * @param listing - Normalized listing data
 * @returns Inserted listing or null
 */
export async function insertListing(listing: NormalizedListing): Promise<Listing | null> {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client is not initialized');
  }

  const dbListing = listingToDbInsert(listing);

  const { data, error } = await supabaseAdmin
    .from('listings')
    .insert(dbListing)
    .select()
    .single();

  if (error) {
    // Handle duplicate constraint violation
    if (error.code === '23505') {
      console.warn(`Duplicate listing: ${listing.source} - ${listing.external_id}`);
      return null;
    }
    throw new Error(`Failed to insert listing: ${error.message}`);
  }

  return data ? dbListingToListing(data as DatabaseListing) : null;
}

/**
 * Batch insert listings (requires admin client)
 *
 * @param listings - Array of normalized listings
 * @returns Number of successfully inserted listings
 */
export async function batchInsertListings(listings: NormalizedListing[]): Promise<number> {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client is not initialized');
  }

  const dbListings = listings.map(listingToDbInsert);

  const { data, error } = await supabaseAdmin
    .from('listings')
    .insert(dbListings)
    .select();

  if (error) {
    throw new Error(`Failed to batch insert listings: ${error.message}`);
  }

  return data?.length ?? 0;
}

/**
 * Update listing embedding (requires admin client)
 *
 * @param listingId - Listing UUID
 * @param embedding - Embedding vector (1536 dimensions)
 */
export async function updateListingEmbedding(listingId: string, embedding: number[]): Promise<void> {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client is not initialized');
  }

  const { error } = await supabaseAdmin.rpc('update_listing_embedding', {
    listing_id: listingId,
    new_embedding: embedding,
  });

  if (error) {
    throw new Error(`Failed to update listing embedding: ${error.message}`);
  }
}

/**
 * Get fresh listings (recently scraped)
 *
 * @param hoursOld - Maximum age in hours (default 24)
 * @param limit - Maximum number of results (default 50)
 * @returns Array of recent listings
 */
export async function getFreshListings(hoursOld: number = 24, limit: number = 50): Promise<Listing[]> {
  if (!supabase) {
    throw new Error('Supabase client is not initialized');
  }

  const { data, error } = await supabase.rpc('get_fresh_listings', {
    hours_old: hoursOld,
    match_count: limit,
  });

  if (error) {
    throw new Error(`Failed to get fresh listings: ${error.message}`);
  }

  return data ? dbListingsToListings(data as DatabaseListing[]) : [];
}

// ============================================================================
// USER SEARCHES QUERIES
// ============================================================================

/**
 * Save a user search query
 *
 * @param userId - User UUID
 * @param queryText - Original search query text
 * @param extractedFilters - AI-extracted filters
 * @param queryEmbedding - Query embedding vector (optional)
 * @returns Saved user search
 */
export async function saveUserSearch(
  userId: string,
  queryText: string,
  extractedFilters: ExtractedFilters,
  queryEmbedding?: number[]
): Promise<UserSearch> {
  if (!supabase) {
    throw new Error('Supabase client is not initialized');
  }

  const dbSearch = userSearchToDbInsert(userId, queryText, extractedFilters, queryEmbedding);

  const { data, error } = await supabase
    .from('user_searches')
    .insert(dbSearch)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save user search: ${error.message}`);
  }

  return dbUserSearchToUserSearch(data as DatabaseUserSearch);
}

/**
 * Get user's search history
 *
 * @param userId - User UUID
 * @param limit - Maximum number of results (default 20)
 * @returns Array of user searches
 */
export async function getUserSearches(userId: string, limit: number = 20): Promise<UserSearch[]> {
  if (!supabase) {
    throw new Error('Supabase client is not initialized');
  }

  const { data, error } = await supabase
    .from('user_searches')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get user searches: ${error.message}`);
  }

  return data ? data.map(dbUserSearchToUserSearch) : [];
}

/**
 * Delete a user search
 *
 * @param userId - User UUID
 * @param searchId - Search UUID
 */
export async function deleteUserSearch(userId: string, searchId: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase client is not initialized');
  }

  const { error } = await supabase
    .from('user_searches')
    .delete()
    .eq('id', searchId)
    .eq('user_id', userId); // Ensure user owns the search

  if (error) {
    throw new Error(`Failed to delete user search: ${error.message}`);
  }
}

/**
 * Get user search statistics
 *
 * @param userId - User UUID
 * @returns Search statistics
 */
export async function getUserSearchStats(userId: string): Promise<{
  total_searches: number;
  most_common_city: string | null;
  avg_price_max: number | null;
  most_searched_listing_type: ListingType | null;
}> {
  if (!supabase) {
    throw new Error('Supabase client is not initialized');
  }

  const { data, error } = await supabase.rpc('get_user_search_stats', {
    search_user_id: userId,
  });

  if (error) {
    throw new Error(`Failed to get user search stats: ${error.message}`);
  }

  return data?.[0] || { total_searches: 0, most_common_city: null, avg_price_max: null, most_searched_listing_type: null };
}

// ============================================================================
// USER SAVED LISTINGS QUERIES
// ============================================================================

/**
 * Save a listing for a user
 *
 * @param userId - User UUID
 * @param listingId - Listing UUID
 * @param searchId - Optional search UUID that led to this save
 * @returns Saved listing record or null if already saved
 */
export async function saveListingForUser(
  userId: string,
  listingId: string,
  searchId?: string
): Promise<{ id: string; saved_at: Date } | null> {
  if (!supabase) {
    throw new Error('Supabase client is not initialized');
  }

  const { data, error } = await supabase
    .from('user_saved_listings')
    .insert({
      user_id: userId,
      listing_id: listingId,
      search_id: searchId || null,
    })
    .select()
    .single();

  if (error) {
    // Handle duplicate save gracefully
    if (error.code === '23505') {
      console.log('Listing already saved by user');
      return null;
    }
    throw new Error(`Failed to save listing: ${error.message}`);
  }

  return {
    id: data.id,
    saved_at: new Date(data.saved_at),
  };
}

/**
 * Remove a saved listing for a user
 *
 * @param userId - User UUID
 * @param listingId - Listing UUID
 */
export async function unsaveListingForUser(userId: string, listingId: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase client is not initialized');
  }

  const { error } = await supabase
    .from('user_saved_listings')
    .delete()
    .eq('user_id', userId)
    .eq('listing_id', listingId);

  if (error) {
    throw new Error(`Failed to unsave listing: ${error.message}`);
  }
}

/**
 * Get all saved listings for a user
 *
 * @param userId - User UUID
 * @returns Array of saved listings with full listing data
 */
export async function getUserSavedListings(userId: string): Promise<Array<{ listing: Listing; saved_at: Date }>> {
  if (!supabase) {
    throw new Error('Supabase client is not initialized');
  }

  const { data, error } = await supabase
    .from('user_saved_listings')
    .select('saved_at, listing:listings(*)')
    .eq('user_id', userId)
    .order('saved_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get saved listings: ${error.message}`);
  }

  return (data || []).map((item: any) => ({
    listing: dbListingToListing(item.listing as DatabaseListing),
    saved_at: new Date(item.saved_at),
  }));
}

/**
 * Check if a listing is saved by a user
 *
 * @param userId - User UUID
 * @param listingId - Listing UUID
 * @returns True if saved, false otherwise
 */
export async function isListingSaved(userId: string, listingId: string): Promise<boolean> {
  if (!supabase) {
    throw new Error('Supabase client is not initialized');
  }

  const { data, error } = await supabase.rpc('is_listing_saved', {
    check_user_id: userId,
    check_listing_id: listingId,
  });

  if (error) {
    throw new Error(`Failed to check if listing is saved: ${error.message}`);
  }

  return data ?? false;
}

// ============================================================================
// MAINTENANCE FUNCTIONS (Admin Only)
// ============================================================================

/**
 * Cleanup old searches (admin operation)
 *
 * @param daysToKeep - Number of days to keep (default 90)
 * @returns Number of deleted searches
 */
export async function cleanupOldSearches(daysToKeep: number = 90): Promise<number> {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client is not initialized');
  }

  const { data, error } = await supabaseAdmin.rpc('cleanup_old_searches', {
    days_to_keep: daysToKeep,
  });

  if (error) {
    throw new Error(`Failed to cleanup old searches: ${error.message}`);
  }

  return data ?? 0;
}

/**
 * Cleanup stale listings (admin operation)
 *
 * @param daysStale - Number of days without update to consider stale (default 30)
 * @returns Number of deleted listings
 */
export async function cleanupStaleListings(daysStale: number = 30): Promise<number> {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client is not initialized');
  }

  const { data, error } = await supabaseAdmin.rpc('cleanup_stale_listings', {
    days_stale: daysStale,
  });

  if (error) {
    throw new Error(`Failed to cleanup stale listings: ${error.message}`);
  }

  return data ?? 0;
}
