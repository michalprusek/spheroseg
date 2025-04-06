import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

let dbHost = process.env.DB_HOST;
let dbPort = process.env.DB_PORT;
let dbName = process.env.DB_NAME;
let dbUser = process.env.DB_USER;
let dbPassword = process.env.DB_PASSWORD;

// If DATABASE_URL is set, parse it and override individual DB params
if (process.env.DATABASE_URL) {
  try {
    const dbUrl = new URL(process.env.DATABASE_URL);
    dbHost = dbUrl.hostname;
    dbPort = dbUrl.port;
    dbName = dbUrl.pathname.replace(/^\//, '');
    dbUser = dbUrl.username;
    dbPassword = dbUrl.password;

    // Export parsed values back to process.env for child processes and libraries
    process.env.DB_HOST = dbHost;
    process.env.DB_PORT = dbPort;
    process.env.DB_NAME = dbName;
    process.env.DB_USER = dbUser;
    process.env.DB_PASSWORD = dbPassword;
  } catch (err) {
    console.warn('Invalid DATABASE_URL, falling back to individual DB env vars');
  }
}

const envSchema = z.object({
  DB_HOST: z.string().default(dbHost || 'localhost'),
  DB_PORT: z.string().default(dbPort || '5432').transform(Number),
  DB_NAME: z.string().default(dbName || 'postgres'),
  DB_USER: z.string().default(dbUser || 'postgres'),
  DB_PASSWORD: z.string().default(dbPassword || 'postgres'),
  PORT: z.string().default(process.env.PORT || '3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('1d'),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE: z.string().default('50MB'),
  ALLOWED_FILE_TYPES: z.string().default('image/jpeg,image/png,image/tiff'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  ML_SERVICE_URL: z.string().default('http://ml-service:8000'),
  ML_API_KEY: z.string().optional(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  QUEUE_NAME: z.string().default('segmentationQueue'),
  INTERNAL_API_KEY: z.string().min(32)
});

const env = envSchema.parse(process.env);

export const config = {
  db: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    name: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD
  },
  server: {
    port: env.PORT,
    env: env.NODE_ENV
  },
  auth: {
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN
  },
  storage: {
    uploadDir: env.UPLOAD_DIR,
    maxFileSize: env.MAX_FILE_SIZE,
    allowedFileTypes: env.ALLOWED_FILE_TYPES.split(',')
  },
  cors: {
    origin: env.CORS_ORIGIN
  },
  ml: {
    serviceUrl: env.ML_SERVICE_URL,
    apiKey: env.ML_API_KEY
  },
  queue: {
    redisUrl: env.REDIS_URL,
    name: env.QUEUE_NAME
  },
  security: {
    internalApiKey: env.INTERNAL_API_KEY
  }
};