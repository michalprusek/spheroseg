/**
 * Enhanced Validation and Sanitization
 * 
 * Combines Zod validation with comprehensive sanitization to provide
 * robust input validation and security protection.
 */

import { z } from 'zod';
import {
  sanitizeHtml,
  sanitizeText,
  sanitizeEmail,
  sanitizeUrl,
  sanitizePhone,
  sanitizeJson
} from '../utils/sanitization';
import logger from '../utils/logger';

// ===========================
// Enhanced Validation Schemas
// ===========================

/**
 * Enhanced text validation with sanitization
 */
export const createTextSchema = (options?: {
  minLength?: number;
  maxLength?: number;
  allowHtml?: boolean;
  required?: boolean;
  pattern?: RegExp;
}) => {
  const {
    minLength = 1,
    maxLength = 1000,
    allowHtml = false,
    required = true,
    pattern
  } = options || {};

  let schema = z.string();
  
  if (!required) {
    schema = schema.optional();
  }

  return schema
    .transform(val => {
      if (!val) return val;
      return allowHtml 
        ? sanitizeHtml(val, { maxLength })
        : sanitizeText(val, { maxLength, allowHtml: false });
    })
    .pipe(
      z.string()
        .min(minLength, `Must be at least ${minLength} characters`)
        .max(maxLength, `Must not exceed ${maxLength} characters`)
        .refine(val => !pattern || pattern.test(val), {
          message: 'Invalid format'
        })
    );
};

/**
 * Enhanced email validation with sanitization
 */
export const emailSchema = z.string()
  .transform(sanitizeEmail)
  .pipe(
    z.string()
      .email('Invalid email format')
      .max(254, 'Email too long')
  );

/**
 * Enhanced URL validation with sanitization
 */
export const createUrlSchema = (options?: {
  allowedProtocols?: string[];
  allowRelative?: boolean;
  required?: boolean;
}) => {
  const {
    allowedProtocols = ['http:', 'https:'],
    allowRelative = false,
    required = true
  } = options || {};

  let schema = z.string();
  
  if (!required) {
    schema = schema.optional();
  }

  return schema
    .transform(val => {
      if (!val) return val;
      return sanitizeUrl(val, { allowedProtocols, allowRelative });
    })
    .pipe(
      z.string()
        .refine(val => {
          if (!val) return !required;
          try {
            if (allowRelative && !val.includes('://')) {
              return true;
            }
            const url = new URL(val);
            return allowedProtocols.includes(url.protocol);
          } catch {
            return false;
          }
        }, 'Invalid URL format')
    );
};

/**
 * Enhanced filename validation with sanitization
 */
export const filenameSchema = z.string()
  .transform((val) => sanitizeText(val, { allowHtml: false }))
  .pipe(
    z.string()
      .min(1, 'Filename cannot be empty')
      .max(255, 'Filename too long')
      .refine(val => !val.startsWith('.'), 'Filename cannot start with a dot')
  );

/**
 * Enhanced phone validation with sanitization
 */
export const phoneSchema = z.string()
  .transform(sanitizePhone)
  .pipe(
    z.string()
      .regex(/^[+]?[\d\s()-]{10,15}$/, 'Invalid phone number format')
  );

/**
 * Enhanced password validation
 */
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long')
  .refine(val => /[a-z]/.test(val), 'Must contain lowercase letter')
  .refine(val => /[A-Z]/.test(val), 'Must contain uppercase letter')
  .refine(val => /\d/.test(val), 'Must contain number')
  .refine(val => /[!@#$%^&*(),.?":{}|<>]/.test(val), 'Must contain special character');

/**
 * Enhanced HTML content validation with sanitization
 */
export const createHtmlSchema = (options?: {
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
  maxLength?: number;
}) => z.string()
  .transform(val => sanitizeHtml(val, options))
  .pipe(
    z.string()
      .max(options?.maxLength || 50000, 'Content too long')
  );

/**
 * Enhanced JSON validation with sanitization
 */
export const createJsonSchema = (maxDepth: number = 10) => z.string()
  .transform(val => {
    const sanitized = sanitizeJson(val, maxDepth);
    return sanitized ? JSON.stringify(sanitized) : null;
  })
  .pipe(
    z.string()
      .nullable()
      .refine(val => {
        if (!val) return false;
        try {
          JSON.parse(val);
          return true;
        } catch {
          return false;
        }
      }, 'Invalid JSON format')
  );

// ===========================
// File Upload Validation
// ===========================

export interface FileValidationOptions {
  maxSize?: number; // in bytes
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
  required?: boolean;
}

export const createFileSchema = (options?: FileValidationOptions) => {
  const {
    maxSize = 50 * 1024 * 1024, // 50MB default
    allowedMimeTypes = ['image/jpeg', 'image/png', 'image/tiff', 'image/bmp'],
    allowedExtensions = ['.jpg', '.jpeg', '.png', '.tiff', '.bmp']
  } = options || {};

  return z.object({
    originalname: filenameSchema,
    mimetype: z.string()
      .refine(val => allowedMimeTypes.includes(val), {
        message: `Invalid file type. Allowed: ${allowedMimeTypes.join(', ')}`
      }),
    size: z.number()
      .max(maxSize, `File too large. Maximum: ${Math.round(maxSize / 1024 / 1024)}MB`),
    buffer: typeof Buffer !== 'undefined' ? z.instanceof(Buffer).optional() : z.any().optional(),
    path: z.string().optional(),
  }).refine(file => {
    const ext = file.originalname.toLowerCase().split('.').pop();
    return ext && allowedExtensions.some(allowed => 
      allowed.toLowerCase().substring(1) === ext
    );
  }, {
    message: `Invalid file extension. Allowed: ${allowedExtensions.join(', ')}`
  });
};

// ===========================
// Enhanced Form Schemas
// ===========================

/**
 * User registration schema with enhanced validation
 */
export const userRegistrationSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  name: createTextSchema({
    minLength: 2,
    maxLength: 100,
    allowHtml: false
  }),
  phone: phoneSchema.optional(),
  terms: z.boolean().refine(val => val === true, 'Must accept terms'),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

/**
 * User login schema with enhanced validation
 */
export const userLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

/**
 * Project creation schema with enhanced validation
 */
export const projectCreationSchema = z.object({
  name: createTextSchema({
    minLength: 3,
    maxLength: 200,
    allowHtml: false
  }),
  description: createTextSchema({
    minLength: 10,
    maxLength: 1000,
    allowHtml: true,
    required: false
  }),
  isPublic: z.boolean().default(false),
  tags: z.array(
    createTextSchema({
      minLength: 1,
      maxLength: 50,
      allowHtml: false
    })
  ).max(10, 'Too many tags').optional(),
});

/**
 * Image upload schema with enhanced validation
 */
export const imageUploadSchema = z.object({
  file: createFileSchema({
    maxSize: 50 * 1024 * 1024, // 50MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/tiff', 'image/bmp'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.tiff', '.bmp'],
  }),
  description: createTextSchema({
    maxLength: 500,
    allowHtml: false,
    required: false
  }),
  tags: z.array(
    createTextSchema({
      minLength: 1,
      maxLength: 50,
      allowHtml: false
    })
  ).max(10, 'Too many tags').optional(),
});

/**
 * Profile update schema with enhanced validation
 */
export const profileUpdateSchema = z.object({
  name: createTextSchema({
    minLength: 2,
    maxLength: 100,
    allowHtml: false,
    required: false
  }),
  bio: createTextSchema({
    maxLength: 1000,
    allowHtml: true,
    required: false
  }),
  phone: phoneSchema.optional(),
  website: createUrlSchema({
    allowedProtocols: ['http:', 'https:'],
    required: false
  }),
  avatar: createUrlSchema({
    allowedProtocols: ['http:', 'https:'],
    required: false
  }),
});

// ===========================
// Pagination and Search
// ===========================

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: createTextSchema({
    maxLength: 50,
    allowHtml: false,
    required: false
  }),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const searchSchema = z.object({
  query: createTextSchema({
    minLength: 1,
    maxLength: 200,
    allowHtml: false,
    required: false
  }),
  filters: z.record(
    createTextSchema({
      maxLength: 100,
      allowHtml: false
    })
  ).optional(),
});

// ===========================
// Request Validation Utilities
// ===========================

/**
 * Validate and sanitize request body
 */
export async function validateBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown,
  context?: string
): Promise<{ success: true; data: T } | { success: false; errors: z.ZodError }> {
  try {
    const data = await schema.parseAsync(body);
    
    if (context) {
      logger.debug(`Validation successful for ${context}`, { dataType: typeof data });
    }
    
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      if (context) {
        logger.warn(`Validation failed for ${context}`, {
          errors: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
            code: e.code
          }))
        });
      }
      
      return { success: false, errors: error };
    }
    
    throw error;
  }
}

/**
 * Validate and sanitize query parameters
 */
export async function validateQuery<T>(
  schema: z.ZodSchema<T>,
  query: unknown,
  context?: string
): Promise<{ success: true; data: T } | { success: false; errors: z.ZodError }> {
  // Convert string values to appropriate types for query parameters
  const processedQuery = processQueryParams(query);
  return validateBody(schema, processedQuery, context);
}

/**
 * Process query parameters (convert strings to numbers/booleans where appropriate)
 */
function processQueryParams(query: unknown): unknown {
  if (!query || typeof query !== 'object') {
    return query;
  }

  const processed: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string') {
      // Try to convert to number
      if (/^\d+$/.test(value)) {
        processed[key] = parseInt(value, 10);
      }
      // Try to convert to boolean
      else if (value === 'true') {
        processed[key] = true;
      }
      else if (value === 'false') {
        processed[key] = false;
      }
      // Keep as string
      else {
        processed[key] = value;
      }
    } else {
      processed[key] = value;
    }
  }
  
  return processed;
}

// ===========================
// Exports
// ===========================

export default {
  // Schema creators
  createTextSchema,
  createUrlSchema,
  createHtmlSchema,
  createJsonSchema,
  createFileSchema,
  
  // Individual schemas
  emailSchema,
  filenameSchema,
  phoneSchema,
  passwordSchema,
  
  // Form schemas
  userRegistrationSchema,
  userLoginSchema,
  projectCreationSchema,
  imageUploadSchema,
  profileUpdateSchema,
  
  // Utility schemas
  paginationSchema,
  searchSchema,
  
  // Validation functions
  validateBody,
  validateQuery,
};