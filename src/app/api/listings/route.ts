/**
 * Listings API Endpoint
 *
 * GET /api/listings
 *
 * Retrieve property listings with optional filters and pagination.
 *
 * Query parameters:
 * - listing_type: 'rent' | 'sale'
 * - property_type: 'apartment' | 'house'
 * - city: string (location filter)
 * - price_min: number
 * - price_max: number
 * - rooms_min: number
 * - rooms_max: number
 * - has_parking: boolean
 * - has_balcony: boolean
 * - is_furnished: boolean
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  optionalAuth,
  applyRateLimit,
  handleApiError,
  createPaginatedResponse,
  logRequest,
  logResponse,
  parsePaginationParams,
  addResponseHeaders,
} from '@/lib/api';
import {
  getCachedListingCount,
  cacheListingCount,
} from '@/lib/api/cache';
import { getListings } from '@/lib/db-helpers';
import { supabase } from '@/lib/supabase';
import { ListingType, PropertyType, Listing } from '@/types/listing';

// ============================================================================
// REQUEST HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  // Optional authentication
  const authResult = await optionalAuth(request);
  if (!authResult.success) {
    return authResult.response;
  }

  const { context } = authResult;
  logRequest(request, context);

  // Apply rate limiting
  const rateLimitResponse = await applyRateLimit(request, context, 'listings');
  if (rateLimitResponse) {
    logResponse(context, 429);
    return rateLimitResponse;
  }

  try {
    const url = new URL(request.url);
    const { page, limit, offset } = parsePaginationParams(request);

    // Parse filter parameters
    const filters = parseFilterParams(url.searchParams);

    // Get listings with filters
    const listings = await getListings({
      ...filters,
      limit: limit + 1, // Fetch one extra to check if there are more
      offset,
    });

    // Check if there are more results
    const hasMore = listings.length > limit;
    const returnedListings = hasMore ? listings.slice(0, limit) : listings;

    // Get total count (use cached value if available)
    let total = await getCachedListingCount();
    if (total === null) {
      total = await getListingCount(filters);
      await cacheListingCount(total);
    }

    const response = NextResponse.json(
      createPaginatedResponse<Listing>(returnedListings, page, limit, total),
      { status: 200 }
    );

    logResponse(context, 200);
    return addResponseHeaders(response, context);
  } catch (error) {
    const response = handleApiError(error, context.requestId);
    logResponse(context, response.status, error instanceof Error ? error.message : 'Unknown error');
    return response;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

interface ListingFilters {
  listing_type?: ListingType;
  property_type?: PropertyType;
  city?: string;
  location?: string;
  price_min?: number;
  price_max?: number;
  rooms_min?: number;
  rooms_max?: number;
  has_parking?: boolean;
  has_balcony?: boolean;
  is_furnished?: boolean;
}

function parseFilterParams(searchParams: URLSearchParams): ListingFilters {
  const filters: ListingFilters = {};

  const listingType = searchParams.get('listing_type');
  if (listingType === 'rent' || listingType === 'sale') {
    filters.listing_type = listingType;
  }

  const propertyType = searchParams.get('property_type');
  if (propertyType === 'apartment' || propertyType === 'house') {
    filters.property_type = propertyType;
  }

  // Support both 'city' and 'location' parameters
  const city = searchParams.get('city') || searchParams.get('location');
  if (city) {
    filters.city = city;
  }

  const priceMin = searchParams.get('price_min');
  if (priceMin) {
    const parsed = parseFloat(priceMin);
    if (!isNaN(parsed) && parsed >= 0) {
      filters.price_min = parsed;
    }
  }

  const priceMax = searchParams.get('price_max');
  if (priceMax) {
    const parsed = parseFloat(priceMax);
    if (!isNaN(parsed) && parsed >= 0) {
      filters.price_max = parsed;
    }
  }

  const roomsMin = searchParams.get('rooms_min');
  if (roomsMin) {
    const parsed = parseInt(roomsMin, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      filters.rooms_min = parsed;
    }
  }

  const roomsMax = searchParams.get('rooms_max');
  if (roomsMax) {
    const parsed = parseInt(roomsMax, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      filters.rooms_max = parsed;
    }
  }

  const hasParking = searchParams.get('has_parking');
  if (hasParking === 'true' || hasParking === 'false') {
    filters.has_parking = hasParking === 'true';
  }

  const hasBalcony = searchParams.get('has_balcony');
  if (hasBalcony === 'true' || hasBalcony === 'false') {
    filters.has_balcony = hasBalcony === 'true';
  }

  const isFurnished = searchParams.get('is_furnished');
  if (isFurnished === 'true' || isFurnished === 'false') {
    filters.is_furnished = isFurnished === 'true';
  }

  return filters;
}

async function getListingCount(filters: ListingFilters): Promise<number> {
  if (!supabase) {
    return 0;
  }

  let query = supabase
    .from('listings')
    .select('*', { count: 'exact', head: true });

  // Apply same filters as getListings
  if (filters.listing_type) {
    query = query.eq('listing_type', filters.listing_type);
  }
  if (filters.property_type) {
    query = query.eq('property_type', filters.property_type);
  }
  // Support partial matching on location/city
  const cityFilter = filters.city || filters.location;
  if (cityFilter) {
    query = query.ilike('location_city', `%${cityFilter}%`);
  }
  if (filters.price_min !== undefined) {
    query = query.gte('price', filters.price_min);
  }
  if (filters.price_max !== undefined) {
    query = query.lte('price', filters.price_max);
  }
  if (filters.rooms_min !== undefined) {
    query = query.gte('rooms', filters.rooms_min);
  }
  if (filters.rooms_max !== undefined) {
    query = query.lte('rooms', filters.rooms_max);
  }
  if (filters.has_parking !== undefined) {
    query = query.eq('has_parking', filters.has_parking);
  }
  if (filters.has_balcony !== undefined) {
    query = query.eq('has_balcony', filters.has_balcony);
  }
  if (filters.is_furnished !== undefined) {
    query = query.eq('is_furnished', filters.is_furnished);
  }

  const { count, error } = await query;

  if (error) {
    console.error('Error getting listing count:', error);
    return 0;
  }

  return count || 0;
}
