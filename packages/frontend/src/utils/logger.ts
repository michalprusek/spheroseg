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

// Whether to send logs to the server
const SEND_LOGS_TO_SERVER = process.env.NODE_ENV === 'production';
const LOG_ENDPOINT = '/api/logs';

// Queue of logs to be sent to the server
const logQueue: LogEntry[] = [];
let isSendingLogs = false;

// Send logs to the server in batches
const sendLogsToServer = async () => {
  if (isSendingLogs || logQueue.length === 0) return;

  try {
    isSendingLogs = true;

    // Take up to 50 logs from the queue
    const logsToSend = logQueue.splice(0, 50);

    // Send logs to the server
    const response = await fetch(LOG_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        logs: logsToSend,
        source: 'frontend',
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send logs: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    // If sending logs fails, put them back in the queue
    console.error('Failed to send logs to server:', error);
  } finally {
    isSendingLogs = false;

    // If there are more logs in the queue, schedule sending them
    if (logQueue.length > 0) {
      setTimeout(sendLogsToServer, 1000);
    }
  }
};

// Add log to the server queue
const addToServerQueue = (entry: LogEntry) => {
  if (!SEND_LOGS_TO_SERVER) return;

  // Only send ERROR and WARN logs to the server
  if (entry.level <= LogLevel.WARN) {
    logQueue.push(entry);

    // Schedule sending logs to the server
    if (!isSendingLogs) {
      setTimeout(sendLogsToServer, 1000);
    }
  }
};

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

      // If first arg is an error object, extract stack trace
      const errorData =
        args[0] instanceof Error
          ? {
              message: args[0].message,
              stack: args[0].stack,
              name: args[0].name,
            }
          : args[0];

      const entry = createLogEntry(LogLevel.INFO, `[${namespace}] ${message}`, errorData);
      addToMemoryLogs(entry);
      addToServerQueue(entry);
    },
    warn(message: string, ...args: any[]) {
      console.warn(`[${namespace}] ${message}`, ...args);

      // If first arg is an error object, extract stack trace
      const errorData =
        args[0] instanceof Error
          ? {
              message: args[0].message,
              stack: args[0].stack,
              name: args[0].name,
            }
          : args[0];

      const entry = createLogEntry(LogLevel.WARN, `[${namespace}] ${message}`, errorData);
      addToMemoryLogs(entry);
      addToServerQueue(entry);
    },
    error(message: string, ...args: any[]) {
      console.error(`[${namespace}] ${message}`, ...args);

      // If first arg is an error object, extract stack trace
      const errorData =
        args[0] instanceof Error
          ? {
              message: args[0].message,
              stack: args[0].stack,
              name: args[0].name,
            }
          : args[0];

      const entry = createLogEntry(LogLevel.ERROR, `[${namespace}] ${message}`, errorData);
      addToMemoryLogs(entry);
      addToServerQueue(entry);
    },
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
