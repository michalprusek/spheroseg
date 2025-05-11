/**
 * Mock configuration for tests
 *
 * This mock ensures tests don't need to create real directories
 * and can be run in a clean environment.
 */

import fs from 'fs';
import path from 'path';

// Mock fs.existsSync and fs.mkdirSync to prevent actual filesystem operations
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn().mockReturnValue(true), // Pretend all paths exist
  mkdirSync: jest.fn(), // Mock directory creation
}));

// Define test config paths
const ROOT_DIR = '/test-root';
const UPLOAD_DIR = path.join(ROOT_DIR, 'uploads');
const AVATAR_DIR = path.join(UPLOAD_DIR, 'avatars');
const LOG_DIR = path.join(ROOT_DIR, 'logs');

// Mock configuration object
const config = {
  env: 'test',
  isDevelopment: false,
  isProduction: false,
  isTest: true,

  server: {
    port: 5001,
    host: 'localhost',
    corsOrigins: ['http://localhost:3000', 'http://localhost:3003', '*'],
    publicUrl: 'http://localhost:5001',
  },

  baseUrl: 'http://localhost:5001',

  db: {
    host: 'localhost',
    port: 5432,
    database: 'test_db',
    user: 'test_user',
    password: 'test_password',
    ssl: false,
    connectionString: undefined,
    maxConnections: 10,
  },

  auth: {
    jwtSecret: 'test-secret-key',
    jwtExpiry: '24h',
    saltRounds: 10,
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d',
    tokenSecurityMode: 'standard',
  },

  storage: {
    uploadDir: UPLOAD_DIR,
    avatarDir: AVATAR_DIR,
    maxFileSize: 104857600, // 100MB
    defaultUserLimitBytes: BigInt('21474836480'), // 20 GiB
    allowedTypes: ['image/jpeg', 'image/png', 'image/tiff', 'image/bmp'],
  },

  segmentation: {
    maxConcurrentTasks: 2,
    checkpointPath: '/test/ML/checkpoint.pth.tar',
    checkpointExists: true,
    devicePreference: 'cpu',
    mlScriptPath: '/test/ML/resunet_segmentation.py',
    mlServiceUrl: null,
    queueDelay: 500,
    pythonExecutable: 'python3',
  },

  logging: {
    level: 'debug',
    enableConsole: true,
    enableFile: false,
    logDir: LOG_DIR,
  },

  monitoring: {
    metricsEnabled: false,
    tracingEnabled: false,
  },

  security: {
    rateLimitRequests: 100,
    rateLimitWindow: 60,
  },
};

export default config;
