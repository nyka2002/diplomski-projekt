// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 0.1, // 10% of transactions

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Enable session replay for errors
  replaysOnErrorSampleRate: 1.0, // 100% capture on errors

  // Session replay sample rate (for non-error sessions)
  replaysSessionSampleRate: 0.1, // 10% of sessions

  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    Sentry.replayIntegration({
      // Additional options for replay
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],

  // Ignore common non-actionable errors
  ignoreErrors: [
    // Browser extensions
    /^chrome-extension:\/\//,
    /^moz-extension:\/\//,
    // Network errors
    'Network request failed',
    'Failed to fetch',
    'Load failed',
    // User aborted
    'AbortError',
    // ResizeObserver
    'ResizeObserver loop',
  ],

  // Environment configuration
  environment: process.env.NODE_ENV,

  // Release tracking (set by CI/CD)
  release: process.env.NEXT_PUBLIC_APP_VERSION || 'development',

  // Before sending events, you can filter or modify them
  beforeSend(event, hint) {
    // Don't send events in development by default
    if (process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_SENTRY_DSN) {
      return null;
    }
    return event;
  },
});
