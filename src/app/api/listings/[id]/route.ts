/**
 * Single Listing API Endpoint
 *
 * GET /api/listings/[id]
 *
 * Retrieve a single property listing by ID.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  optionalAuth,
  applyRateLimit,
  handleApiError,
  createSuccessResponse,
  createErrorResponse,
  logRequest,
  logResponse,
  addResponseHeaders,
} from '@/lib/api';
import {
  getCachedListing,
  cacheListing,
} from '@/lib/api/cache';
import { getListingById, isListingSaved, findSimilarListings } from '@/lib/db-helpers';
import { Listing } from '@/types/listing';

// ============================================================================
// TYPES
// ============================================================================

interface ListingDetailResponse {
  listing: Listing;
  is_saved: boolean;
  similar_listings: Array<{ id: string; title: string; price: number; similarity: number }>;
}

// ============================================================================
// REQUEST HANDLER
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      const response = NextResponse.json(
        createErrorResponse('Invalid listing ID format'),
        { status: 400 }
      );
      logResponse(context, 400);
      return addResponseHeaders(response, context);
    }

    // Try to get from cache first
    let listing = await getCachedListing<Listing>(id);

    if (!listing) {
      // Fetch from database
      listing = await getListingById(id);

      if (!listing) {
        const response = NextResponse.json(
          createErrorResponse('Listing not found'),
          { status: 404 }
        );
        logResponse(context, 404);
        return addResponseHeaders(response, context);
      }

      // Cache the listing
      await cacheListing(id, listing);
    }

    // Check if listing is saved by user (if authenticated)
    let isSaved = false;
    if (context.user?.id) {
      isSaved = await isListingSaved(context.user.id, id);
    }

    // Get similar listings
    let similarListings: Array<{ id: string; title: string; price: number; similarity: number }> = [];
    try {
      similarListings = await findSimilarListings(id, 0.7, 5);
    } catch (error) {
      console.error('Error fetching similar listings:', error);
      // Continue without similar listings
    }

    const responseData: ListingDetailResponse = {
      listing,
      is_saved: isSaved,
      similar_listings: similarListings,
    };

    const response = NextResponse.json(
      createSuccessResponse(responseData),
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

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}
