/**
 * User Profile API Endpoint
 *
 * GET /api/user/profile - Get current user profile
 * PATCH /api/user/profile - Update user profile
 *
 * Requires authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  requireAuth,
  handleApiError,
  createSuccessResponse,
  createErrorResponse,
  logRequest,
  logResponse,
  addResponseHeaders,
  ApiError,
} from '@/lib/api';
import { getUserSearchStats, getUserSavedListings } from '@/lib/db-helpers';
import { env } from '@/lib/env';

// ============================================================================
// GET USER PROFILE
// ============================================================================

export async function GET(request: NextRequest) {
  // Require authentication
  const authResult = await requireAuth(request);
  if (!authResult.success) {
    return authResult.response;
  }

  const { context } = authResult;
  logRequest(request, context);

  try {
    // Get user stats
    const [searchStats, savedListings] = await Promise.all([
      getUserSearchStats(context.user!.id).catch(() => ({
        total_searches: 0,
        most_common_city: null,
        avg_price_max: null,
        most_searched_listing_type: null,
      })),
      getUserSavedListings(context.user!.id).catch(() => []),
    ]);

    const response = NextResponse.json(
      createSuccessResponse({
        user: {
          id: context.user!.id,
          email: context.user!.email,
        },
        stats: {
          total_searches: searchStats.total_searches,
          saved_listings_count: savedListings.length,
          most_common_city: searchStats.most_common_city,
          most_searched_type: searchStats.most_searched_listing_type,
          avg_price_max: searchStats.avg_price_max,
        },
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
// UPDATE USER PROFILE
// ============================================================================

interface UpdateProfileRequest {
  name?: string;
}

export async function PATCH(request: NextRequest) {
  // Require authentication
  const authResult = await requireAuth(request);
  if (!authResult.success) {
    return authResult.response;
  }

  const { context } = authResult;
  logRequest(request, context);

  try {
    // Validate environment
    if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      throw new ApiError('Authentication service not configured', 503);
    }

    // Parse request body
    const body: UpdateProfileRequest = await request.json();

    // Get the token from the Authorization header
    const authHeader = request.headers.get('Authorization');
    const token = authHeader!.slice(7);

    // Create Supabase client
    const supabase = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    // Update user metadata
    const { data, error } = await supabase.auth.updateUser({
      data: {
        name: body.name,
      },
    });

    if (error) {
      throw new ApiError(error.message, 400, 'UPDATE_FAILED');
    }

    const response = NextResponse.json(
      createSuccessResponse({
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.name || null,
        },
        message: 'Profile updated successfully',
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
