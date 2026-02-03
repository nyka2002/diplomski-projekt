/**
 * Search History API Endpoint
 *
 * GET /api/searches - Get user's search history
 *
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
import { getUserSearches, getUserSearchStats } from '@/lib/db-helpers';

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
  const rateLimitResponse = await applyRateLimit(request, context, 'search');
  if (rateLimitResponse) {
    logResponse(context, 429);
    return rateLimitResponse;
  }

  try {
    const url = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const includeStats = url.searchParams.get('include_stats') === 'true';

    // Get user's search history
    const searches = await getUserSearches(context.user!.id, limit);

    // Optionally get search statistics
    let stats = null;
    if (includeStats) {
      stats = await getUserSearchStats(context.user!.id);
    }

    const response = NextResponse.json(
      createSuccessResponse({
        searches,
        total: searches.length,
        stats,
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
