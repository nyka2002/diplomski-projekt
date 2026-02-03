/**
 * Logout API Endpoint
 *
 * POST /api/auth/logout
 *
 * Sign out the current user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  handleApiError,
  createSuccessResponse,
  ApiError,
} from '@/lib/api';
import { deleteChatContext } from '@/lib/api/cache';
import { env } from '@/lib/env';

// ============================================================================
// REQUEST HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now().toString(36)}`;

  try {
    // Validate environment
    if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      throw new ApiError('Authentication service not configured', 503);
    }

    // Get the token from the Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError('Authorization token required', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.slice(7);

    // Create Supabase client with the user's token
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

    // Get the current user to retrieve their ID for cache cleanup
    const { data: { user } } = await supabase.auth.getUser(token);

    // Sign out
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new ApiError(error.message, 500, 'LOGOUT_FAILED');
    }

    // Clean up any cached chat contexts for this user
    if (user?.id) {
      try {
        // Note: In a production app, you'd want to track session IDs per user
        // For now, we just acknowledge the logout
        console.log(`User ${user.id} logged out`);
      } catch (cacheError) {
        console.error('Error cleaning up cache:', cacheError);
        // Don't fail the logout if cache cleanup fails
      }
    }

    return NextResponse.json(
      createSuccessResponse({
        logged_out: true,
        message: 'Logged out successfully',
      }),
      { status: 200, headers: { 'X-Request-ID': requestId } }
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
