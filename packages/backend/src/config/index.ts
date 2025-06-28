/**
 * Centralized configuration module for the application
 *
 * This module loads environment variables from .env file and provides
 * a structured configuration object for the application.
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { validateEnv } from '../utils/envValidation';

// Load environment variables from .env file
dotenv.config();

// Validate environment variables early
const validatedEnv = validateEnv();

// Define the root directory of the application
const ROOT_DIR = path.resolve(__dirname, '../..');

// Environment detection
const env = validatedEnv.NODE_ENV;
const isDevelopment = env === 'development';
const isProduction = env === 'production';
const isTest = env === 'test';

// Configuration object
const config = {
  env,
  isDevelopment,
  isProduction, 
  isTest,

  server: {
    port: parseInt(process.env.PORT || '5001', 10),
    host: process.env.HOST || '0.0.0.0',
    corsOrigins: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://frontend:3000'],
    publicUrl: process.env.PUBLIC_URL || 'http://localhost:5001',
  },

  baseUrl: process.env.BASE_URL || 'http://localhost:5001',

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'spheroseg',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.DB_SSL === 'true',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
    accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || '15m',
    refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d',
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '3600', 10),
    allowMockUser: process.env.ALLOW_MOCK_USER === 'true' || isDevelopment,
    tokenSecurityMode: process.env.TOKEN_SECURITY_MODE || 'standard',
  },

  storage: {
    uploadDir: process.env.UPLOAD_DIR || path.join(ROOT_DIR, 'uploads'),
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '50000000', 10),
    allowedFileTypes: (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/tiff,image/tif,image/bmp').split(','),
    // Storage limits and monitoring
    defaultUserStorageLimit: parseInt(process.env.DEFAULT_USER_STORAGE_LIMIT || '10737418240', 10), // 10 GB
    defaultUserLimitBytes: BigInt(process.env.DEFAULT_USER_STORAGE_LIMIT || '10737418240'), // 10 GB as BigInt
    maxTotalStorageBytes: parseInt(process.env.MAX_TOTAL_STORAGE_BYTES || '107374182400', 10), // 100 GB
    storageWarningThreshold: parseFloat(process.env.STORAGE_WARNING_THRESHOLD || '0.8'), // 80%
    // File cleanup configuration
    tempFileMaxAgeHours: parseInt(process.env.TEMP_FILE_MAX_AGE_HOURS || '24', 10),
    cleanupScheduleHours: parseInt(process.env.CLEANUP_SCHEDULE_HOURS || '6', 10), // Run every 6 hours
    enableOrphanedFileCleanup: process.env.ENABLE_ORPHANED_FILE_CLEANUP !== 'false',
    // Thumbnail configuration
    thumbnailQuality: parseInt(process.env.THUMBNAIL_QUALITY || '80', 10),
    thumbnailMaxWidth: parseInt(process.env.THUMBNAIL_MAX_WIDTH || '300', 10),
    thumbnailMaxHeight: parseInt(process.env.THUMBNAIL_MAX_HEIGHT || '300', 10),
  },

  ml: {
    serviceUrl: process.env.ML_SERVICE_URL || 'http://localhost:5002',
    maxRetries: parseInt(process.env.ML_MAX_RETRIES || '3', 10),
    retryDelay: parseInt(process.env.ML_RETRY_DELAY || '5000', 10),
    maxConcurrentTasks: parseInt(process.env.ML_MAX_CONCURRENT_TASKS || '2', 10),
  },

  segmentation: {
    maxConcurrentTasks: parseInt(process.env.SEGMENTATION_MAX_CONCURRENT_TASKS || '2', 10),
    checkpointPath: process.env.SEGMENTATION_CHECKPOINT_PATH || '/app/models/resunet',
    maxRetries: parseInt(process.env.SEGMENTATION_MAX_RETRIES || '3', 10),
    retryDelay: parseInt(process.env.SEGMENTATION_RETRY_DELAY || '5000', 10),
  },

  logging: {
    level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
    logToFile: process.env.LOG_TO_FILE === 'true',
    logDir: process.env.LOG_DIR || path.join(ROOT_DIR, 'logs'),
  },

  monitoring: {
    metricsEnabled: process.env.METRICS_ENABLED !== 'false',
    requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || '30000', 10),
  },

  security: {
    rateLimitRequests: parseInt(process.env.RATE_LIMIT_REQUESTS || '100', 10),
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60', 10), // seconds
    enableHelmet: process.env.ENABLE_HELMET !== 'false',
    enableRateLimit: process.env.ENABLE_RATE_LIMIT !== 'false',
    csrfEnabled: process.env.CSRF_ENABLED !== 'false',
  },
};

// Create necessary directories
if (!fs.existsSync(config.storage.uploadDir)) {
  fs.mkdirSync(config.storage.uploadDir, { recursive: true });
}

if (config.logging.logToFile && !fs.existsSync(config.logging.logDir)) {
  fs.mkdirSync(config.logging.logDir, { recursive: true });
}

export default config;
