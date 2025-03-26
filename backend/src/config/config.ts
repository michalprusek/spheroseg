import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Environment
const ENV = process.env.NODE_ENV || 'development';

// Server configuration
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8000;
const API_PREFIX = process.env.API_PREFIX || '/api';

// Database configuration - already handled by Prisma

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-jwt-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// File storage configuration
const STORAGE_TYPE = process.env.STORAGE_TYPE || 'local'; // 'local' or 's3'
const UPLOADS_FOLDER = process.env.UPLOADS_FOLDER || path.resolve(__dirname, '../../uploads');
const MAX_FILE_SIZE = process.env.MAX_FILE_SIZE ? parseInt(process.env.MAX_FILE_SIZE, 10) : 10 * 1024 * 1024; // 10MB

// CORS configuration
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// Rate limiting
const RATE_LIMIT_WINDOW_MS = process.env.RATE_LIMIT_WINDOW_MS 
  ? parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) 
  : 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = process.env.RATE_LIMIT_MAX 
  ? parseInt(process.env.RATE_LIMIT_MAX, 10) 
  : 100; // 100 requests per window

export default {
  env: ENV,
  port: PORT,
  apiPrefix: API_PREFIX,
  jwt: {
    secret: JWT_SECRET,
    expiresIn: JWT_EXPIRES_IN,
  },
  storage: {
    type: STORAGE_TYPE,
    uploadsFolder: UPLOADS_FOLDER,
    maxFileSize: MAX_FILE_SIZE,
  },
  cors: {
    origin: CORS_ORIGIN,
  },
  rateLimit: {
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX,
  },
}; 