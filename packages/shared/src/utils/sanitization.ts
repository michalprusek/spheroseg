/**
 * Comprehensive Input Sanitization Utilities
 * 
 * Provides robust sanitization functions to prevent XSS, SQL injection,
 * and other security vulnerabilities across the application.
 */

import DOMPurify from 'isomorphic-dompurify';
import { z } from 'zod';
import logger from './logger';

// ===========================
// Configuration Constants
// ===========================

export const SANITIZATION_CONFIG = {
  // HTML sanitization options
  HTML_ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'blockquote',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'code', 'pre'
  ],
  HTML_ALLOWED_ATTRIBUTES: {
    'a': ['href', 'title'],
    '*': ['class']
  },
  
  // Text limits
  MAX_TEXT_LENGTH: 10000,
  MAX_HTML_LENGTH: 50000,
  MAX_FILENAME_LENGTH: 255,
  
  // Patterns to block
  DANGEROUS_PATTERNS: [
    /javascript:/gi,
    /vbscript:/gi,
    /data:text\/html/gi,
    /data:application/gi,
    /on\w+\s*=/gi,
    /<script/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
    /<applet/gi,
    /<meta/gi,
    /<link/gi,
    /<style/gi,
  ],
  
  // SQL injection patterns
  SQL_INJECTION_PATTERNS: [
    /(\s|^)(union|select|insert|update|delete|drop|create|alter|exec|execute)\s/gi,
    /'/g,
    /;/g,
    /--/g,
    /\/\*/g,
    /\*\//g,
    /xp_/gi,
    /sp_/gi,
  ],
} as const;

// ===========================
// Sanitization Functions
// ===========================

/**
 * Sanitize HTML content safely
 */
export function sanitizeHtml(input: string, options?: {
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
  maxLength?: number;
}): string {
  if (typeof input !== 'string') {
    return '';
  }

  const maxLength = options?.maxLength || SANITIZATION_CONFIG.MAX_HTML_LENGTH;
  
  // Truncate if too long
  const truncated = input.length > maxLength ? input.substring(0, maxLength) : input;
  
  // Configure DOMPurify
  const config: DOMPurify.Config = {
    ALLOWED_TAGS: (options?.allowedTags || SANITIZATION_CONFIG.HTML_ALLOWED_TAGS) as string[],
    ALLOWED_ATTR: options?.allowedAttributes as string[] || SANITIZATION_CONFIG.HTML_ALLOWED_ATTRIBUTES,
    KEEP_CONTENT: true,
    ALLOW_DATA_ATTR: false,
    SANITIZE_DOM: true,
    FORCE_BODY: false,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    WHOLE_DOCUMENT: false,
  };
  
  try {
    const sanitized = DOMPurify.sanitize(truncated, config) as unknown as string;
    
    // Additional pattern-based cleaning
    let cleaned = sanitized;
    SANITIZATION_CONFIG.DANGEROUS_PATTERNS.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });
    
    return cleaned.trim();
  } catch (error) {
    logger.error('HTML sanitization error:', error);
    return '';
  }
}

/**
 * Sanitize plain text input
 */
export function sanitizeText(input: string, options?: {
  maxLength?: number;
  allowHtml?: boolean;
  preserveNewlines?: boolean;
}): string {
  if (typeof input !== 'string') {
    return '';
  }

  const maxLength = options?.maxLength || SANITIZATION_CONFIG.MAX_TEXT_LENGTH;
  const preserveNewlines = options?.preserveNewlines ?? true;
  
  let sanitized = input;
  
  // Truncate if too long
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  if (!options?.allowHtml) {
    // Remove all HTML tags
    sanitized = sanitized.replace(/<[^>]*>/g, '');
    
    // Remove dangerous patterns
    SANITIZATION_CONFIG.DANGEROUS_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });
  }
  
  // Handle newlines
  if (!preserveNewlines) {
    sanitized = sanitized.replace(/\r?\n/g, ' ');
  }
  
  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  return sanitized;
}

/**
 * Sanitize filename for safe storage
 */
export function sanitizeFilename(input: string): string {
  if (typeof input !== 'string') {
    return 'unnamed_file';
  }

  let sanitized = input;
  
  // Remove path separators and dangerous characters
  sanitized = sanitized.replace(/[/\\:*?"<>|]/g, '_');
  
  // Remove leading/trailing dots and spaces
  sanitized = sanitized.replace(/^[\s.]+|[\s.]+$/g, '');
  
  // Replace multiple dots with single dot
  sanitized = sanitized.replace(/\.{2,}/g, '.');
  
  // Remove dangerous filename patterns
  sanitized = sanitized.replace(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i, 'file');
  
  // Ensure reasonable length
  if (sanitized.length > SANITIZATION_CONFIG.MAX_FILENAME_LENGTH) {
    const ext = sanitized.split('.').pop();
    const nameLength = SANITIZATION_CONFIG.MAX_FILENAME_LENGTH - (ext ? ext.length + 1 : 0);
    sanitized = sanitized.substring(0, nameLength) + (ext ? '.' + ext : '');
  }
  
  // Fallback if empty
  return sanitized || 'unnamed_file';
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9@._-]/g, '');
}

/**
 * Sanitize URL
 */
export function sanitizeUrl(input: string, options?: {
  allowedProtocols?: string[];
  allowRelative?: boolean;
}): string {
  if (typeof input !== 'string') {
    return '';
  }

  const allowedProtocols = options?.allowedProtocols || ['http:', 'https:'];
  const allowRelative = options?.allowRelative ?? false;
  
  let sanitized = input.trim();
  
  // Remove dangerous protocols
  SANITIZATION_CONFIG.DANGEROUS_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });
  
  try {
    // Check if it's a relative URL
    if (allowRelative && !sanitized.includes('://')) {
      // Basic relative URL validation
      return sanitized.replace(/[<>"']/g, '');
    }
    
    const url = new URL(sanitized);
    
    if (!allowedProtocols.includes(url.protocol)) {
      return '';
    }
    
    return url.toString();
  } catch {
    return '';
  }
}

/**
 * Sanitize SQL-prone input (for dynamic queries - use parameterized queries instead when possible)
 */
export function sanitizeSqlInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  let sanitized = input;
  
  // Apply SQL injection patterns
  SANITIZATION_CONFIG.SQL_INJECTION_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });
  
  return sanitized.trim();
}

/**
 * Recursively sanitize object values (internal helper)
 */
function sanitizeObjectRecursive(obj: unknown, maxDepth: number, depth: number = 0): unknown {
  if (depth > maxDepth) {
    return null;
  }
  
  if (typeof obj === 'string') {
    return sanitizeText(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObjectRecursive(item, maxDepth, depth + 1));
  }
  
  if (obj && typeof obj === 'object') {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = sanitizeText(key);
      if (sanitizedKey) {
        sanitizedObj[sanitizedKey] = sanitizeObjectRecursive(value, maxDepth, depth + 1);
      }
    }
    return sanitizedObj;
  }
  
  return obj;
}

/**
 * Sanitize JSON input
 */
export function sanitizeJson(input: string, maxDepth: number = 10): unknown {
  if (typeof input !== 'string') {
    return null;
  }

  try {
    const parsed = JSON.parse(input);
    return sanitizeObjectRecursive(parsed, maxDepth);
  } catch {
    return null;
  }
}

/**
 * Sanitize phone number
 */
export function sanitizePhone(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input.replace(/[^+\d\s()-]/g, '').trim();
}

// ===========================
// Zod Integration
// ===========================

/**
 * Create Zod transformers with sanitization
 */
export const sanitizedString = (options?: {
  maxLength?: number;
  allowHtml?: boolean;
  preserveNewlines?: boolean;
}) => z.string().transform(val => sanitizeText(val, options));

export const sanitizedHtml = (options?: {
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
  maxLength?: number;
}) => z.string().transform(val => sanitizeHtml(val, options));

export const sanitizedEmail = () => z.string().transform(sanitizeEmail).pipe(z.string().email());

export const sanitizedUrl = (options?: {
  allowedProtocols?: string[];
  allowRelative?: boolean;
}) => z.string().transform(val => sanitizeUrl(val, options));

export const sanitizedFilename = () => z.string().transform(sanitizeFilename);

export const sanitizedPhone = () => z.string().transform(sanitizePhone);

// ===========================
// Batch Sanitization
// ===========================

/**
 * Sanitize an entire object recursively
 */
export function sanitizeObject(
  obj: Record<string, unknown>,
  rules?: Record<string, (value: unknown) => unknown>
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const sanitizedKey = sanitizeText(key);
    
    if (!sanitizedKey) continue;
    
    // Apply custom rule if available
    if (rules && rules[key]) {
      sanitized[sanitizedKey] = rules[key](value);
      continue;
    }
    
    // Default sanitization based on type
    if (typeof value === 'string') {
      sanitized[sanitizedKey] = sanitizeText(value);
    } else if (Array.isArray(value)) {
      sanitized[sanitizedKey] = value.map(item => 
        typeof item === 'string' ? sanitizeText(item) : item
      );
    } else if (value && typeof value === 'object') {
      sanitized[sanitizedKey] = sanitizeObject(value as Record<string, unknown>, rules);
    } else {
      sanitized[sanitizedKey] = value;
    }
  }
  
  return sanitized;
}

// ===========================
// Security Headers
// ===========================

/**
 * Generate Content Security Policy header value
 */
export function generateCSP(nonce?: string): string {
  const policies = [
    "default-src 'self'",
    `script-src 'self'${nonce ? ` 'nonce-${nonce}'` : ''} 'unsafe-inline'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
  
  return policies.join('; ');
}

// ===========================
// Exports
// ===========================

export default {
  // Main functions
  sanitizeHtml,
  sanitizeText,
  sanitizeFilename,
  sanitizeEmail,
  sanitizeUrl,
  sanitizeSqlInput,
  sanitizeJson,
  sanitizePhone,
  sanitizeObject,
  
  // Zod transformers
  sanitizedString,
  sanitizedHtml,
  sanitizedEmail,
  sanitizedUrl,
  sanitizedFilename,
  sanitizedPhone,
  
  // Security utilities
  generateCSP,
  
  // Configuration
  SANITIZATION_CONFIG,
};