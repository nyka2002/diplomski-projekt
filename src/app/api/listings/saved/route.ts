/**
 * Saved Listings API Endpoint
 *
 * GET /api/listings/saved
 *
 * Retrieve user's saved/favorited listings.
 * Requires authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  requireAuth,
  applyRateLimit,
  handleApiError,
  createSuccessResponse,
  logRequest,
  logResponse,
  addResponseHeaders,
} from '@/lib/api';
import { getUserSavedListings } from '@/lib/db-helpers';
import { Listing } from '@/types/listing';

// ============================================================================
// TYPES
// ============================================================================

interface SavedListingItem {
  listing: Listing;
  saved_at: Date;
}

// ============================================================================
// REQUEST HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  // Require authentication
  const authResult = await requireAuth(request);
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
    // Get user's saved listings
    const savedListings: SavedListingItem[] = await getUserSavedListings(context.user!.id);

    const response = NextResponse.json(
      createSuccessResponse({
        listings: savedListings,
        total: savedListings.length,
      }),
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
