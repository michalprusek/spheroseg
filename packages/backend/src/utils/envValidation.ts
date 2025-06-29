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
  DB_PASSWORD: z.string().default('postgres'),
  
  // Authentication
  JWT_SECRET: z.string().min(32).default('your-secret-key-change-in-production'),
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
  RABBITMQ_QUEUE: z.string().optional(),
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
      const missingVars = error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join('\n');
      
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