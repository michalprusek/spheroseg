import { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import config from '../config';
import logger from '../utils/logger';

// Default allowed origins
const defaultAllowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3003',
  'http://localhost:5001',
  'http://localhost',
  'http://localhost:80',
  'http://localhost:8080',
  'http://127.0.0.1:49571',
  '*',
];

// Get allowed origins from environment or use defaults
const allowedOrigins = config.cors?.allowedOrigins || defaultAllowedOrigins;

// Create CORS options object
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (like mobile apps, curl requests)
    if (!origin) return callback(null, true);

    // Check if origin is allowed
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS policy`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Allow-Headers',
  ],
  exposedHeaders: ['Access-Control-Allow-Origin', 'Access-Control-Allow-Methods', 'Access-Control-Allow-Headers'],
};

// CORS middleware
export const corsMiddleware = () => {
  logger.info('CORS middleware applied', { allowedOrigins });
  return cors(corsOptions);
};

// Custom CORS preflight middleware for better error handling
export const corsPreflightMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    // Set CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    res.header('Access-Control-Max-Age', '86400');
    return res.sendStatus(204);
  }
  next();
};

export default corsMiddleware;
