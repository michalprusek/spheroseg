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
import * as fs from 'fs';
import * as path from 'path';
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
    (info) => `${info.timestamp} ${info.level}: ${info.message} ${info.metadata ? JSON.stringify(info.metadata) : ''}`,
  ),
);

// Define the format for file output (JSON)
const fileFormat = winston.format.combine(winston.format.timestamp(), winston.format.json());

// Enhanced error formatting for better debugging
const enhancedErrorFormat = winston.format((info: winston.Logform.TransformableInfo) => {
  // Check if the metadata contains an error
  if (info.metadata && typeof info.metadata === 'object' && 'error' in info.metadata && info.metadata.error instanceof Error) {
    const error = info.metadata.error;

    // Extract useful properties from the error
    info.metadata.error = {
      message: error.message,
      name: error.name,
      stack: error.stack
      // Don't spread the Error object as it doesn't have an index signature
    };
  }

  // Also check for errors directly in the info object
  if ('error' in info && info.error instanceof Error) {
    const error = info.error;

    // Extract useful properties from the error
    info.error = {
      message: error.message,
      name: error.name,
      stack: error.stack
      // Don't spread the Error object as it doesn't have an index signature
    };
  }

  return info;
})();

// Database logging function
const logToDatabase = (info: winston.Logform.TransformableInfo) => {
  // Import this directly to avoid circular dependencies
  import('../db')
    .then(({ default: pool }) => {
      // Only log errors and warnings to database
      if (info.level === 'error' || info.level === 'warn') {
        const level = info.level === 'error' ? 0 : 1;
        const levelName = info.level.toUpperCase();
        const message = info.message;
        const data = info.metadata ? JSON.stringify(info.metadata) : null;
        const timestamp = new Date(info.timestamp as string | number | Date).toISOString();

        // Create logs table if it doesn't exist
        pool
          .query(
            `
        CREATE TABLE IF NOT EXISTS logs (
          id SERIAL PRIMARY KEY,
          source VARCHAR(50) NOT NULL,
          level INT NOT NULL,
          level_name VARCHAR(10) NOT NULL,
          message TEXT NOT NULL,
          data JSONB,
          timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
          user_agent VARCHAR(500),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `,
          )
          .then(() => {
            // Insert into logs table
            pool
              .query(
                `INSERT INTO logs (source, level, level_name, message, data, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6)`,
                ['backend', level, levelName, message, data, timestamp],
              )
              .catch((err) => {
                // Use default winston logger for internal errors
                winston.loggers.get('default')?.error('Error writing to log database:', { error: err });
              });
          })
          .catch((err) => {
            // Use default winston logger for internal errors
            winston.loggers.get('default')?.error('Error creating logs table:', { error: err });
          });
      }
    })
    .catch((err) => {
      // Use default winston logger for internal errors
      winston.loggers.get('default')?.error('Error importing database pool:', { error: err });
    });
};

export function createLogger(moduleName: string) {
  // Create logs directory if it doesn't exist
  try {
    const logDir = path.join(__dirname, '../../logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  } catch (error) {
    // Use default winston logger for internal errors
    winston.loggers.get('default')?.error('Error creating logs directory:', { error });
  }

  const loggerInstance = winston.createLogger({
    level: config.env === 'development' ? 'debug' : 'info',
    levels,
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
      winston.format.metadata({
        fillExcept: ['message', 'level', 'timestamp', 'label'],
      }),
      enhancedErrorFormat,
    ),
    transports: [
      // Console transport
      new winston.transports.Console({
        format: consoleFormat,
      }),
      // File transports for error and combined logs
      new winston.transports.File({
        filename: path.join(__dirname, '../../logs/error.log'),
        level: 'error',
        format: fileFormat,
        maxsize: 10485760, // 10MB
        maxFiles: 5,
        tailable: true,
      }),
      new winston.transports.File({
        filename: path.join(__dirname, '../../logs/combined.log'),
        format: fileFormat,
        maxsize: 10485760, // 10MB
        maxFiles: 5,
        tailable: true,
      }),
    ],
    defaultMeta: { service: 'backend-service', module: moduleName }, // Add module name to default meta
    exitOnError: false, // Do not exit on handled exceptions
  });

  // Add custom logging to database for errors and warnings
  loggerInstance.on('error', (info: winston.Logform.TransformableInfo) => {
    logToDatabase(info);
  });

  loggerInstance.on('warn', (info: winston.Logform.TransformableInfo) => {
    logToDatabase(info);
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
