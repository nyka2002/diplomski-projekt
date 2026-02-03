// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 0.2, // 20% of server transactions

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Environment configuration
  environment: process.env.NODE_ENV,

  // Release tracking (set by CI/CD)
  release: process.env.NEXT_PUBLIC_APP_VERSION || 'development',

  // Integrations
  integrations: [
    // Capture unhandled promise rejections
    Sentry.captureConsoleIntegration({
      levels: ['error'],
    }),
  ],

  // Before sending events
  beforeSend(event, hint) {
    // Don't send events in development by default
    if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_DSN) {
      return null;
    }

    // Add additional context
    event.contexts = {
      ...event.contexts,
      runtime: {
        name: 'node',
        version: process.version,
      },
    };

    return event;
  },

  // Breadcrumb filtering
  beforeBreadcrumb(breadcrumb) {
    // Filter out noisy breadcrumbs
    if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
      return null;
    }
    return breadcrumb;
  },
});
