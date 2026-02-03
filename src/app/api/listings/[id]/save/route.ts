/**
 * Save/Unsave Listing API Endpoint
 *
 * POST /api/listings/[id]/save - Save listing to favorites
 * DELETE /api/listings/[id]/save - Remove listing from favorites
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
import {
  saveListingForUser,
  unsaveListingForUser,
  getListingById,
} from '@/lib/db-helpers';

// ============================================================================
// SAVE LISTING
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

    // Parse optional search_id from body
    let searchId: string | undefined;
    try {
      const body = await request.json();
      searchId = body.search_id;
    } catch {
      // No body or invalid JSON is fine
    }

    // Save the listing
    const result = await saveListingForUser(context.user!.id, id, searchId);

    if (result === null) {
      // Already saved
      const response = NextResponse.json(
        createSuccessResponse({ saved: true, message: 'Listing already saved' }),
        { status: 200 }
      );
      logResponse(context, 200);
      return addResponseHeaders(response, context);
    }

    const response = NextResponse.json(
      createSuccessResponse({
        saved: true,
        saved_at: result.saved_at,
        message: 'Listing saved successfully',
      }),
      { status: 201 }
    );

    logResponse(context, 201);
    return addResponseHeaders(response, context);
  } catch (error) {
    const response = handleApiError(error, context.requestId);
    logResponse(context, response.status, error instanceof Error ? error.message : 'Unknown error');
    return response;
  }
}

// ============================================================================
// UNSAVE LISTING
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

    // Unsave the listing
    await unsaveListingForUser(context.user!.id, id);

    const response = NextResponse.json(
      createSuccessResponse({
        saved: false,
        message: 'Listing removed from saved',
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
