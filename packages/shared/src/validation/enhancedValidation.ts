/**
 * Enhanced Validation and Sanitization
 * 
 * Provides comprehensive validation schemas with built-in sanitization
 * for secure data processing and validation
 */

import { z } from 'zod';
import { sanitizeText, sanitizeHtml, sanitizeUrl } from '../utils/sanitization';

// Text validation schema factory
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

  const baseSchema = z.string()
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

  return required ? baseSchema : baseSchema.optional();
};

// URL validation schema factory
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

  const baseSchema = z.string()
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
        }, {
          message: 'Invalid URL format'
        })
    );

  return required ? baseSchema : baseSchema.optional();
};

// Email validation schema
export const emailSchema = z.string()
  .email('Invalid email address')
  .transform(val => sanitizeText(val, { maxLength: 254 }));

// Filename validation schema
export const filenameSchema = createTextSchema({
  minLength: 1,
  maxLength: 255,
  pattern: /^[a-zA-Z0-9._-]+$/
});

// Phone validation schema
export const phoneSchema = createTextSchema({
  minLength: 10,
  maxLength: 20,
  pattern: /^[+]?[(]?[\d\s\-\(\)]+$/
});

// Password validation schema
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters')
  .refine(val => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(val), {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
  });

// HTML content validation schema
export const createHtmlSchema = (options?: {
  maxLength?: number;
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
}) => {
  const { maxLength = 10000, allowedTags, allowedAttributes } = options || {};
  
  return z.string()
    .transform(val => sanitizeHtml(val, { maxLength, allowedTags, allowedAttributes }))
    .pipe(z.string().max(maxLength, `Content must not exceed ${maxLength} characters`));
};

// User registration schema
export const userRegistrationSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: createTextSchema({ minLength: 1, maxLength: 50 }),
  lastName: createTextSchema({ minLength: 1, maxLength: 50 }),
  phone: phoneSchema.optional(),
  organization: createTextSchema({ minLength: 1, maxLength: 100, required: false })
});

// Project creation schema
export const projectCreationSchema = z.object({
  name: createTextSchema({ minLength: 1, maxLength: 100 }),
  description: createTextSchema({ minLength: 1, maxLength: 1000, required: false }),
  visibility: z.enum(['public', 'private']).default('private'),
  tags: z.array(createTextSchema({ minLength: 1, maxLength: 50 })).optional()
});

// Validation result type
export type ValidationResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
  issues?: string[];
};

// Body validation middleware
export const validateBody = async <T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context?: string
): Promise<ValidationResult<T>> => {
  try {
    const result = await schema.parseAsync(data);
    return {
      success: true,
      data: result
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: `Validation failed${context ? ` for ${context}` : ''}`,
        issues: error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
      };
    }
    return {
      success: false,
      error: 'Unknown validation error'
    };
  }
};

// Query validation middleware
export const validateQuery = async <T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context?: string
): Promise<ValidationResult<T>> => {
  try {
    // Pre-process query parameters (convert strings to appropriate types)
    const processedData = preprocessQueryParams(data);
    const result = await schema.parseAsync(processedData);
    return {
      success: true,
      data: result
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: `Query validation failed${context ? ` for ${context}` : ''}`,
        issues: error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
      };
    }
    return {
      success: false,
      error: 'Unknown validation error'
    };
  }
};

// Helper function to preprocess query parameters
const preprocessQueryParams = (data: unknown): unknown => {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const processed: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      // Try to convert string numbers to numbers
      const numValue = Number(value);
      if (!isNaN(numValue) && isFinite(numValue)) {
        processed[key] = numValue;
      } else if (value === 'true') {
        processed[key] = true;
      } else if (value === 'false') {
        processed[key] = false;
      } else {
        processed[key] = value;
      }
    } else {
      processed[key] = value;
    }
  }
  
  return processed;
};

// Export types
export type TextSchemaOptions = Parameters<typeof createTextSchema>[0];
export type UrlSchemaOptions = Parameters<typeof createUrlSchema>[0];
export type HtmlSchemaOptions = Parameters<typeof createHtmlSchema>[0];
export type UserRegistration = z.infer<typeof userRegistrationSchema>;
export type ProjectCreation = z.infer<typeof projectCreationSchema>;