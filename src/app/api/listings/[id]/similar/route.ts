/**
 * Similar Listings API Endpoint
 *
 * GET /api/listings/[id]/similar
 *
 * Find listings similar to a given listing using semantic similarity.
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
import { getListingById } from '@/lib/db-helpers';
import { createAIServices } from '@/services/ai';
import { createSearchServices } from '@/services/search';

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
    const url = new URL(request.url);
    const limit = Math.min(20, Math.max(1, parseInt(url.searchParams.get('limit') || '5', 10)));

    // Validate UUID format
    if (!isValidUUID(id)) {
      const response = NextResponse.json(
        createErrorResponse('Invalid listing ID format'),
        { status: 400 }
      );
      logResponse(context, 400);
      return addResponseHeaders(response, context);
    }

    // Check if listing exists
    const listing = await getListingById(id);
    if (!listing) {
      const response = NextResponse.json(
        createErrorResponse('Listing not found'),
        { status: 404 }
      );
      logResponse(context, 404);
      return addResponseHeaders(response, context);
    }

    // Initialize services
    const aiServices = createAIServices();
    const searchServices = createSearchServices(aiServices.embedding);

    // Find similar listings
    const searchResult = await searchServices.semantic.findSimilar(id, limit);

    const response = NextResponse.json(
      createSuccessResponse({
        base_listing: {
          id: listing.id,
          title: listing.title,
          price: listing.price,
          location_city: listing.location_city,
        },
        similar_listings: searchResult.listings.map(item => ({
          listing: item.listing,
          similarity_score: item.scores.semanticScore,
        })),
        total: searchResult.totalMatches,
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

// ============================================================================
// HELPERS
// ============================================================================

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}
