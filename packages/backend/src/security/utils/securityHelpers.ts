/**
 * Security Helper Utilities
 * 
 * Common security-related utility functions used across the application
 */

import crypto from 'crypto';
import { Request } from 'express';

/**
 * Generate a cryptographically secure random token
 * @param length Token length in bytes (default: 32)
 * @returns Hex-encoded token string
 */
export const generateSecureToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Generate a secure nonce for CSP
 * @returns Base64-encoded nonce
 */
export const generateNonce = (): string => {
  return crypto.randomBytes(16).toString('base64');
};

/**
 * Hash a value using SHA-256
 * @param value Value to hash
 * @returns Hex-encoded hash
 */
export const sha256Hash = (value: string): string => {
  return crypto.createHash('sha256').update(value).digest('hex');
};

/**
 * Generate a secure session ID
 * @returns Session ID string
 */
export const generateSessionId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = generateSecureToken(16);
  return `${timestamp}-${random}`;
};

/**
 * Sanitize user input to prevent XSS
 * @param input User input string
 * @returns Sanitized string
 */
export const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') return '';
  
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();
};

/**
 * Check if a request is from a trusted origin
 * @param req Express request object
 * @param trustedOrigins List of trusted origins
 * @returns Boolean indicating if origin is trusted
 */
export const isTrustedOrigin = (req: Request, trustedOrigins: string[]): boolean => {
  const origin = req.get('origin') || req.get('referer');
  
  if (!origin) return false;
  
  return trustedOrigins.some(trusted => {
    if (trusted === '*') return true;
    
    try {
      const trustedUrl = new URL(trusted);
      const originUrl = new URL(origin);
      
      return trustedUrl.hostname === originUrl.hostname &&
             trustedUrl.protocol === originUrl.protocol;
    } catch {
      return false;
    }
  });
};

/**
 * Extract client IP address from request
 * Handles proxied requests
 * @param req Express request object
 * @returns Client IP address
 */
export const getClientIp = (req: Request): string => {
  // Check for forwarded IPs (when behind proxy)
  const forwarded = req.get('x-forwarded-for');
  if (forwarded) {
    // Return first IP if multiple are present
    return forwarded.split(',')[0].trim();
  }
  
  // Check for real IP header (some proxies use this)
  const realIp = req.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  // Fall back to request IP
  return req.ip || 'unknown';
};

/**
 * Validate email format
 * @param email Email address to validate
 * @returns Boolean indicating if email is valid
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate password strength
 * @param password Password to validate
 * @returns Object with validation result and message
 */
export const validatePasswordStrength = (password: string): {
  isValid: boolean;
  message?: string;
} => {
  if (!password || password.length < 8) {
    return {
      isValid: false,
      message: 'Password must be at least 8 characters long'
    };
  }
  
  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one uppercase letter'
    };
  }
  
  if (!/[a-z]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one lowercase letter'
    };
  }
  
  if (!/[0-9]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one number'
    };
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one special character'
    };
  }
  
  return { isValid: true };
};

/**
 * Create a secure hash for API keys
 * @param apiKey API key to hash
 * @returns Object with hash and salt
 */
export const hashApiKey = (apiKey: string): {
  hash: string;
  salt: string;
} => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(apiKey, salt, 10000, 64, 'sha512').toString('hex');
  
  return { hash, salt };
};

/**
 * Verify an API key against its hash
 * @param apiKey API key to verify
 * @param hash Stored hash
 * @param salt Stored salt
 * @returns Boolean indicating if key is valid
 */
export const verifyApiKey = (apiKey: string, hash: string, salt: string): boolean => {
  const verifyHash = crypto.pbkdf2Sync(apiKey, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
};

/**
 * Generate a time-limited token
 * @param data Data to encode in token
 * @param expiryMinutes Token expiry time in minutes
 * @returns Encoded token
 */
export const generateTimeLimitedToken = (data: any, expiryMinutes: number = 30): string => {
  const expiry = Date.now() + (expiryMinutes * 60 * 1000);
  const payload = {
    data,
    exp: expiry
  };
  
  const token = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', config.security.tokenSecret || 'default-secret')
    .update(token)
    .digest('base64url');
    
  return `${token}.${signature}`;
};

/**
 * Verify a time-limited token
 * @param token Token to verify
 * @returns Decoded data or null if invalid/expired
 */
export const verifyTimeLimitedToken = (token: string): any | null => {
  try {
    const [payload, signature] = token.split('.');
    
    const expectedSignature = crypto
      .createHmac('sha256', config.security.tokenSecret || 'default-secret')
      .update(payload)
      .digest('base64url');
      
    if (signature !== expectedSignature) {
      return null;
    }
    
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    
    if (decoded.exp < Date.now()) {
      return null;
    }
    
    return decoded.data;
  } catch {
    return null;
  }
};

// Re-export from config to avoid circular dependencies
import config from '../../config';