/**
 * Structured Logger Utility
 *
 * Provides consistent logging across the application with support for:
 * - Structured context data
 * - Log levels (debug, info, warn, error)
 * - Request ID tracking
 * - Sentry integration for errors
 * - Environment-aware logging (less verbose in production)
 */

import * as Sentry from '@sentry/nextjs';

// Log levels
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Context type for structured logging
interface LogContext {
  requestId?: string;
  userId?: string;
  service?: string;
  duration?: number;
  [key: string]: unknown;
}

// Error context for error logging
interface ErrorContext extends LogContext {
  code?: string;
  stack?: string;
}

// Logger configuration
interface LoggerConfig {
  minLevel: LogLevel;
  includeTimestamp: boolean;
  includeLevel: boolean;
  sentryEnabled: boolean;
}

// Default configuration
const defaultConfig: LoggerConfig = {
  minLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  includeTimestamp: true,
  includeLevel: true,
  sentryEnabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN),
};

// Log level hierarchy
const levelHierarchy: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Check if a log level should be emitted
 */
function shouldLog(level: LogLevel, config: LoggerConfig): boolean {
  return levelHierarchy[level] >= levelHierarchy[config.minLevel];
}

/**
 * Format a log message with context
 */
function formatMessage(
  level: LogLevel,
  message: string,
  context?: LogContext,
  config?: LoggerConfig
): string {
  const cfg = config || defaultConfig;
  const parts: string[] = [];

  if (cfg.includeTimestamp) {
    parts.push(`[${new Date().toISOString()}]`);
  }

  if (cfg.includeLevel) {
    parts.push(`[${level.toUpperCase()}]`);
  }

  if (context?.requestId) {
    parts.push(`[${context.requestId}]`);
  }

  if (context?.service) {
    parts.push(`[${context.service}]`);
  }

  parts.push(message);

  return parts.join(' ');
}

/**
 * Format context for console output
 */
function formatContext(context?: LogContext): Record<string, unknown> | undefined {
  if (!context) return undefined;

  // Remove internal keys that are already in the message
  const { requestId, service, ...rest } = context;

  // Only return if there are remaining keys
  if (Object.keys(rest).length === 0) return undefined;

  return rest;
}

/**
 * Logger class for scoped logging
 */
class Logger {
  private config: LoggerConfig;
  private defaultContext: LogContext;

  constructor(config?: Partial<LoggerConfig>, defaultContext?: LogContext) {
    this.config = { ...defaultConfig, ...config };
    this.defaultContext = defaultContext || {};
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger {
    return new Logger(this.config, { ...this.defaultContext, ...context });
  }

  /**
   * Debug level logging
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  /**
   * Info level logging
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Warning level logging
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Error level logging
   */
  error(message: string, error?: Error, context?: ErrorContext): void {
    const mergedContext: ErrorContext = {
      ...this.defaultContext,
      ...context,
    };

    if (error) {
      mergedContext.stack = error.stack;
      if ('code' in error) {
        mergedContext.code = (error as Error & { code?: string }).code;
      }
    }

    this.log('error', message, mergedContext);

    // Send to Sentry if enabled
    if (this.config.sentryEnabled && error) {
      Sentry.withScope((scope) => {
        // Add context to Sentry
        if (mergedContext.requestId) {
          scope.setTag('requestId', mergedContext.requestId);
        }
        if (mergedContext.userId) {
          scope.setUser({ id: mergedContext.userId });
        }
        if (mergedContext.service) {
          scope.setTag('service', mergedContext.service);
        }
        if (mergedContext.code) {
          scope.setTag('error_code', mergedContext.code);
        }

        // Add extra data
        scope.setExtras({
          ...formatContext(mergedContext),
          message,
        });

        Sentry.captureException(error);
      });
    }
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (!shouldLog(level, this.config)) return;

    const mergedContext = { ...this.defaultContext, ...context };
    const formattedMessage = formatMessage(level, message, mergedContext, this.config);
    const contextData = formatContext(mergedContext);

    switch (level) {
      case 'debug':
        if (contextData) {
          console.debug(formattedMessage, contextData);
        } else {
          console.debug(formattedMessage);
        }
        break;
      case 'info':
        if (contextData) {
          console.info(formattedMessage, contextData);
        } else {
          console.info(formattedMessage);
        }
        break;
      case 'warn':
        if (contextData) {
          console.warn(formattedMessage, contextData);
        } else {
          console.warn(formattedMessage);
        }
        break;
      case 'error':
        if (contextData) {
          console.error(formattedMessage, contextData);
        } else {
          console.error(formattedMessage);
        }
        break;
    }
  }
}

// Export singleton logger instance
export const logger = new Logger();

// Export Logger class for creating scoped loggers
export { Logger };

// Export types
export type { LogLevel, LogContext, ErrorContext, LoggerConfig };

/**
 * Convenience function to create a request-scoped logger
 */
export function createRequestLogger(requestId: string, userId?: string): Logger {
  return logger.child({
    requestId,
    userId,
  });
}

/**
 * Convenience function to create a service-scoped logger
 */
export function createServiceLogger(service: string): Logger {
  return logger.child({ service });
}

/**
 * Performance measurement utility
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  serviceLogger?: Logger
): Promise<T> {
  const log = serviceLogger || logger;
  const start = performance.now();

  try {
    const result = await fn();
    const duration = performance.now() - start;
    log.info(`${name} completed`, { duration: Math.round(duration) });
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    log.error(`${name} failed`, error as Error, { duration: Math.round(duration) });
    throw error;
  }
}

/**
 * Synchronous performance measurement utility
 */
export function measureSync<T>(
  name: string,
  fn: () => T,
  serviceLogger?: Logger
): T {
  const log = serviceLogger || logger;
  const start = performance.now();

  try {
    const result = fn();
    const duration = performance.now() - start;
    log.info(`${name} completed`, { duration: Math.round(duration) });
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    log.error(`${name} failed`, error as Error, { duration: Math.round(duration) });
    throw error;
  }
}
