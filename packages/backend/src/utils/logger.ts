/**
 * Centralized logging utility for the application
 *
 * This module provides a consistent logging interface by delegating to the unified monitoring system.
 * It maintains backward compatibility while using the unified logger internally.
 *
 * Usage:
 * ```
 * import { createLogger } from '@/utils/logger';
 *
 * const logger = createLogger('my-module');
 * logger.info('This is an info message');
 * logger.error('This is an error message', { error: err });
 * logger.debug('This is a debug message with context', { user: userId, action: 'login' });
 * ```
 */

import { unifiedLogger } from '../monitoring/unified';

// Export the unified logger instance
export { unifiedLogger as logger };

// Create a module-specific logger that adds module context
export function createLogger(moduleName: string) {
  // Create a child logger with module context
  return {
    error: (message: string, meta?: Record<string, unknown>) => {
      unifiedLogger.error(message, { module: moduleName, ...meta });
    },
    warn: (message: string, meta?: Record<string, unknown>) => {
      unifiedLogger.warn(message, { module: moduleName, ...meta });
    },
    info: (message: string, meta?: Record<string, unknown>) => {
      unifiedLogger.info(message, { module: moduleName, ...meta });
    },
    http: (message: string, meta?: Record<string, unknown>) => {
      unifiedLogger.http(message, { module: moduleName, ...meta });
    },
    debug: (message: string, meta?: Record<string, unknown>) => {
      unifiedLogger.debug(message, { module: moduleName, ...meta });
    },
    verbose: (message: string, meta?: Record<string, unknown>) => {
      unifiedLogger.verbose(message, { module: moduleName, ...meta });
    },
    silly: (message: string, meta?: Record<string, unknown>) => {
      unifiedLogger.silly(message, { module: moduleName, ...meta });
    },
  };
}

// Default logger instance for general use
const defaultLogger = createLogger('general');

// Stream for morgan middleware
export const stream = {
  write: (message: string) => {
    defaultLogger.http(message.trim());
  },
};

export default defaultLogger;
