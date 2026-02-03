/**
 * Refresh Token API Endpoint
 *
 * POST /api/auth/refresh
 *
 * Refresh the access token using a refresh token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  handleApiError,
  createSuccessResponse,
  ApiError,
} from '@/lib/api';
import { env } from '@/lib/env';

// ============================================================================
// TYPES
// ============================================================================

interface RefreshRequest {
  refresh_token: string;
}

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

    // Parse request body
    const body: RefreshRequest = await request.json();

    // Validate input
    if (!body.refresh_token || typeof body.refresh_token !== 'string') {
      throw new ApiError('Refresh token is required', 400, 'INVALID_TOKEN');
    }

    // Create Supabase client
    const supabase = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Refresh the session
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: body.refresh_token,
    });

    if (error) {
      if (error.message.includes('Invalid Refresh Token')) {
        throw new ApiError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
      }
      throw new ApiError(error.message, 401, 'REFRESH_FAILED');
    }

    if (!data.session || !data.user) {
      throw new ApiError('Failed to refresh session', 500, 'REFRESH_FAILED');
    }

    return NextResponse.json(
      createSuccessResponse({
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.name || null,
        },
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
          expires_in: data.session.expires_in,
        },
        message: 'Token refreshed successfully',
      }),
      { status: 200, headers: { 'X-Request-ID': requestId } }
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
