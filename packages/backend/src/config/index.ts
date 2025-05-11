/**
 * Centralized configuration module for the application
 *
 * This module loads environment variables from .env file and provides
 * a structured configuration object for the application.
 *
 * Usage:
 * ```
 * import config from '@/config';
 *
 * console.log(config.server.port); // Access server port
 * console.log(config.db.host);     // Access database host
 * ```
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables from .env file
dotenv.config();

// Define the root directory of the application
const ROOT_DIR = path.resolve(__dirname, '../..');

// Define default values for configuration
const DEFAULT_PORT = 5001; // Updated to standardize on 5001 for backend
const DEFAULT_UPLOAD_DIR = path.join(ROOT_DIR, 'uploads');
const DEFAULT_AVATAR_DIR = path.join(DEFAULT_UPLOAD_DIR, 'avatars');
const DEFAULT_JWT_EXPIRY = '24h';
const DEFAULT_SALT_ROUNDS = 10;
const DEFAULT_MAX_CONCURRENT_TASKS = 2;
const DEFAULT_CHECKPOINT_PATH = '/app/ML/checkpoint_epoch_9.pth.tar';
const DEFAULT_USER_LIMIT_BYTES = BigInt('21474836480'); // 20 GiB

// Check if ML directory exists and contains the checkpoint file
const checkpointPath = process.env.ML_CHECKPOINT_PATH || DEFAULT_CHECKPOINT_PATH;
const checkpointExists = fs.existsSync(checkpointPath);

// Configuration object
const config = {
  env: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV !== 'production',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',

  server: {
    port: parseInt(process.env.PORT || `${DEFAULT_PORT}`, 10),
    host: process.env.HOST || '0.0.0.0',
    corsOrigins: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',')
      : [
          'http://localhost:3000',
          'http://localhost:3003',
          'http://localhost:5001',
          'http://localhost',
          'http://localhost:80',
          'http://127.0.0.1:49571',
          '*',
        ],
    publicUrl: process.env.PUBLIC_URL || 'http://localhost:5001',
  },

  baseUrl: process.env.BASE_URL || 'http://localhost:5001',

  db: {
    host: process.env.DB_HOST || 'spheroseg-db',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'spheroseg',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.DB_SSL === 'true',
    connectionString: process.env.DATABASE_URL,
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    jwtExpiry: process.env.JWT_EXPIRY || DEFAULT_JWT_EXPIRY,
    saltRounds: parseInt(process.env.SALT_ROUNDS || `${DEFAULT_SALT_ROUNDS}`, 10),
    accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || '15m',
    refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d',
    tokenSecurityMode: process.env.TOKEN_SECURITY_MODE || 'standard', // standard, strict, paranoid
  },

  storage: {
    uploadDir: process.env.UPLOAD_DIR || DEFAULT_UPLOAD_DIR,
    avatarDir: process.env.AVATAR_DIR || DEFAULT_AVATAR_DIR,
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600', 10), // 100MB
    defaultUserLimitBytes: process.env.DEFAULT_USER_STORAGE_LIMIT_BYTES
      ? BigInt(process.env.DEFAULT_USER_STORAGE_LIMIT_BYTES)
      : DEFAULT_USER_LIMIT_BYTES,
    allowedTypes: ['image/jpeg', 'image/png', 'image/tiff', 'image/bmp'],
  },

  segmentation: {
    maxConcurrentTasks: parseInt(process.env.MAX_CONCURRENT_TASKS || `${DEFAULT_MAX_CONCURRENT_TASKS}`, 10),
    checkpointPath: checkpointPath,
    checkpointExists: checkpointExists,
    devicePreference: process.env.DEVICE_PREFERENCE || 'best', // 'best', 'cpu', 'cuda', 'mps'
    mlScriptPath: process.env.ML_SCRIPT_PATH || '/app/ML/resunet_segmentation.py',
    mlServiceUrl: process.env.ML_SERVICE_URL || null, // null means direct Python execution
    queueDelay: parseInt(process.env.QUEUE_DELAY || '500', 10), // ms between queue processing
    pythonExecutable: process.env.PYTHON_EXECUTABLE || 'python3',
  },

  logging: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    enableConsole: process.env.LOG_CONSOLE !== 'false',
    enableFile: process.env.LOG_FILE === 'true' || process.env.NODE_ENV === 'production',
    logDir: process.env.LOG_DIR || path.join(ROOT_DIR, 'logs'),
  },

  monitoring: {
    metricsEnabled: process.env.METRICS_ENABLED === 'true',
    tracingEnabled: process.env.TRACING_ENABLED === 'true',
  },

  security: {
    rateLimitRequests: parseInt(process.env.RATE_LIMIT_REQUESTS || '100', 10),
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60', 10), // seconds
  },
};

// Create necessary directories
if (!fs.existsSync(config.storage.uploadDir)) {
  fs.mkdirSync(config.storage.uploadDir, { recursive: true });
}

if (!fs.existsSync(config.storage.avatarDir)) {
  fs.mkdirSync(config.storage.avatarDir, { recursive: true });
}

if (config.logging.enableFile && !fs.existsSync(config.logging.logDir)) {
  fs.mkdirSync(config.logging.logDir, { recursive: true });
}

export default config;
