/**
 * Startup Validation
 * 
 * Validates critical configuration and dependencies on application startup.
 * Fails fast if critical issues are detected.
 */

import config from '../config';
import logger from './logger';
import pool from '../db';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Perform comprehensive startup validation
 */
export async function validateStartup(): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  logger.info('Starting application validation...');

  // 1. Validate JWT Secret
  try {
    validateJwtConfiguration(errors, warnings);
  } catch (error) {
    errors.push(`JWT validation failed: ${error.message}`);
  }

  // 2. Validate Database Connection
  try {
    await validateDatabaseConnection(errors, warnings);
  } catch (error) {
    errors.push(`Database validation failed: ${error.message}`);
  }

  // 3. Validate File System
  try {
    validateFileSystem(errors, warnings);
  } catch (error) {
    errors.push(`File system validation failed: ${error.message}`);
  }

  // 4. Validate Redis Connection (if enabled)
  if (config.security.useRedis || process.env.ENABLE_REDIS_CACHE === 'true') {
    try {
      await validateRedisConnection(errors, warnings);
    } catch (error) {
      warnings.push(`Redis validation failed: ${error.message}`);
    }
  }

  // 5. Validate ML Service (warning only)
  try {
    await validateMLService(warnings);
  } catch (error) {
    warnings.push(`ML service validation failed: ${error.message}`);
  }

  // 6. Production-specific validations
  if (config.isProduction) {
    validateProductionConfig(errors, warnings);
  }

  // Log results
  if (errors.length > 0) {
    logger.error('Startup validation failed', { errors, warnings });
  } else if (warnings.length > 0) {
    logger.warn('Startup validation completed with warnings', { warnings });
  } else {
    logger.info('Startup validation completed successfully');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate JWT configuration
 */
function validateJwtConfiguration(errors: string[], warnings: string[]): void {
  if (!config.auth.jwtSecret) {
    errors.push('JWT_SECRET is not configured');
    return;
  }

  const jwtSecret = config.auth.jwtSecret;
  const minLength = config.isProduction ? 32 : 16;

  if (jwtSecret.length < minLength) {
    errors.push(`JWT_SECRET must be at least ${minLength} characters in ${config.env} mode`);
  }

  // Check for weak secrets in production
  if (config.isProduction) {
    const weakPatterns = [
      'your-secret-key',
      'change-me',
      'default',
      'password',
      'secret',
      'test',
    ];

    const containsWeakPattern = weakPatterns.some(pattern => 
      jwtSecret.toLowerCase().includes(pattern)
    );

    if (containsWeakPattern) {
      errors.push('JWT_SECRET contains weak or default values in production');
    }

    // Check entropy
    const uniqueChars = new Set(jwtSecret).size;
    if (uniqueChars < 10) {
      errors.push('JWT_SECRET has insufficient entropy (too few unique characters)');
    }
  }

  // Session secret validation
  if (!config.auth.sessionSecret && config.isProduction) {
    warnings.push('SESSION_SECRET not configured, using JWT_SECRET as fallback');
  }
}

/**
 * Validate database connection
 */
async function validateDatabaseConnection(errors: string[], warnings: string[]): Promise<void> {
  try {
    // Test basic connection
    const result = await pool.query('SELECT version() as version, current_database() as database');
    const dbVersion = result.rows[0]?.version;
    const dbName = result.rows[0]?.database;

    logger.info('Database connection validated', { dbVersion, dbName });

    // Check if using default password in production
    if (config.isProduction && config.db.password === 'postgres') {
      errors.push('Using default database password in production');
    }

    // Check SSL
    if (config.isProduction && !config.db.ssl) {
      warnings.push('Database SSL not enabled in production');
    }

    // Check critical tables exist
    const tables = ['users', 'images', 'segmentation_results', 'segmentation_queue'];
    for (const table of tables) {
      const tableExists = await pool.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )`,
        [table]
      );

      if (!tableExists.rows[0]?.exists) {
        errors.push(`Required table '${table}' does not exist`);
      }
    }
  } catch (error) {
    errors.push(`Database connection failed: ${error.message}`);
  }
}

/**
 * Validate file system
 */
function validateFileSystem(errors: string[], warnings: string[]): void {
  const uploadDir = config.storage.uploadDir;

  // Check if upload directory exists
  if (!fs.existsSync(uploadDir)) {
    try {
      fs.mkdirSync(uploadDir, { recursive: true });
      logger.info(`Created upload directory: ${uploadDir}`);
    } catch (error) {
      errors.push(`Failed to create upload directory: ${error.message}`);
      return;
    }
  }

  // Check write permissions
  try {
    const testFile = path.join(uploadDir, '.write-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
  } catch (error) {
    errors.push(`Upload directory not writable: ${error.message}`);
  }

  // Check available space (warning only)
  try {
    const { execSync } = require('child_process');
    const dfOutput = execSync(`df -B1 ${uploadDir}`).toString();
    const lines = dfOutput.trim().split('\n');
    if (lines.length > 1) {
      const stats = lines[1].split(/\s+/);
      const available = parseInt(stats[3]);
      const minSpace = 1024 * 1024 * 1024; // 1GB

      if (available < minSpace) {
        warnings.push(`Low disk space: ${(available / 1024 / 1024 / 1024).toFixed(2)}GB available`);
      }
    }
  } catch (error) {
    // Ignore disk space check errors
  }
}

/**
 * Validate Redis connection
 */
async function validateRedisConnection(errors: string[], warnings: string[]): Promise<void> {
  try {
    const redis = require('redis');
    const client = redis.createClient({
      url: config.redis.url,
    });

    await client.connect();
    await client.ping();
    await client.quit();

    logger.info('Redis connection validated');

    // Check if using default/no password in production
    if (config.isProduction && !config.redis.password) {
      warnings.push('Redis running without password in production');
    }
  } catch (error) {
    throw new Error(`Redis connection failed: ${error.message}`);
  }
}

/**
 * Validate ML service
 */
async function validateMLService(warnings: string[]): Promise<void> {
  try {
    const mlUrl = config.ml.serviceUrl;
    const response = await axios.get(`${mlUrl}/health`, { timeout: 5000 });

    if (response.status === 200) {
      logger.info('ML service connection validated');
    } else {
      warnings.push(`ML service returned status ${response.status}`);
    }
  } catch (error) {
    warnings.push(`ML service not reachable: ${error.message}`);
  }
}

/**
 * Production-specific validations
 */
function validateProductionConfig(errors: string[], warnings: string[]): void {
  // Security settings
  if (!config.auth.secureCookies) {
    errors.push('Secure cookies not enabled in production');
  }

  if (!config.auth.trustProxy) {
    warnings.push('Trust proxy not enabled, may cause issues behind load balancer');
  }

  // CORS settings
  const allowedOrigins = config.server.corsOrigins;
  if (allowedOrigins.includes('*')) {
    errors.push('Wildcard CORS origin (*) not allowed in production');
  }

  if (allowedOrigins.some(origin => origin.includes('localhost'))) {
    warnings.push('Localhost in CORS origins for production');
  }

  // Email configuration
  if (!config.email.host || !config.email.pass) {
    warnings.push('Email not fully configured, password reset will not work');
  }

  // Rate limiting
  if (!config.security.enableRateLimit) {
    warnings.push('Rate limiting disabled in production');
  }

  // Logging
  if (config.logging.level === 'debug') {
    warnings.push('Debug logging enabled in production');
  }

  // Memory limits
  const memoryLimit = parseInt(process.env.CONTAINER_MEMORY_LIMIT_MB || '1024');
  if (memoryLimit < 1024) {
    warnings.push(`Low memory limit for production: ${memoryLimit}MB`);
  }
}

/**
 * Exit process if validation fails
 */
export async function validateAndExit(): Promise<void> {
  const result = await validateStartup();

  if (!result.valid) {
    logger.error('Application startup failed due to validation errors', result);
    process.exit(1);
  }

  if (result.warnings.length > 0) {
    logger.warn('Application starting with warnings', { warnings: result.warnings });
  }
}