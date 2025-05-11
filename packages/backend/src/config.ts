/**
 * Konfigurační soubor
 *
 * Tento soubor obsahuje konfiguraci aplikace načtenou z proměnných prostředí.
 */

import dotenv from 'dotenv';
import path from 'path';

// Načtení proměnných prostředí
dotenv.config();

// Určení prostředí
const env = process.env.NODE_ENV || 'development';
const isDevelopment = env === 'development';
const isProduction = env === 'production';
const isTest = env === 'test';

// Základní URL
const baseUrl = process.env.BASE_URL || 'http://localhost:5001';

// Konfigurace serveru
const server = {
  port: parseInt(process.env.PORT || '5001', 10),
  host: process.env.HOST || '0.0.0.0',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://frontend:3000').split(','),
  publicUrl: process.env.PUBLIC_URL || baseUrl,
};

// Konfigurace databáze
const db = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'spheroseg',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: process.env.DB_SSL === 'true',
  maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
  cacheTtl: parseInt(process.env.DB_CACHE_TTL || '60', 10),
  cacheCheckPeriod: parseInt(process.env.DB_CACHE_CHECK_PERIOD || '120', 10),
};

// Konfigurace ML služby
const ml = {
  serviceUrl: process.env.ML_SERVICE_URL || 'http://localhost:5002',
  maxRetries: parseInt(process.env.ML_MAX_RETRIES || '3', 10),
  retryDelay: parseInt(process.env.ML_RETRY_DELAY || '5000', 10),
  maxConcurrentTasks: parseInt(process.env.ML_MAX_CONCURRENT_TASKS || '2', 10),
  healthCheckInterval: parseInt(process.env.ML_HEALTH_CHECK_INTERVAL || '60000', 10),
  queueUpdateInterval: parseInt(process.env.ML_QUEUE_UPDATE_INTERVAL || '5000', 10),
};

// Konfigurace segmentace
const segmentation = {
  maxConcurrentTasks: parseInt(process.env.SEGMENTATION_MAX_CONCURRENT_TASKS || '2', 10),
  checkpointPath: process.env.SEGMENTATION_CHECKPOINT_PATH || '/app/models/resunet',
  checkpointExists: process.env.SEGMENTATION_CHECKPOINT_EXISTS !== 'false',
  modelType: process.env.SEGMENTATION_MODEL_TYPE || 'resunet',
  defaultThreshold: parseFloat(process.env.SEGMENTATION_DEFAULT_THRESHOLD || '0.5'),
  maxRetries: parseInt(process.env.SEGMENTATION_MAX_RETRIES || '3', 10),
  retryDelay: parseInt(process.env.SEGMENTATION_RETRY_DELAY || '5000', 10),
};

// Konfigurace úložiště
const storage = {
  uploadDir: process.env.UPLOAD_DIR || path.join(__dirname, '../uploads'),
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '100000000', 10), // 100 MB
  allowedFileTypes: (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/tiff').split(','),
  defaultUserLimitBytes: parseInt(process.env.DEFAULT_USER_STORAGE_LIMIT || '10737418240', 10), // 10 GB
};

// Konfigurace logování
const logging = {
  level: 'debug',
  format: process.env.LOG_FORMAT || 'json',
  logToFile: process.env.LOG_TO_FILE === 'true',
  logDir: process.env.LOG_DIR || path.join(__dirname, '../logs'),
};

// Konfigurace monitoringu
const monitoring = {
  metricsEnabled: process.env.METRICS_ENABLED !== 'false',
  metricsPrefix: process.env.METRICS_PREFIX || 'spheroseg_',
  requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || '30000', 10),
};

// Konfigurace zabezpečení
const security = {
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),
  csrfEnabled: process.env.CSRF_ENABLED !== 'false',
  rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== 'false',
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10), // 1 minuta
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // 100 požadavků za minutu
};

// Konfigurace autentizace
const auth = {
  tokenSecurityMode: process.env.TOKEN_SECURITY_MODE || 'standard', // 'standard' nebo 'strict'
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || '15m',
  refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d',
  sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '3600', 10), // 1 hodina v sekundách
  allowMockUser: process.env.ALLOW_MOCK_USER === 'true' || isDevelopment,
};

// Export konfigurace
export default {
  env,
  isDevelopment,
  isProduction,
  isTest,
  server,
  baseUrl,
  db,
  ml,
  segmentation,
  storage,
  logging,
  monitoring,
  security,
  auth,
};
