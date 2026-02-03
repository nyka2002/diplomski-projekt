/**
 * Monitoring Utilities
 *
 * Unified interface for error tracking, performance monitoring, and analytics.
 * Uses Sentry for error tracking and custom metrics.
 */

import * as Sentry from '@sentry/nextjs';

/**
 * Track a custom event
 */
export function trackEvent(
  name: string,
  data?: Record<string, unknown>
): void {
  if (typeof window !== 'undefined') {
    Sentry.addBreadcrumb({
      category: 'custom',
      message: name,
      data,
      level: 'info',
    });
  }
}

/**
 * Track an error with additional context
 */
export function trackError(
  error: Error | string,
  context?: Record<string, unknown>
): void {
  const errorObj = typeof error === 'string' ? new Error(error) : error;

  Sentry.captureException(errorObj, {
    extra: context,
  });
}

/**
 * Track a performance metric
 */
export function trackPerformance(
  name: string,
  durationMs: number,
  data?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    category: 'performance',
    message: `${name}: ${durationMs}ms`,
    data: { ...data, duration: durationMs },
    level: 'info',
  });

  // Also track as a custom measurement if in a transaction
  const transaction = Sentry.getActiveSpan();
  if (transaction) {
    Sentry.setMeasurement(name, durationMs, 'millisecond');
  }
}

/**
 * Set user context for error tracking
 */
export function setUserContext(user: {
  id: string;
  email?: string;
  username?: string;
}): void {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
  });
}

/**
 * Clear user context (on logout)
 */
export function clearUserContext(): void {
  Sentry.setUser(null);
}

/**
 * Add custom tags for filtering
 */
export function setTags(tags: Record<string, string>): void {
  Object.entries(tags).forEach(([key, value]) => {
    Sentry.setTag(key, value);
  });
}

/**
 * Create a performance span for measuring operations
 */
export function startSpan<T>(
  name: string,
  operation: string,
  callback: () => T | Promise<T>
): T | Promise<T> {
  return Sentry.startSpan(
    {
      name,
      op: operation,
    },
    callback
  );
}

/**
 * Track API response time
 */
export function trackApiCall(
  endpoint: string,
  method: string,
  statusCode: number,
  durationMs: number
): void {
  Sentry.addBreadcrumb({
    category: 'api',
    message: `${method} ${endpoint}`,
    data: {
      statusCode,
      duration: durationMs,
    },
    level: statusCode >= 400 ? 'error' : 'info',
  });
}

/**
 * Track search query for analytics
 */
export function trackSearch(
  query: string,
  resultCount: number,
  filters?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    category: 'search',
    message: `Search: "${query.substring(0, 50)}..."`,
    data: {
      resultCount,
      filters,
    },
    level: 'info',
  });
}

/**
 * Track AI operation
 */
export function trackAiOperation(
  operation: 'extraction' | 'embedding' | 'chat' | 'ranking',
  durationMs: number,
  tokenUsage?: { input: number; output: number }
): void {
  Sentry.addBreadcrumb({
    category: 'ai',
    message: `AI ${operation}`,
    data: {
      duration: durationMs,
      ...tokenUsage,
    },
    level: 'info',
  });
}

/**
 * Track scraping operation
 */
export function trackScraping(
  source: string,
  listingsScraped: number,
  errors: number,
  durationMs: number
): void {
  Sentry.addBreadcrumb({
    category: 'scraping',
    message: `Scraped ${source}`,
    data: {
      listingsScraped,
      errors,
      duration: durationMs,
    },
    level: errors > 0 ? 'warning' : 'info',
  });
}

/**
 * Flush pending events (useful before shutdown)
 */
export async function flushMonitoring(timeout = 2000): Promise<void> {
  await Sentry.flush(timeout);
}

/**
 * Check if monitoring is configured
 */
export function isMonitoringEnabled(): boolean {
  return !!process.env.NEXT_PUBLIC_SENTRY_DSN || !!process.env.SENTRY_DSN;
}
