/**
 * Re-run Search API Endpoint
 *
 * POST /api/searches/[id]/rerun
 *
 * Re-run a previous search with potentially updated listings.
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
import { getUserSearches, saveUserSearch } from '@/lib/db-helpers';
import { cacheSearchResults } from '@/lib/api/cache';
import { createAIServices } from '@/services/ai';
import { createSearchServices } from '@/services/search';
import { Listing } from '@/types/listing';

// ============================================================================
// REQUEST HANDLER
// ============================================================================

export async function POST(
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

  // Apply rate limiting (use chat limit as this is similar to a new search)
  const rateLimitResponse = await applyRateLimit(request, context, 'chat');
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
    const originalSearch = searches.find(s => s.id === id);

    if (!originalSearch) {
      const response = NextResponse.json(
        createErrorResponse('Search not found'),
        { status: 404 }
      );
      logResponse(context, 404);
      return addResponseHeaders(response, context);
    }

    // Initialize services
    const aiServices = createAIServices();
    const searchServices = createSearchServices(aiServices.embedding);

    // Re-run the search with the original query and filters
    const filters = originalSearch.extracted_filters || {};
    let listings: Listing[] = [];
    let totalMatches = 0;

    try {
      const searchResult = await searchServices.semantic.search(
        originalSearch.query_text,
        filters,
        { maxResults: 20 }
      );

      listings = searchResult.listings.map(r => r.listing);
      totalMatches = searchResult.totalMatches;

      // Cache the new results
      await cacheSearchResults(
        originalSearch.query_text,
        filters,
        listings,
        totalMatches,
        context.user!.id
      );

      // Save as a new search entry
      await saveUserSearch(
        context.user!.id,
        originalSearch.query_text,
        filters
      );
    } catch (error) {
      console.error('Search re-run failed:', error);
      // Fall back to filter-only search
      try {
        const fallbackResult = await searchServices.semantic.filterOnlySearch(
          filters,
          { maxResults: 20 }
        );

        listings = fallbackResult.listings.map(r => r.listing);
        totalMatches = fallbackResult.totalMatches;
      } catch (fallbackError) {
        console.error('Fallback search also failed:', fallbackError);
      }
    }

    const response = NextResponse.json(
      createSuccessResponse({
        original_query: originalSearch.query_text,
        filters,
        listings,
        total_matches: totalMatches,
        message: listings.length > 0
          ? `Pronađeno ${totalMatches} nekretnina prema vašim kriterijima.`
          : 'Nažalost, nema rezultata za ovaj upit. Pokušajte proširiti kriterije pretrage.',
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
