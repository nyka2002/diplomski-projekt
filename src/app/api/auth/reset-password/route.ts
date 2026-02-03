/**
 * Password Reset API Endpoints
 *
 * POST /api/auth/reset-password - Request password reset email
 * PUT /api/auth/reset-password - Set new password with reset token
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
// REQUEST PASSWORD RESET
// ============================================================================

interface ResetRequestBody {
  email: string;
}

export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now().toString(36)}`;

  try {
    // Validate environment
    if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      throw new ApiError('Authentication service not configured', 503);
    }

    // Parse request body
    const body: ResetRequestBody = await request.json();

    // Validate input
    if (!body.email || typeof body.email !== 'string') {
      throw new ApiError('Email is required', 400, 'INVALID_EMAIL');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      throw new ApiError('Invalid email format', 400, 'INVALID_EMAIL');
    }

    // Create Supabase client
    const supabase = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Request password reset
    const { error } = await supabase.auth.resetPasswordForEmail(
      body.email.toLowerCase().trim(),
      {
        redirectTo: `${env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password`,
      }
    );

    if (error) {
      // Don't reveal if email exists or not for security
      console.error('Password reset error:', error);
    }

    // Always return success to prevent email enumeration
    return NextResponse.json(
      createSuccessResponse({
        message: 'If an account with this email exists, you will receive a password reset link.',
      }),
      { status: 200, headers: { 'X-Request-ID': requestId } }
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

// ============================================================================
// SET NEW PASSWORD
// ============================================================================

interface SetPasswordBody {
  password: string;
}

export async function PUT(request: NextRequest) {
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

    // Parse request body
    const body: SetPasswordBody = await request.json();

    // Validate password
    if (!body.password || typeof body.password !== 'string') {
      throw new ApiError('Password is required', 400, 'INVALID_PASSWORD');
    }

    if (body.password.length < 8) {
      throw new ApiError('Password must be at least 8 characters', 400, 'WEAK_PASSWORD');
    }

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

    // Update password
    const { data, error } = await supabase.auth.updateUser({
      password: body.password,
    });

    if (error) {
      throw new ApiError(error.message, 400, 'PASSWORD_UPDATE_FAILED');
    }

    if (!data.user) {
      throw new ApiError('Failed to update password', 500, 'PASSWORD_UPDATE_FAILED');
    }

    return NextResponse.json(
      createSuccessResponse({
        message: 'Password updated successfully. Please log in with your new password.',
      }),
      { status: 200, headers: { 'X-Request-ID': requestId } }
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
