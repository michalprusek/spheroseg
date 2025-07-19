/**
 * Security Configuration
 *
 * Centralizes all security-related settings for production deployment
 */

import crypto from 'crypto';
import logger from '../utils/logger';

// Generate a secure secret if not provided
const generateSecureSecret = (name: string): string => {
  if (process.env['NODE_ENV'] === 'production') {
    logger.error(`${name} is not set in production! Using generated secret (NOT RECOMMENDED)`);
  }
  return crypto.randomBytes(64).toString('base64');
};

export const securityConfig = {
  // JWT Configuration
  jwt: {
    secret: process.env['JWT_SECRET'] || generateSecureSecret('JWT_SECRET'),
    expiresIn: process.env['JWT_EXPIRES_IN'] || '7d',
    refreshSecret: process.env['JWT_REFRESH_SECRET'] || generateSecureSecret('JWT_REFRESH_SECRET'),
    refreshExpiresIn: process.env['JWT_REFRESH_EXPIRES_IN'] || '30d',
    algorithm: 'HS256' as const,
    issuer: process.env['JWT_ISSUER'] || 'spheroseg',
    audience: process.env['JWT_AUDIENCE'] || 'spheroseg-users',
  },

  // Session Configuration
  session: {
    secret: process.env['SESSION_SECRET'] || generateSecureSecret('SESSION_SECRET'),
    name: 'spheroseg.sid',
    cookie: {
      secure: process.env['NODE_ENV'] === 'production' || process.env['COOKIE_SECURE'] === 'true',
      httpOnly: true,
      sameSite: (process.env['COOKIE_SAMESITE'] as 'strict' | 'lax' | 'none') || 'strict',
      maxAge: parseInt(process.env['SESSION_MAX_AGE'] || '86400000', 10), // 24 hours
      domain: process.env['COOKIE_DOMAIN'],
    },
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset expiry on activity
  },

  // CORS Configuration
  cors: {
    origin: process.env['ALLOWED_ORIGINS']?.split(',').map((origin) => origin.trim()) || [
      'http://localhost:3000',
      'http://localhost',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
    maxAge: 86400, // 24 hours
  },

  // CSRF Protection
  csrf: {
    enabled: process.env['CSRF_ENABLED'] !== 'false',
    secret: process.env['CSRF_SECRET'] || generateSecureSecret('CSRF_SECRET'),
    cookieName: 'XSRF-TOKEN',
    headerName: 'X-CSRF-Token',
    paramName: '_csrf',
    cookie: {
      httpOnly: false, // Must be false for client to read
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'strict' as const,
    },
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000', 10), // 15 minutes
    max: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100', 10),
    standardHeaders: true,
    legacyHeaders: false,
    // Different limits for different endpoints
    endpoints: {
      login: {
        windowMs: 900000, // 15 minutes
        max: parseInt(process.env['RATE_LIMIT_LOGIN_MAX'] || '5', 10),
        skipSuccessfulRequests: true,
      },
      signup: {
        windowMs: 3600000, // 1 hour
        max: parseInt(process.env['RATE_LIMIT_SIGNUP_MAX'] || '3', 10),
      },
      api: {
        windowMs: 60000, // 1 minute
        max: parseInt(process.env['RATE_LIMIT_API_MAX'] || '60', 10),
      },
      upload: {
        windowMs: 3600000, // 1 hour
        max: parseInt(process.env['RATE_LIMIT_UPLOAD_MAX'] || '10', 10),
      },
    },
  },

  // Security Headers
  headers: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Note: Remove unsafe-* in production
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'", 'ws:', 'wss:', 'https:'],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        childSrc: ["'none'"],
      },
    },
    strictTransportSecurity: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    xContentTypeOptions: 'nosniff',
    xFrameOptions: 'DENY',
    xXssProtection: '1; mode=block',
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: {
      features: {
        camera: ["'none'"],
        microphone: ["'none'"],
        geolocation: ["'none'"],
        payment: ["'none'"],
      },
    },
  },

  // Password Policy
  password: {
    minLength: parseInt(process.env['PASSWORD_MIN_LENGTH'] || '8', 10),
    requireUppercase: process.env['PASSWORD_REQUIRE_UPPERCASE'] !== 'false',
    requireLowercase: process.env['PASSWORD_REQUIRE_LOWERCASE'] !== 'false',
    requireNumbers: process.env['PASSWORD_REQUIRE_NUMBERS'] !== 'false',
    requireSpecialChars: process.env['PASSWORD_REQUIRE_SPECIAL'] !== 'false',
    bcryptRounds: parseInt(process.env['BCRYPT_ROUNDS'] || '12', 10),
    maxLoginAttempts: parseInt(process.env['MAX_LOGIN_ATTEMPTS'] || '5', 10),
    lockoutDuration: parseInt(process.env['LOCKOUT_DURATION_MS'] || '900000', 10), // 15 minutes
  },

  // File Upload Security
  upload: {
    maxFileSize: parseInt(process.env['MAX_FILE_SIZE_BYTES'] || '52428800', 10), // 50MB
    allowedMimeTypes: process.env['ALLOWED_FILE_TYPES']?.split(',') || [
      'image/jpeg',
      'image/png',
      'image/tiff',
      'image/bmp',
    ],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.bmp'],
    scanForViruses: process.env['VIRUS_SCAN_ENABLED'] === 'true',
    storageEncryption: process.env['STORAGE_ENCRYPTION_ENABLED'] === 'true',
  },

  // API Security
  api: {
    requireHttps: process.env['NODE_ENV'] === 'production' && process.env['REQUIRE_HTTPS'] !== 'false',
    trustedProxies: process.env['TRUSTED_PROXIES']?.split(',') || ['127.0.0.1', '::1'],
    apiKeyHeader: 'X-API-Key',
    enableApiKeys: process.env['ENABLE_API_KEYS'] === 'true',
  },

  // Audit Logging
  audit: {
    enabled: process.env['AUDIT_LOGGING_ENABLED'] !== 'false',
    logLevel: process.env['AUDIT_LOG_LEVEL'] || 'info',
    sensitiveFields: ['password', 'token', 'secret', 'credit_card', 'ssn'],
    retentionDays: parseInt(process.env['AUDIT_RETENTION_DAYS'] || '90', 10),
  },
};

// Validate critical security settings in production
export const validateSecurityConfig = (): void => {
  if (process.env['NODE_ENV'] === 'production') {
    const errors: string[] = [];

    if (!process.env['JWT_SECRET']) {
      errors.push('JWT_SECRET environment variable is required in production');
    }

    if (!process.env['SESSION_SECRET']) {
      errors.push('SESSION_SECRET environment variable is required in production');
    }

    if (!process.env['ALLOWED_ORIGINS']) {
      errors.push('ALLOWED_ORIGINS environment variable is required in production');
    }

    if (process.env['COOKIE_SECURE'] !== 'true') {
      errors.push('COOKIE_SECURE must be true in production');
    }

    if (errors.length > 0) {
      logger.error('Security configuration errors:', { errors });
      throw new Error('Invalid security configuration for production');
    }
  }
};

export default securityConfig;
