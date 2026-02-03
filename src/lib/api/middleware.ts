/**
 * API Middleware Utilities
 *
 * Provides reusable middleware functions for:
 * - Authentication (Supabase JWT)
 * - Rate limiting (Redis-based)
 * - Error handling
 * - Logging
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import redis from '@/lib/redis';
import { env } from '@/lib/env';
import { ApiResponse } from '@/types/api';

// ============================================================================
// TYPES
// ============================================================================

export interface AuthenticatedUser {
  id: string;
  email?: string;
  role?: string;
}

export interface RequestContext {
  user?: AuthenticatedUser;
  startTime: number;
  requestId: string;
}

export type MiddlewareResult =
  | { success: true; context: RequestContext }
  | { success: false; response: NextResponse };

// ============================================================================
// AUTHENTICATION
// ============================================================================

/**
 * Extract and verify user from Supabase JWT token
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<{ user: AuthenticatedUser | null; error?: string }> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null };
  }

  const token = authHeader.slice(7);

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('Supabase configuration missing');
    return { user: null, error: 'Authentication service unavailable' };
  }

  try {
    const supabase = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return { user: null, error: 'Invalid or expired token' };
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return { user: null, error: 'Authentication failed' };
  }
}

/**
 * Middleware that requires authentication
 * Returns 401 if not authenticated
 */
export async function requireAuth(
  request: NextRequest
): Promise<MiddlewareResult> {
  const startTime = Date.now();
  const requestId = generateRequestId();

  const { user, error } = await authenticateRequest(request);

  if (!user) {
    return {
      success: false,
      response: NextResponse.json(
        createErrorResponse(error || 'Authentication required'),
        { status: 401, headers: { 'X-Request-ID': requestId } }
      ),
    };
  }

  return {
    success: true,
    context: { user, startTime, requestId },
  };
}

/**
 * Middleware that allows optional authentication
 * Continues without user if not authenticated
 */
export async function optionalAuth(
  request: NextRequest
): Promise<MiddlewareResult> {
  const startTime = Date.now();
  const requestId = generateRequestId();

  const { user } = await authenticateRequest(request);

  return {
    success: true,
    context: { user: user || undefined, startTime, requestId },
  };
}

// ============================================================================
// RATE LIMITING
// ============================================================================

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  keyPrefix: string;     // Redis key prefix
}

const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  chat: { windowMs: 60000, maxRequests: 30, keyPrefix: 'rl:chat' },
  search: { windowMs: 60000, maxRequests: 60, keyPrefix: 'rl:search' },
  listings: { windowMs: 60000, maxRequests: 120, keyPrefix: 'rl:listings' },
  default: { windowMs: 60000, maxRequests: 100, keyPrefix: 'rl:default' },
};

/**
 * Check rate limit for a request
 */
export async function checkRateLimit(
  identifier: string,
  configKey: string = 'default'
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const config = DEFAULT_RATE_LIMITS[configKey] || DEFAULT_RATE_LIMITS.default;

  if (!redis) {
    // If Redis is unavailable, allow all requests
    return { allowed: true, remaining: config.maxRequests, resetAt: Date.now() + config.windowMs };
  }

  const key = `${config.keyPrefix}:${identifier}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  try {
    // Use Redis sorted set for sliding window rate limiting
    const multi = redis.multi();

    // Remove old entries
    multi.zremrangebyscore(key, 0, windowStart);

    // Count current requests
    multi.zcard(key);

    // Add new request
    multi.zadd(key, now, `${now}:${Math.random()}`);

    // Set expiry
    multi.expire(key, Math.ceil(config.windowMs / 1000) + 1);

    const results = await multi.exec();

    if (!results) {
      return { allowed: true, remaining: config.maxRequests, resetAt: now + config.windowMs };
    }

    const currentCount = (results[1]?.[1] as number) || 0;
    const allowed = currentCount < config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - currentCount - 1);

    return {
      allowed,
      remaining,
      resetAt: now + config.windowMs,
    };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Allow request on error
    return { allowed: true, remaining: config.maxRequests, resetAt: now + config.windowMs };
  }
}

/**
 * Apply rate limiting middleware
 */
export async function applyRateLimit(
  request: NextRequest,
  context: RequestContext,
  configKey: string = 'default'
): Promise<NextResponse | null> {
  // Use user ID if authenticated, otherwise use IP
  const identifier = context.user?.id ||
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    'anonymous';

  const { allowed, remaining, resetAt } = await checkRateLimit(identifier, configKey);

  if (!allowed) {
    return NextResponse.json(
      createErrorResponse('Rate limit exceeded. Please try again later.'),
      {
        status: 429,
        headers: {
          'X-Request-ID': context.requestId,
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': resetAt.toString(),
          'Retry-After': Math.ceil((resetAt - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  return null; // Continue processing
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Handle API errors and return appropriate response
 */
export function handleApiError(
  error: unknown,
  requestId: string
): NextResponse {
  console.error(`[${requestId}] API Error:`, error);

  if (error instanceof ApiError) {
    return NextResponse.json(
      createErrorResponse(error.message, error.code),
      { status: error.statusCode, headers: { 'X-Request-ID': requestId } }
    );
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json(
      createErrorResponse('Invalid JSON in request body', 'INVALID_JSON'),
      { status: 400, headers: { 'X-Request-ID': requestId } }
    );
  }

  // Generic error
  return NextResponse.json(
    createErrorResponse('Internal server error', 'INTERNAL_ERROR'),
    { status: 500, headers: { 'X-Request-ID': requestId } }
  );
}

// ============================================================================
// LOGGING
// ============================================================================

interface LogEntry {
  requestId: string;
  method: string;
  path: string;
  userId?: string;
  duration?: number;
  status?: number;
  error?: string;
}

/**
 * Log API request
 */
export function logRequest(
  request: NextRequest,
  context: RequestContext
): void {
  const entry: LogEntry = {
    requestId: context.requestId,
    method: request.method,
    path: new URL(request.url).pathname,
    userId: context.user?.id,
  };

  console.log(`[${entry.requestId}] ${entry.method} ${entry.path} ${entry.userId ? `user=${entry.userId}` : 'anonymous'}`);
}

/**
 * Log API response
 */
export function logResponse(
  context: RequestContext,
  status: number,
  error?: string
): void {
  const duration = Date.now() - context.startTime;

  const logLine = `[${context.requestId}] Response: ${status} (${duration}ms)`;

  if (error) {
    console.error(logLine, { error });
  } else {
    console.log(logLine);
  }
}

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

/**
 * Create standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string
): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
  };
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  error: string,
  code?: string
): ApiResponse<never> {
  return {
    success: false,
    error,
    message: code,
  };
}

/**
 * Create paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number
): ApiResponse<T[]> & { pagination: { page: number; limit: number; total: number; totalPages: number } } {
  return {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Parse pagination parameters from request
 */
export function parsePaginationParams(request: NextRequest): { page: number; limit: number; offset: number } {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Add response headers
 */
export function addResponseHeaders(
  response: NextResponse,
  context: RequestContext
): NextResponse {
  response.headers.set('X-Request-ID', context.requestId);
  response.headers.set('X-Response-Time', `${Date.now() - context.startTime}ms`);
  return response;
}
