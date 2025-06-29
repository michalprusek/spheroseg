/**
 * Unified Logging System for Frontend
 * 
 * Provides consistent logging with namespacing, levels, and server shipping.
 * This consolidates all logging patterns into a single, configurable system.
 */

import { safeAsync } from '@/utils/error';

// ===========================
// Types and Interfaces
// ===========================

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  namespace: string;
  message: string;
  data?: any;
  error?: Error;
  context?: Record<string, any>;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableMemoryStorage: boolean;
  enableServerShipping: boolean;
  maxMemoryLogs: number;
  serverEndpoint: string;
  shipInterval: number;
  namespace?: string;
}

// ===========================
// Default Configuration
// ===========================

const DEFAULT_CONFIG: LoggerConfig = {
  level: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
  enableConsole: true,
  enableMemoryStorage: true,
  enableServerShipping: process.env.NODE_ENV === 'production',
  maxMemoryLogs: 1000,
  serverEndpoint: '/api/logs',
  shipInterval: 30000, // 30 seconds
  namespace: 'app',
};

// ===========================
// Logger Implementation
// ===========================

class UnifiedLogger {
  private config: LoggerConfig;
  private memoryLogs: LogEntry[] = [];
  private shipTimer?: NodeJS.Timeout;
  private namespace: string;

  constructor(namespace?: string, config?: Partial<LoggerConfig>) {
    this.namespace = namespace || DEFAULT_CONFIG.namespace!;
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      namespace: this.namespace,
    };

    if (this.config.enableServerShipping) {
      this.startShipping();
    }
  }

  // Core logging methods

  debug(message: string, data?: any, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, data, context);
  }

  info(message: string, data?: any, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, data, context);
  }

  warn(message: string, data?: any, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, data, context);
  }

  error(message: string, error?: Error | any, context?: Record<string, any>): void {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    this.log(LogLevel.ERROR, message, { error: errorObj.message, stack: errorObj.stack }, context);
  }

  // Main logging function

  private log(level: LogLevel, message: string, data?: any, context?: Record<string, any>): void {
    // Check if logging is enabled for this level
    if (level < this.config.level) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      namespace: this.namespace,
      message,
      data,
      context: {
        ...context,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
      },
    };

    // Console output
    if (this.config.enableConsole && typeof console !== 'undefined') {
      const prefix = `[${entry.timestamp}] [${this.namespace}]`;
      const logData = data ? [prefix, message, data] : [prefix, message];

      switch (level) {
        case LogLevel.DEBUG:
          console.debug(...logData);
          break;
        case LogLevel.INFO:
          console.info(...logData);
          break;
        case LogLevel.WARN:
          console.warn(...logData);
          break;
        case LogLevel.ERROR:
          console.error(...logData);
          break;
      }
    }

    // Memory storage
    if (this.config.enableMemoryStorage) {
      this.memoryLogs.push(entry);
      
      // Trim logs if exceeding max
      if (this.memoryLogs.length > this.config.maxMemoryLogs) {
        this.memoryLogs = this.memoryLogs.slice(-this.config.maxMemoryLogs);
      }
    }
  }

  // Server shipping

  private startShipping(): void {
    this.shipTimer = setInterval(() => {
      this.shipLogs();
    }, this.config.shipInterval);

    // Ship logs on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.shipLogs(true);
      });
    }
  }

  private async shipLogs(immediate = false): Promise<void> {
    if (this.memoryLogs.length === 0) {
      return;
    }

    const logsToShip = [...this.memoryLogs];
    this.memoryLogs = [];

    // Use safeAsync to handle errors gracefully
    await safeAsync(async () => {
      const response = await fetch(this.config.serverEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logs: logsToShip }),
        // Use keepalive for immediate shipping on page unload
        keepalive: immediate,
      });

      if (!response.ok) {
        throw new Error(`Failed to ship logs: ${response.statusText}`);
      }
    }, {
      showToast: false,
      logError: false, // Avoid recursive logging
    });
  }

  // Utility methods

  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  getLevel(): LogLevel {
    return this.config.level;
  }

  getLogs(): LogEntry[] {
    return [...this.memoryLogs];
  }

  clearLogs(): void {
    this.memoryLogs = [];
  }

  destroy(): void {
    if (this.shipTimer) {
      clearInterval(this.shipTimer);
      this.shipTimer = undefined;
    }
    this.shipLogs(true);
  }

  // Create child logger with namespace
  child(namespace: string): UnifiedLogger {
    return new UnifiedLogger(`${this.namespace}:${namespace}`, this.config);
  }
}

// ===========================
// Global Logger Instance
// ===========================

const globalLogger = new UnifiedLogger();

// ===========================
// Factory Functions
// ===========================

/**
 * Create a namespaced logger
 */
export function createLogger(namespace: string, config?: Partial<LoggerConfig>): UnifiedLogger {
  return new UnifiedLogger(namespace, config);
}

/**
 * Create a namespaced logger (backward compatibility)
 */
export function createNamespacedLogger(namespace: string): UnifiedLogger {
  return createLogger(namespace);
}

/**
 * Get or create a logger for a module
 */
const loggerCache = new Map<string, UnifiedLogger>();

export function getLogger(namespace: string): UnifiedLogger {
  if (!loggerCache.has(namespace)) {
    loggerCache.set(namespace, createLogger(namespace));
  }
  return loggerCache.get(namespace)!;
}

// ===========================
// Configuration Functions
// ===========================

/**
 * Set global log level
 */
export function setGlobalLogLevel(level: LogLevel): void {
  globalLogger.setLevel(level);
  // Update all cached loggers
  loggerCache.forEach(logger => logger.setLevel(level));
}

/**
 * Enable/disable console output globally
 */
export function setConsoleEnabled(enabled: boolean): void {
  DEFAULT_CONFIG.enableConsole = enabled;
}

/**
 * Enable/disable server shipping globally
 */
export function setServerShippingEnabled(enabled: boolean): void {
  DEFAULT_CONFIG.enableServerShipping = enabled;
}

// ===========================
// Console Override (Optional)
// ===========================

/**
 * Override console methods to use unified logger
 * This ensures all console usage goes through our logging system
 */
export function overrideConsole(): void {
  if (typeof console === 'undefined') return;

  const originalConsole = {
    log: console.log,
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };

  console.log = (...args: any[]) => {
    globalLogger.info(args.map(arg => String(arg)).join(' '));
  };

  console.debug = (...args: any[]) => {
    globalLogger.debug(args.map(arg => String(arg)).join(' '));
  };

  console.info = (...args: any[]) => {
    globalLogger.info(args.map(arg => String(arg)).join(' '));
  };

  console.warn = (...args: any[]) => {
    globalLogger.warn(args.map(arg => String(arg)).join(' '));
  };

  console.error = (...args: any[]) => {
    globalLogger.error(args.map(arg => String(arg)).join(' '));
  };

  // Store reference to restore later if needed
  (window as any).__originalConsole = originalConsole;
}

/**
 * Restore original console methods
 */
export function restoreConsole(): void {
  if (typeof window !== 'undefined' && (window as any).__originalConsole) {
    const original = (window as any).__originalConsole;
    console.log = original.log;
    console.debug = original.debug;
    console.info = original.info;
    console.warn = original.warn;
    console.error = original.error;
  }
}

// ===========================
// Default Export
// ===========================

export default globalLogger;

// Named exports for convenience
export const logger = globalLogger;
export { LogLevel as LEVELS };