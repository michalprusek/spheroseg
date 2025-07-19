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
import { 
  loadSecrets, 
  constructDatabaseUrl, 
  constructRedisUrl, 
  constructRabbitmqUrl 
} from '../utils/secretsLoader';

// Load environment variables from .env file
dotenv.config();

// Validate environment variables early
const validatedEnv = validateEnv();

// Load secrets from Docker Secrets or environment variables
const secrets = loadSecrets();

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
    port:
      typeof validatedEnv.PORT === 'number'
        ? validatedEnv.PORT
        : parseInt(validatedEnv.PORT || '5001', 10),
    host: validatedEnv.HOST || '0.0.0.0',
    corsOrigins: validatedEnv.ALLOWED_ORIGINS
      ? validatedEnv.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://frontend:3000'],
    publicUrl: validatedEnv.APP_URL || 'https://spherosegapp.utia.cas.cz',
  },

  baseUrl: validatedEnv.APP_URL || 'https://spherosegapp.utia.cas.cz',
  appUrl: validatedEnv.APP_URL || 'https://spherosegapp.utia.cas.cz',

  db: {
    host: validatedEnv.DB_HOST || 'localhost',
    port:
      typeof validatedEnv.DB_PORT === 'number'
        ? validatedEnv.DB_PORT
        : parseInt(validatedEnv.DB_PORT || '5432', 10),
    database: validatedEnv.DB_NAME || 'spheroseg',
    user: validatedEnv.DB_USER || 'postgres',
    password: secrets.dbPassword || validatedEnv.DB_PASSWORD || 'postgres',
    ssl: validatedEnv.DB_SSL === 'true' || isProduction,
    maxConnections: parseInt(validatedEnv.DB_MAX_CONNECTIONS || '10', 10),
    // Construct full database URL with secrets
    connectionString: process.env['DATABASE_URL'] || constructDatabaseUrl(secrets, {
      user: validatedEnv.DB_USER || 'postgres',
      host: validatedEnv.DB_HOST || 'localhost',
      port: typeof validatedEnv.DB_PORT === 'number' 
        ? validatedEnv.DB_PORT 
        : parseInt(validatedEnv.DB_PORT || '5432', 10),
      database: validatedEnv.DB_NAME || 'spheroseg',
      ssl: validatedEnv.DB_SSL === 'true' || isProduction
    }),
  },

  auth: {
    jwtSecret: secrets.jwtSecret || validatedEnv.JWT_SECRET || '',
    sessionSecret: secrets.sessionSecret || validatedEnv.SESSION_SECRET || secrets.jwtSecret || '',
    jwtExpiresIn: validatedEnv.JWT_EXPIRES_IN || '1d',
    accessTokenExpiry: validatedEnv.ACCESS_TOKEN_EXPIRY || '15m',
    refreshTokenExpiry: validatedEnv.REFRESH_TOKEN_EXPIRY || '7d',
    saltRounds: parseInt(validatedEnv.BCRYPT_SALT_ROUNDS || '10', 10),
    sessionTimeout: parseInt(validatedEnv.SESSION_TIMEOUT || '3600', 10),
    allowMockUser: validatedEnv.USE_MOCK_USER === 'true' || isDevelopment,
    tokenSecurityMode: validatedEnv.TOKEN_SECURITY_MODE || 'standard',
    jwksUri: validatedEnv.JWKS_URI,
    useKeyRotation: validatedEnv.USE_JWT_KEY_ROTATION === 'true',
    secureCookies: validatedEnv.SECURE_COOKIES === 'true' || isProduction,
    trustProxy: validatedEnv.TRUST_PROXY === 'true' || isProduction,
  },

  storage: {
    uploadDir: validatedEnv.UPLOAD_DIR || path.join(ROOT_DIR, 'uploads'),
    maxFileSize: parseInt(validatedEnv.MAX_UPLOAD_SIZE || '50000000', 10),
    allowedFileTypes: (
      validatedEnv.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/tiff,image/tif,image/bmp'
    ).split(','),
    // Storage limits and monitoring
    defaultUserStorageLimit:
      typeof validatedEnv.DEFAULT_USER_STORAGE_LIMIT === 'number'
        ? validatedEnv.DEFAULT_USER_STORAGE_LIMIT
        : parseInt(validatedEnv.DEFAULT_USER_STORAGE_LIMIT || '10737418240', 10), // 10 GB
    defaultUserLimitBytes: BigInt(validatedEnv.DEFAULT_USER_STORAGE_LIMIT || '10737418240'), // 10 GB as BigInt
    maxTotalStorageBytes: parseInt(validatedEnv.MAX_TOTAL_STORAGE_BYTES || '107374182400', 10), // 100 GB
    storageWarningThreshold: parseFloat(validatedEnv.STORAGE_WARNING_THRESHOLD || '0.8'), // 80%
    // File cleanup configuration
    tempFileMaxAgeHours: parseInt(validatedEnv.TEMP_FILE_MAX_AGE_HOURS || '24', 10),
    cleanupScheduleHours: parseInt(validatedEnv.CLEANUP_SCHEDULE_HOURS || '6', 10), // Run every 6 hours
    enableOrphanedFileCleanup: validatedEnv.ENABLE_ORPHANED_FILE_CLEANUP !== 'false',
    // Thumbnail configuration
    thumbnailQuality: parseInt(validatedEnv.THUMBNAIL_QUALITY || '80', 10),
    thumbnailMaxWidth: parseInt(validatedEnv.THUMBNAIL_MAX_WIDTH || '300', 10),
    thumbnailMaxHeight: parseInt(validatedEnv.THUMBNAIL_MAX_HEIGHT || '300', 10),
  },

  ml: {
    serviceUrl: validatedEnv.ML_SERVICE_URL || 'http://ml:5002',
    maxRetries: parseInt(validatedEnv.ML_MAX_RETRIES || '3', 10),
    retryDelay: parseInt(validatedEnv.ML_RETRY_DELAY || '5000', 10),
    maxConcurrentTasks: parseInt(validatedEnv.ML_MAX_CONCURRENT_TASKS || '2', 10),
    healthCheckInterval: parseInt(validatedEnv.ML_HEALTH_CHECK_INTERVAL || '60000', 10),
    queueUpdateInterval: parseInt(validatedEnv.ML_QUEUE_UPDATE_INTERVAL || '5000', 10),
  },

  segmentation: {
    maxConcurrentTasks: parseInt(validatedEnv.SEGMENTATION_MAX_CONCURRENT_TASKS || '2', 10),
    checkpointPath: validatedEnv.SEGMENTATION_CHECKPOINT_PATH || '/app/models/resunet',
    maxRetries: parseInt(validatedEnv.SEGMENTATION_MAX_RETRIES || '3', 10),
    retryDelay: parseInt(validatedEnv.SEGMENTATION_RETRY_DELAY || '5000', 10),
  },

  logging: {
    level: validatedEnv.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
    logToFile: validatedEnv.LOG_TO_FILE === 'true',
    logDir: validatedEnv.LOG_DIR || path.join(ROOT_DIR, 'logs'),
  },

  monitoring: {
    metricsEnabled: validatedEnv.METRICS_ENABLED !== 'false',
    requestTimeoutMs: parseInt(validatedEnv.REQUEST_TIMEOUT_MS || '30000', 10), // 30 seconds
    metricsPrefix: validatedEnv.METRICS_PREFIX || 'spheroseg_',
  },

  security: {
    rateLimitRequests:
      typeof validatedEnv.RATE_LIMIT_REQUESTS === 'number'
        ? validatedEnv.RATE_LIMIT_REQUESTS
        : parseInt(validatedEnv.RATE_LIMIT_REQUESTS || '100', 10),
    rateLimitWindow:
      typeof validatedEnv.RATE_LIMIT_WINDOW === 'number'
        ? validatedEnv.RATE_LIMIT_WINDOW
        : parseInt(validatedEnv.RATE_LIMIT_WINDOW || '60', 10), // seconds
    enableHelmet: validatedEnv.ENABLE_HELMET !== 'false',
    enableRateLimit: validatedEnv.ENABLE_RATE_LIMIT !== 'false',
    csrfEnabled: validatedEnv.CSRF_ENABLED !== 'false',
    useRedis: validatedEnv.USE_REDIS_RATE_LIMIT === 'true',
    ipWhitelist: validatedEnv.IP_WHITELIST ? validatedEnv.IP_WHITELIST.split(',') : [],
  },

  redis: {
    url: process.env['REDIS_URL'] || constructRedisUrl(secrets, {
      host: validatedEnv.REDIS_HOST || 'localhost',
      port: parseInt(validatedEnv.REDIS_PORT || '6379', 10),
      db: parseInt(validatedEnv.REDIS_DB || '0', 10),
    }),
    host: validatedEnv.REDIS_HOST || 'localhost',
    port: parseInt(validatedEnv.REDIS_PORT || '6379', 10),
    password: secrets.redisPassword || validatedEnv.REDIS_PASSWORD,
    db: parseInt(validatedEnv.REDIS_DB || '0', 10),
  },

  email: {
    from: validatedEnv.EMAIL_FROM || 'spheroseg@utia.cas.cz',
    host: validatedEnv.EMAIL_HOST,
    port: parseInt(validatedEnv.EMAIL_PORT || '587', 10),
    secure: validatedEnv.EMAIL_SECURE === 'true',
    user: validatedEnv.EMAIL_USER,
    pass: secrets.emailPassword || validatedEnv.EMAIL_PASS,
  },

  rabbitmq: {
    url: process.env['RABBITMQ_URL'] || constructRabbitmqUrl(secrets, {
      user: validatedEnv.RABBITMQ_USER || 'guest',
      host: validatedEnv.RABBITMQ_HOST || 'rabbitmq',
      port: parseInt(validatedEnv.RABBITMQ_PORT || '5672', 10),
    }),
    queue: validatedEnv.RABBITMQ_QUEUE || 'segmentation_tasks',
  },
};

// Create necessary directories (skip in test environment)
if (!config.isTest) {
  if (!fs.existsSync(config.storage.uploadDir)) {
    fs.mkdirSync(config.storage.uploadDir, { recursive: true });
  }

  if (config.logging.logToFile && !fs.existsSync(config.logging.logDir)) {
    fs.mkdirSync(config.logging.logDir, { recursive: true });
  }
}

export default config;
