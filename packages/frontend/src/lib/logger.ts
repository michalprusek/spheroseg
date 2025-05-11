/**
 * Logger utility for consistent logging across the application
 * Provides different log levels and prefixes messages with timestamps and module names
 */

// Log levels
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

// Current log level - can be set via environment variable or localStorage
let currentLogLevel = LogLevel.INFO;

// Try to get log level from localStorage
try {
  const storedLevel = localStorage.getItem('logLevel');
  if (storedLevel) {
    currentLogLevel = parseInt(storedLevel, 10);
  }
} catch (e) {
  // Ignore localStorage errors
}

// Format a log message with timestamp and module name
const formatMessage = (module: string, message: string): string => {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${module}] ${message}`;
};

// Create a logger for a specific module
export const createLogger = (moduleName: string) => {
  return {
    // Set the log level
    setLogLevel: (level: LogLevel) => {
      currentLogLevel = level;
      try {
        localStorage.setItem('logLevel', level.toString());
      } catch (e) {
        // Ignore localStorage errors
      }
    },

    // Get the current log level
    getLogLevel: (): LogLevel => currentLogLevel,

    // Log a debug message
    debug: (message: string, ...args: any[]) => {
      if (currentLogLevel <= LogLevel.DEBUG) {
        console.debug(formatMessage(moduleName, message), ...args);
      }
    },

    // Log an info message
    info: (message: string, ...args: any[]) => {
      if (currentLogLevel <= LogLevel.INFO) {
        console.info(formatMessage(moduleName, message), ...args);
      }
    },

    // Log a warning message
    warn: (message: string, ...args: any[]) => {
      if (currentLogLevel <= LogLevel.WARN) {
        console.warn(formatMessage(moduleName, message), ...args);
      }
    },

    // Log an error message
    error: (message: string, ...args: any[]) => {
      if (currentLogLevel <= LogLevel.ERROR) {
        console.error(formatMessage(moduleName, message), ...args);
      }
    },

    // Log a message with a specific level
    log: (level: LogLevel, message: string, ...args: any[]) => {
      if (level >= currentLogLevel) {
        switch (level) {
          case LogLevel.DEBUG:
            console.debug(formatMessage(moduleName, message), ...args);
            break;
          case LogLevel.INFO:
            console.info(formatMessage(moduleName, message), ...args);
            break;
          case LogLevel.WARN:
            console.warn(formatMessage(moduleName, message), ...args);
            break;
          case LogLevel.ERROR:
            console.error(formatMessage(moduleName, message), ...args);
            break;
        }
      }
    },

    // Create a child logger with a sub-module name
    child: (subModule: string) => {
      return createLogger(`${moduleName}:${subModule}`);
    },
  };
};

// Create a root logger
export const logger = createLogger('app');

// Export a function to set the global log level
export const setGlobalLogLevel = (level: LogLevel) => {
  logger.setLogLevel(level);
};

// Export default logger
export default logger;
