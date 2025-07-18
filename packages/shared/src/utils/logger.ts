/**
 * Shared Logger Utility
 * 
 * Simple logger for shared package that works in both browser and Node.js environments
 */

export interface LogLevel {
  DEBUG: 0;
  INFO: 1;
  WARN: 2;
  ERROR: 3;
}

export const LOG_LEVELS: LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
} as const;

export type LogLevelValue = LogLevel[keyof LogLevel];

class SharedLogger {
  private level: LogLevelValue = LOG_LEVELS.INFO;
  private context: string = 'shared';

  constructor(context?: string) {
    if (context) {
      this.context = context;
    }
    
    // Set log level from environment
    const envLevel = (typeof process !== 'undefined' && process.env?.['LOG_LEVEL']) || 'info';
    this.setLevel(envLevel);
  }

  setLevel(level: string): void {
    switch (level.toLowerCase()) {
      case 'debug':
        this.level = LOG_LEVELS.DEBUG;
        break;
      case 'info':
        this.level = LOG_LEVELS.INFO;
        break;
      case 'warn':
        this.level = LOG_LEVELS.WARN;
        break;
      case 'error':
        this.level = LOG_LEVELS.ERROR;
        break;
      default:
        this.level = LOG_LEVELS.INFO;
    }
  }

  private formatMessage(level: string, message: string, ...args: unknown[]): void {
    if (typeof console === 'undefined') return;
    
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${this.context}]`;
    const fullMessage = `${prefix} ${message}`;
    
    if (args.length > 0) {
      // eslint-disable-next-line no-console
      console.log(fullMessage, ...args);
    } else {
      // eslint-disable-next-line no-console
      console.log(fullMessage);
    }
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.level <= LOG_LEVELS.DEBUG) {
      this.formatMessage('debug', message, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.level <= LOG_LEVELS.INFO) {
      this.formatMessage('info', message, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.level <= LOG_LEVELS.WARN) {
      this.formatMessage('warn', message, ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.level <= LOG_LEVELS.ERROR) {
      this.formatMessage('error', message, ...args);
    }
  }
}

// Create default logger instance
const logger = new SharedLogger();

export { SharedLogger };
export default logger;