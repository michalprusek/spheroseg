/**
 * Environment Variables Validation
 *
 * Validates environment variables using Zod schema for better type safety
 * and early error detection in misconfigured environments.
 */

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().min(1000).max(65535).default(5001),
  HOST: z.string().default('0.0.0.0'),

  // Database
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().min(1).max(65535).default(5432),
  DB_NAME: z.string().default('spheroseg'),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().optional(), // Now optional, will be loaded from secrets
  DB_PASSWORD_FILE: z.string().optional(),

  // Authentication
  JWT_SECRET: z.string().min(32).optional(), // Now optional, will be loaded from secrets
  JWT_SECRET_FILE: z.string().optional(), // Path to JWT secret file
  SESSION_SECRET: z.string().min(32).optional(),
  SESSION_SECRET_FILE: z.string().optional(),
  TOKEN_SECURITY_MODE: z.enum(['standard', 'strict']).default('standard'),

  // Security
  RATE_LIMIT_REQUESTS: z.coerce.number().min(1).max(10000).default(100),
  RATE_LIMIT_WINDOW: z.coerce.number().min(1).max(3600).default(60),
  ENABLE_HELMET: z.enum(['true', 'false']).default('true'),
  ENABLE_RATE_LIMIT: z.enum(['true', 'false']).default('true'),

  // Storage
  MAX_FILE_SIZE: z.coerce.number().min(1024).max(100000000).default(50000000), // 50MB max
  DEFAULT_USER_STORAGE_LIMIT: z.coerce.number().min(1).default(10737418240), // 10GB

  // Optional
  BASE_URL: z.string().url().optional(),
  PUBLIC_URL: z.string().url().optional(),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  APP_URL: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  DB_SSL: z.string().optional(),
  DB_MAX_CONNECTIONS: z.string().optional(),
  JWT_EXPIRES_IN: z.string().optional(),
  ACCESS_TOKEN_EXPIRY: z.string().optional(),
  REFRESH_TOKEN_EXPIRY: z.string().optional(),
  BCRYPT_SALT_ROUNDS: z.string().optional(),
  SESSION_TIMEOUT: z.string().optional(),
  USE_MOCK_USER: z.string().optional(),
  UPLOAD_DIR: z.string().optional(),
  MAX_UPLOAD_SIZE: z.string().optional(),
  ALLOWED_FILE_TYPES: z.string().optional(),
  MAX_TOTAL_STORAGE_BYTES: z.string().optional(),
  STORAGE_WARNING_THRESHOLD: z.string().optional(),
  TEMP_FILE_MAX_AGE_HOURS: z.string().optional(),
  CLEANUP_SCHEDULE_HOURS: z.string().optional(),
  ENABLE_ORPHANED_FILE_CLEANUP: z.string().optional(),
  THUMBNAIL_MAX_WIDTH: z.string().optional(),
  THUMBNAIL_MAX_HEIGHT: z.string().optional(),
  THUMBNAIL_QUALITY: z.string().optional(),
  PYTHONPATH: z.string().optional(),
  ML_SERVICE_URL: z.string().optional(),
  LOG_DIR: z.string().optional(),
  LOG_TO_FILE: z.string().optional(),
  LOG_MAX_FILES: z.string().optional(),
  LOG_STDOUT_JSON: z.string().optional(),
  CSRF_ENABLED: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  EMAIL_HOST: z.string().optional(),
  EMAIL_PORT: z.string().optional(),
  EMAIL_SECURE: z.string().optional(),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASS: z.string().optional(),
  RABBITMQ_URL: z.string().optional(),
  RABBITMQ_USER: z.string().optional(),
  RABBITMQ_HOST: z.string().optional(),
  RABBITMQ_PORT: z.string().optional(),
  RABBITMQ_QUEUE: z.string().optional(),
  ML_MAX_RETRIES: z.string().optional(),
  ML_RETRY_DELAY: z.string().optional(),
  ML_MAX_CONCURRENT_TASKS: z.string().optional(),
  ML_HEALTH_CHECK_INTERVAL: z.string().optional(),
  ML_QUEUE_UPDATE_INTERVAL: z.string().optional(),
  SEGMENTATION_MAX_CONCURRENT_TASKS: z.string().optional(),
  SEGMENTATION_CHECKPOINT_PATH: z.string().optional(),
  SEGMENTATION_MAX_RETRIES: z.string().optional(),
  SEGMENTATION_RETRY_DELAY: z.string().optional(),
  JWKS_URI: z.string().optional(),
  USE_JWT_KEY_ROTATION: z.string().optional(),
  METRICS_ENABLED: z.string().optional(),
  REQUEST_TIMEOUT_MS: z.string().optional(),
  METRICS_PREFIX: z.string().optional(),
  USE_REDIS_RATE_LIMIT: z.string().optional(),
  IP_WHITELIST: z.string().optional(),
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_PASSWORD_FILE: z.string().optional(),
  RABBITMQ_PASSWORD: z.string().optional(),
  RABBITMQ_PASSWORD_FILE: z.string().optional(),
  EMAIL_PASSWORD_FILE: z.string().optional(),
  REDIS_DB: z.string().optional(),
  TEMP_UPLOAD_DIR: z.string().optional(),
  ALLOW_TIFF_BMP: z.string().optional(),
  THUMBNAIL_FORMAT: z.string().optional(),
  API_TIMEOUT: z.string().optional(),
  SOCKET_PING_INTERVAL: z.string().optional(),
  SOCKET_TIMEOUT: z.string().optional(),
  MAX_DOWNLOAD_SIZE: z.string().optional(),
  OUTPUT_FILENAME_PREFIX: z.string().optional(),
  OUTPUT_FILENAME_TIMESTAMP_FORMAT: z.string().optional(),
  INCLUDE_METADATA: z.string().optional(),
  INCLUDE_STATISTICS: z.string().optional(),
  SESSION_COOKIE_NAME: z.string().optional(),
  SESSION_COOKIE_SECURE: z.string().optional(),
  SESSION_COOKIE_HTTPONLY: z.string().optional(),
  SESSION_COOKIE_SAMSITE: z.string().optional(),
  SESSION_COOKIE_PATH: z.string().optional(),
  SESSION_COOKIE_DOMAIN: z.string().optional(),
  SECURE_COOKIES: z.enum(['true', 'false']).optional(),
  TRUST_PROXY: z.enum(['true', 'false']).optional(),
  SESSION_MAX_AGE: z.string().optional(),
  SESSION_RESAVE: z.string().optional(),
  SESSION_SAVE_UNINITIALIZED: z.string().optional(),
  SESSION_PROXY: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validate environment variables
 */
export const validateEnv = (): EnvConfig => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join('\n');

      throw new Error(`Environment validation failed:\n${missingVars}`);
    }
    throw error;
  }
};

/**
 * Get validated environment config
 */
export const getEnvConfig = (): EnvConfig => {
  return validateEnv();
};
