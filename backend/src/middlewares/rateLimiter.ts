import rateLimit from 'express-rate-limit';
import { config } from '../config/app';

// Basic rate limiter for all routes
export const basicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: 'Too many requests from this IP, please try again after 15 minutes',
  skip: (req) => {
    // Skip rate limiting for internal requests with API key
    const apiKey = req.headers['x-api-key'];
    return apiKey === config.security.internalApiKey;
  }
});

// Stricter rate limiter for authentication routes
export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 login attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts from this IP, please try again after an hour'
});

// Rate limiter for file uploads
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // limit each IP to 50 uploads per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many file uploads from this IP, please try again after an hour'
});

// Rate limiter for ML operations
export const mlLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // limit each IP to 20 ML operations per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many ML operations from this IP, please try again after an hour'
});