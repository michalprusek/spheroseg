/**
 * Docker Secrets Loader
 * 
 * This module handles loading secrets from Docker Secrets files or environment variables.
 * In production, secrets should be mounted as files by Docker Swarm.
 * In development, secrets can be provided as environment variables.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const SECRETS_BASE_PATH = '/run/secrets';

/**
 * Load a secret from Docker Secrets file or environment variable
 * @param secretName - Name of the secret
 * @param envVarName - Environment variable name as fallback
 * @param required - Whether the secret is required
 * @returns The secret value or undefined if not found and not required
 */
export function loadSecret(
  secretName: string,
  envVarName: string,
  required: boolean = false
): string | undefined {
  // First, try to load from Docker Secrets file
  const secretFilePath = path.join(SECRETS_BASE_PATH, secretName);
  
  try {
    if (fs.existsSync(secretFilePath)) {
      const secret = fs.readFileSync(secretFilePath, 'utf8').trim();
      if (secret) {
        return secret;
      }
    }
  } catch (error) {
    console.warn(`Failed to read secret file ${secretFilePath}:`, error);
  }

  // Check for file path in environment variable (e.g., JWT_SECRET_FILE)
  const fileEnvVar = process.env[`${envVarName}_FILE`];
  if (fileEnvVar) {
    try {
      const secret = fs.readFileSync(fileEnvVar, 'utf8').trim();
      if (secret) {
        return secret;
      }
    } catch (error) {
      console.warn(`Failed to read secret from file ${fileEnvVar}:`, error);
    }
  }

  // Fall back to environment variable
  const envValue = process.env[envVarName];
  if (envValue) {
    return envValue;
  }

  // If required and not found, throw error
  if (required) {
    throw new Error(
      `Required secret '${secretName}' not found. ` +
      `Checked: Docker secret file (${secretFilePath}), ` +
      `environment file path (${envVarName}_FILE), ` +
      `and environment variable (${envVarName})`
    );
  }

  return undefined;
}

/**
 * Validate JWT secret strength
 * @param secret - The JWT secret to validate
 * @throws Error if the secret is too weak
 */
export function validateJwtSecret(secret: string): void {
  const minLength = process.env["NODE_ENV"] === 'production' ? 32 : 16;
  
  if (!secret || secret.length < minLength) {
    throw new Error(
      `JWT secret must be at least ${minLength} characters long in ${process.env["NODE_ENV"]} mode`
    );
  }

  // Check for default or weak secrets in production
  if (process.env["NODE_ENV"] === 'production') {
    const weakSecrets = [
      'your-secret-key',
      'change-me',
      'secret',
      'password',
      'default',
      'your-secret-key-change-in-production'
    ];

    if (weakSecrets.some(weak => secret.toLowerCase().includes(weak))) {
      throw new Error(
        'JWT secret contains weak or default values. Please generate a strong secret for production.'
      );
    }

    // Check entropy (at least some variation in characters)
    const uniqueChars = new Set(secret).size;
    if (uniqueChars < 10) {
      throw new Error(
        'JWT secret has low entropy. Please use a more complex secret with varied characters.'
      );
    }
  }
}

/**
 * Generate a secure random secret
 * @param length - Length of the secret (default: 64)
 * @returns A cryptographically secure random string
 */
export function generateSecret(length: number = 64): string {
  return crypto.randomBytes(length).toString('base64').slice(0, length);
}

/**
 * Load all application secrets
 * @returns Object containing all loaded secrets
 */
export function loadSecrets() {
  const isProduction = process.env["NODE_ENV"] === 'production';

  // Load JWT secret with validation
  const jwtSecret = loadSecret('jwt_secret', 'JWT_SECRET', isProduction);
  if (jwtSecret) {
    validateJwtSecret(jwtSecret);
  } else if (!isProduction) {
    // Generate a secure secret for development
    console.warn('No JWT secret provided, generating a secure random secret for development');
    const devSecret = generateSecret(32);
    process.env["JWT_SECRET"] = devSecret;
  }

  // Load other secrets
  const secrets = {
    jwtSecret: jwtSecret || process.env["JWT_SECRET"],
    sessionSecret: loadSecret('session_secret', 'SESSION_SECRET'),
    dbPassword: loadSecret('db_password', 'DB_PASSWORD', isProduction),
    dbRootPassword: loadSecret('db_root_password', 'DB_ROOT_PASSWORD'),
    redisPassword: loadSecret('redis_password', 'REDIS_PASSWORD'),
    rabbitmqPassword: loadSecret('rabbitmq_password', 'RABBITMQ_PASSWORD'),
    emailPassword: loadSecret('email_password', 'EMAIL_PASS'),
  };

  // Validate all required secrets are present in production
  if (isProduction) {
    const requiredSecrets = ['jwtSecret', 'dbPassword'];
    const missingSecrets = requiredSecrets.filter(key => !secrets[key as keyof typeof secrets]);
    
    if (missingSecrets.length > 0) {
      throw new Error(
        `Missing required secrets in production: ${missingSecrets.join(', ')}. ` +
        'Please ensure all secrets are properly configured.'
      );
    }
  }

  return secrets;
}

/**
 * Construct database URL with secrets
 * @param secrets - Loaded secrets object
 * @param config - Database configuration
 * @returns Complete database URL
 */
export function constructDatabaseUrl(
  secrets: ReturnType<typeof loadSecrets>,
  config: {
    user: string;
    host: string;
    port: number;
    database: string;
    ssl?: boolean;
  }
): string {
  const password = secrets.dbPassword || 'postgres';
  const sslParam = config.ssl ? '?ssl=prefer' : '';
  
  return `postgresql://${config.user}:${password}@${config.host}:${config.port}/${config.database}${sslParam}`;
}

/**
 * Construct Redis URL with secrets
 * @param secrets - Loaded secrets object
 * @param config - Redis configuration
 * @returns Complete Redis URL
 */
export function constructRedisUrl(
  secrets: ReturnType<typeof loadSecrets>,
  config: {
    host: string;
    port: number;
    db?: number;
  }
): string {
  const password = secrets.redisPassword;
  const auth = password ? `:${password}@` : '';
  const db = config.db ? `/${config.db}` : '';
  
  return `redis://${auth}${config.host}:${config.port}${db}`;
}

/**
 * Construct RabbitMQ URL with secrets
 * @param secrets - Loaded secrets object
 * @param config - RabbitMQ configuration
 * @returns Complete RabbitMQ URL
 */
export function constructRabbitmqUrl(
  secrets: ReturnType<typeof loadSecrets>,
  config: {
    user: string;
    host: string;
    port: number;
  }
): string {
  const password = secrets.rabbitmqPassword || 'guest';
  
  return `amqp://${config.user}:${password}@${config.host}:${config.port}`;
}