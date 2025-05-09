/**
 * Centralized logging utility for the frontend application
 *
 * This module provides a consistent logging interface with different log levels
 * and the ability to send logs to the server in production environments.
 *
 * Usage:
 * ```
 * import logger from '@/utils/logger';
 *
 * logger.info('User logged in', { userId: '123' });
 * logger.error('Failed to load data', { error });
 * logger.debug('Component rendered', { props });
 * ```
 */

// Define log levels for backward compatibility
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

// Create a simplified logger without external dependencies
const createLogger = (namespace: string) => {
  return {
    debug(message: string, ...args: any[]) {
      if (process.env.NODE_ENV !== 'production') {
        console.debug(`[${namespace}] ${message}`, ...args);
      }
    },
    info(message: string, ...args: any[]) {
      console.info(`[${namespace}] ${message}`, ...args);
    },
    warn(message: string, ...args: any[]) {
      console.warn(`[${namespace}] ${message}`, ...args);
    },
    error(message: string, ...args: any[]) {
      console.error(`[${namespace}] ${message}`, ...args);
    }
  };
};

// Create a default logger instance
const defaultLogger = createLogger('app');

// Maximum number of logs to keep in memory for debugging
const MAX_MEMORY_LOGS = 1000;

// In-memory log storage for debugging
const memoryLogs: LogEntry[] = [];

// Interface for log entries
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  levelName: string;
  message: string;
  data?: any;
}

/**
 * Add log entry to memory storage
 */
function addToMemoryLogs(entry: LogEntry): void {
  memoryLogs.push(entry);
  if (memoryLogs.length > MAX_MEMORY_LOGS) {
    memoryLogs.shift();
  }
}

/**
 * Create a log entry
 */
function createLogEntry(level: LogLevel, message: string, data?: any): LogEntry {
  const levelNames = {
    [LogLevel.ERROR]: 'ERROR',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.DEBUG]: 'DEBUG',
  };

  return {
    timestamp: new Date().toISOString(),
    level,
    levelName: levelNames[level],
    message,
    data,
  };
}

/**
 * Logger interface with backward compatibility
 */
const logger = {
  /**
   * Log an error message
   */
  error(message: string, data?: any): void {
    const entry = createLogEntry(LogLevel.ERROR, message, data);
    addToMemoryLogs(entry);
    defaultLogger.error(message, data);
  },

  /**
   * Log a warning message
   */
  warn(message: string, data?: any): void {
    const entry = createLogEntry(LogLevel.WARN, message, data);
    addToMemoryLogs(entry);
    defaultLogger.warn(message, data);
  },

  /**
   * Log an info message
   */
  info(message: string, data?: any): void {
    const entry = createLogEntry(LogLevel.INFO, message, data);
    addToMemoryLogs(entry);
    defaultLogger.info(message, data);
  },

  /**
   * Log a debug message
   */
  debug(message: string, data?: any): void {
    const entry = createLogEntry(LogLevel.DEBUG, message, data);
    addToMemoryLogs(entry);
    defaultLogger.debug(message, data);
  },

  /**
   * Get all logs from memory
   */
  getLogs(): LogEntry[] {
    return [...memoryLogs];
  },

  /**
   * Clear memory logs
   */
  clearLogs(): void {
    memoryLogs.length = 0;
  },

  /**
   * Get current log level
   */
  getLogLevel(): LogLevel {
    return LogLevel.INFO; // Default to INFO for backward compatibility
  },

  /**
   * Get log level name
   */
  getLogLevelName(): string {
    return 'INFO'; // Default to INFO for backward compatibility
  },
};

// Export a function to create namespaced loggers
export const createNamespacedLogger = (namespace: string) => {
  return createLogger(namespace);
};

export default logger;
export { logger };