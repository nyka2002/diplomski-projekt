/**
 * Sign Up API Endpoint
 *
 * POST /api/auth/signup
 *
 * Create a new user account.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  handleApiError,
  createSuccessResponse,
  createErrorResponse,
  ApiError,
} from '@/lib/api';
import { env } from '@/lib/env';

// ============================================================================
// TYPES
// ============================================================================

interface SignUpRequest {
  email: string;
  password: string;
  name?: string;
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
    const body: SignUpRequest = await request.json();

    // Validate input
    if (!body.email || typeof body.email !== 'string') {
      throw new ApiError('Email is required', 400, 'INVALID_EMAIL');
    }

    if (!body.password || typeof body.password !== 'string') {
      throw new ApiError('Password is required', 400, 'INVALID_PASSWORD');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      throw new ApiError('Invalid email format', 400, 'INVALID_EMAIL');
    }

    // Validate password strength
    if (body.password.length < 8) {
      throw new ApiError('Password must be at least 8 characters', 400, 'WEAK_PASSWORD');
    }

    // Create Supabase client
    const supabase = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Sign up user
    const { data, error } = await supabase.auth.signUp({
      email: body.email.toLowerCase().trim(),
      password: body.password,
      options: {
        data: {
          name: body.name || '',
        },
      },
    });

    if (error) {
      // Handle specific Supabase errors
      if (error.message.includes('already registered')) {
        throw new ApiError('An account with this email already exists', 409, 'EMAIL_EXISTS');
      }
      throw new ApiError(error.message, 400, 'SIGNUP_FAILED');
    }

    if (!data.user) {
      throw new ApiError('Failed to create account', 500, 'SIGNUP_FAILED');
    }

    // Check if email confirmation is required
    const requiresConfirmation = !data.session;

    return NextResponse.json(
      createSuccessResponse({
        user: {
          id: data.user.id,
          email: data.user.email,
        },
        requires_confirmation: requiresConfirmation,
        message: requiresConfirmation
          ? 'Account created. Please check your email to confirm your account.'
          : 'Account created successfully.',
      }),
      { status: 201, headers: { 'X-Request-ID': requestId } }
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
