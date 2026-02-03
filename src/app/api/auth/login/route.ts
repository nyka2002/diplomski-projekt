/**
 * Login API Endpoint
 *
 * POST /api/auth/login
 *
 * Authenticate user with email and password.
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

interface LoginRequest {
  email: string;
  password: string;
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
    const body: LoginRequest = await request.json();

    // Validate input
    if (!body.email || typeof body.email !== 'string') {
      throw new ApiError('Email is required', 400, 'INVALID_EMAIL');
    }

    if (!body.password || typeof body.password !== 'string') {
      throw new ApiError('Password is required', 400, 'INVALID_PASSWORD');
    }

    // Create Supabase client
    const supabase = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Attempt login
    const { data, error } = await supabase.auth.signInWithPassword({
      email: body.email.toLowerCase().trim(),
      password: body.password,
    });

    if (error) {
      // Handle specific errors
      if (error.message.includes('Invalid login credentials')) {
        throw new ApiError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }
      if (error.message.includes('Email not confirmed')) {
        throw new ApiError('Please confirm your email address before logging in', 403, 'EMAIL_NOT_CONFIRMED');
      }
      throw new ApiError(error.message, 401, 'LOGIN_FAILED');
    }

    if (!data.session || !data.user) {
      throw new ApiError('Login failed', 500, 'LOGIN_FAILED');
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
        message: 'Login successful',
      }),
      { status: 200, headers: { 'X-Request-ID': requestId } }
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
