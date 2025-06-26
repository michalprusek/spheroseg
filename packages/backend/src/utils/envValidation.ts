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