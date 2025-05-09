/**
 * Centralized logging utility for the application
 *
 * This module provides a consistent logging interface using Winston.
 * It configures different log levels and formats based on the environment.
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

import winston from 'winston';
import path from 'path';
import config from '../config';

// Define log levels and colors
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Add colors to Winston
winston.addColors(colors);

// Define the format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message} ${info.metadata ? JSON.stringify(info.metadata) : ''}`
  )
);

// Define the format for file output (JSON)
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

export function createLogger(moduleName: string) {
  const loggerInstance = winston.createLogger({
    level: config.env === 'development' ? 'debug' : 'info',
    levels,
    format: winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'label'] }), // Ensure metadata is captured
    transports: [
      // Console transport
      new winston.transports.Console({
        format: consoleFormat,
      }),
      // File transports for error and combined logs
      new winston.transports.File({
        filename: path.join(__dirname, '../../logs/error.log'), // Adjusted path for utils directory
        level: 'error',
        format: fileFormat,
      }),
      new winston.transports.File({
        filename: path.join(__dirname, '../../logs/combined.log'), // Adjusted path for utils directory
        format: fileFormat,
      }),
    ],
    defaultMeta: { service: 'backend-service', module: moduleName }, // Add module name to default meta
    exitOnError: false, // Do not exit on handled exceptions
  });
  return loggerInstance;
}

// Default logger instance for general use or if no module name is specified
const logger = createLogger('general');

// Stream for morgan middleware (optional)
export const stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

export default logger; // Export the default 'general' logger instance