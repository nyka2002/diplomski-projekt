/**
 * Single Search API Endpoint
 *
 * GET /api/searches/[id] - Get search details with cached results
 * DELETE /api/searches/[id] - Delete search from history
 *
 * Requires authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  requireAuth,
  applyRateLimit,
  handleApiError,
  createSuccessResponse,
  createErrorResponse,
  logRequest,
  logResponse,
  addResponseHeaders,
} from '@/lib/api';
import { deleteUserSearch, getUserSearches } from '@/lib/db-helpers';
import { getCachedSearchResults } from '@/lib/api/cache';

// ============================================================================
// GET SEARCH DETAILS
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require authentication
  const authResult = await requireAuth(request);
  if (!authResult.success) {
    return authResult.response;
  }

  const { context } = authResult;
  logRequest(request, context);

  // Apply rate limiting
  const rateLimitResponse = await applyRateLimit(request, context, 'search');
  if (rateLimitResponse) {
    logResponse(context, 429);
    return rateLimitResponse;
  }

  try {
    const { id } = await params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      const response = NextResponse.json(
        createErrorResponse('Invalid search ID format'),
        { status: 400 }
      );
      logResponse(context, 400);
      return addResponseHeaders(response, context);
    }

    // Get user's searches and find the requested one
    const searches = await getUserSearches(context.user!.id, 100);
    const search = searches.find(s => s.id === id);

    if (!search) {
      const response = NextResponse.json(
        createErrorResponse('Search not found'),
        { status: 404 }
      );
      logResponse(context, 404);
      return addResponseHeaders(response, context);
    }

    // Try to get cached results for this search
    let cachedResults = null;
    if (search.extracted_filters) {
      cachedResults = await getCachedSearchResults(
        search.query_text,
        search.extracted_filters,
        context.user!.id
      );
    }

    const response = NextResponse.json(
      createSuccessResponse({
        search,
        cached_results: cachedResults ? {
          listings: cachedResults.listings,
          total_matches: cachedResults.totalMatches,
          cached_at: cachedResults.cachedAt,
        } : null,
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
// DELETE SEARCH
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require authentication
  const authResult = await requireAuth(request);
  if (!authResult.success) {
    return authResult.response;
  }

  const { context } = authResult;
  logRequest(request, context);

  // Apply rate limiting
  const rateLimitResponse = await applyRateLimit(request, context, 'search');
  if (rateLimitResponse) {
    logResponse(context, 429);
    return rateLimitResponse;
  }

  try {
    const { id } = await params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      const response = NextResponse.json(
        createErrorResponse('Invalid search ID format'),
        { status: 400 }
      );
      logResponse(context, 400);
      return addResponseHeaders(response, context);
    }

    // Delete the search (RLS ensures user can only delete their own searches)
    await deleteUserSearch(context.user!.id, id);

    const response = NextResponse.json(
      createSuccessResponse({
        deleted: true,
        message: 'Search deleted successfully',
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
