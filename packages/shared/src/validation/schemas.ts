/**
 * Unified Validation Schemas
 * 
 * This module provides centralized validation schemas using Zod for both
 * frontend and backend. It ensures consistent validation rules across
 * the entire application.
 * 
 * Features:
 * - Type-safe validation with Zod
 * - Reusable schemas and refinements
 * - Consistent error messages
 * - Internationalization support
 * - Custom validators for common patterns
 */

import { z } from 'zod';

// ===========================
// Validation Constants
// ===========================

export const VALIDATION_CONSTANTS = {
  // Password
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  PASSWORD_REQUIRE_UPPERCASE: true,
  PASSWORD_REQUIRE_LOWERCASE: true,
  PASSWORD_REQUIRE_NUMBER: true,
  PASSWORD_REQUIRE_SPECIAL: true,
  
  // Username
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 30,
  USERNAME_PATTERN: /^[a-zA-Z0-9_-]+$/,
  
  // Names
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 50,
  FULL_NAME_MAX_LENGTH: 100,
  
  // Text fields
  TITLE_MIN_LENGTH: 1,
  TITLE_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 500,
  BIO_MAX_LENGTH: 1000,
  MESSAGE_MAX_LENGTH: 5000,
  
  // Email
  EMAIL_MAX_LENGTH: 254,
  
  // Phone
  PHONE_MIN_LENGTH: 10,
  PHONE_MAX_LENGTH: 15,
  
  // File upload
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/tiff', 'image/bmp'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'application/msword', 'text/plain'],
  
  // Pagination
  PAGE_MIN: 1,
  PAGE_MAX: 10000,
  LIMIT_MIN: 1,
  LIMIT_MAX: 100,
  LIMIT_DEFAULT: 20,
} as const;

// ===========================
// Error Messages
// ===========================

export const ERROR_MESSAGES = {
  required: 'This field is required',
  invalid_type: 'Invalid type provided',
  too_short: (field: string, min: number) => `${field} must be at least ${min} characters`,
  too_long: (field: string, max: number) => `${field} must not exceed ${max} characters`,
  invalid_email: 'Please enter a valid email address',
  invalid_phone: 'Please enter a valid phone number',
  invalid_url: 'Please enter a valid URL',
  invalid_date: 'Please enter a valid date',
  passwords_mismatch: 'Passwords do not match',
  weak_password: 'Password is too weak',
  invalid_username: 'Username can only contain letters, numbers, hyphens, and underscores',
  file_too_large: (maxMB: number) => `File size must not exceed ${maxMB}MB`,
  invalid_file_type: 'Invalid file type',
  min_value: (field: string, min: number) => `${field} must be at least ${min}`,
  max_value: (field: string, max: number) => `${field} must not exceed ${max}`,
  invalid_enum: (field: string, values: string[]) => `${field} must be one of: ${values.join(', ')}`,
} as const;

// ===========================
// Custom Validators
// ===========================

/**
 * Strong password validator
 */
export const strongPasswordSchema = z
  .string()
  .min(VALIDATION_CONSTANTS.PASSWORD_MIN_LENGTH, ERROR_MESSAGES.too_short('Password', VALIDATION_CONSTANTS.PASSWORD_MIN_LENGTH))
  .max(VALIDATION_CONSTANTS.PASSWORD_MAX_LENGTH, ERROR_MESSAGES.too_long('Password', VALIDATION_CONSTANTS.PASSWORD_MAX_LENGTH))
  .refine(
    (password) => {
      const checks = [
        !VALIDATION_CONSTANTS.PASSWORD_REQUIRE_UPPERCASE || /[A-Z]/.test(password),
        !VALIDATION_CONSTANTS.PASSWORD_REQUIRE_LOWERCASE || /[a-z]/.test(password),
        !VALIDATION_CONSTANTS.PASSWORD_REQUIRE_NUMBER || /[0-9]/.test(password),
        !VALIDATION_CONSTANTS.PASSWORD_REQUIRE_SPECIAL || /[^A-Za-z0-9]/.test(password),
      ];
      return checks.every(Boolean);
    },
    {
      message: 'Password must contain uppercase, lowercase, number, and special character',
    }
  );

/**
 * Simple password validator (less strict)
 */
export const simplePasswordSchema = z
  .string()
  .min(VALIDATION_CONSTANTS.PASSWORD_MIN_LENGTH, ERROR_MESSAGES.too_short('Password', VALIDATION_CONSTANTS.PASSWORD_MIN_LENGTH))
  .max(VALIDATION_CONSTANTS.PASSWORD_MAX_LENGTH, ERROR_MESSAGES.too_long('Password', VALIDATION_CONSTANTS.PASSWORD_MAX_LENGTH));

/**
 * Email validator
 */
export const emailSchema = z
  .string()
  .min(1, ERROR_MESSAGES.required)
  .email(ERROR_MESSAGES.invalid_email)
  .max(VALIDATION_CONSTANTS.EMAIL_MAX_LENGTH, ERROR_MESSAGES.too_long('Email', VALIDATION_CONSTANTS.EMAIL_MAX_LENGTH))
  .toLowerCase()
  .trim();

/**
 * Username validator
 */
export const usernameSchema = z
  .string()
  .min(VALIDATION_CONSTANTS.USERNAME_MIN_LENGTH, ERROR_MESSAGES.too_short('Username', VALIDATION_CONSTANTS.USERNAME_MIN_LENGTH))
  .max(VALIDATION_CONSTANTS.USERNAME_MAX_LENGTH, ERROR_MESSAGES.too_long('Username', VALIDATION_CONSTANTS.USERNAME_MAX_LENGTH))
  .regex(VALIDATION_CONSTANTS.USERNAME_PATTERN, ERROR_MESSAGES.invalid_username)
  .trim();

/**
 * Phone number validator
 */
export const phoneSchema = z
  .string()
  .min(VALIDATION_CONSTANTS.PHONE_MIN_LENGTH, ERROR_MESSAGES.too_short('Phone number', VALIDATION_CONSTANTS.PHONE_MIN_LENGTH))
  .max(VALIDATION_CONSTANTS.PHONE_MAX_LENGTH, ERROR_MESSAGES.too_long('Phone number', VALIDATION_CONSTANTS.PHONE_MAX_LENGTH))
  .regex(/^[+]?[\d\s()-]+$/, ERROR_MESSAGES.invalid_phone)
  .transform((val) => val.replace(/\D/g, '')); // Remove non-digits

/**
 * URL validator
 */
export const urlSchema = z
  .string()
  .url(ERROR_MESSAGES.invalid_url)
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
      } catch {
        return false;
      }
    },
    { message: 'URL must use HTTP or HTTPS protocol' }
  );

/**
 * Date validators
 */
export const dateSchema = z.string().datetime({ message: ERROR_MESSAGES.invalid_date });
export const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, ERROR_MESSAGES.invalid_date);
export const futureDateSchema = dateSchema.refine(
  (date) => new Date(date) > new Date(),
  { message: 'Date must be in the future' }
);
export const pastDateSchema = dateSchema.refine(
  (date) => new Date(date) < new Date(),
  { message: 'Date must be in the past' }
);

/**
 * File upload validator
 */
export const fileSchema = z.object({
  name: z.string(),
  size: z.number().max(VALIDATION_CONSTANTS.MAX_FILE_SIZE, ERROR_MESSAGES.file_too_large(50)),
  type: z.string(),
});

export const imageFileSchema = fileSchema.refine(
  (file) => VALIDATION_CONSTANTS.ALLOWED_IMAGE_TYPES.includes(file.type),
  { message: 'Only JPEG, PNG, WebP, TIFF, and BMP files are allowed' }
);

export const documentFileSchema = fileSchema.refine(
  (file) => VALIDATION_CONSTANTS.ALLOWED_DOCUMENT_TYPES.includes(file.type),
  { message: 'Only PDF, Word, and text files are allowed' }
);

// ===========================
// Common Field Schemas
// ===========================

export const idSchema = z.string().uuid({ message: 'Invalid ID format' });
export const slugSchema = z.string().regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens');
export const colorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format');
export const currencySchema = z.string().length(3, 'Currency code must be 3 characters').toUpperCase();

export const nameSchema = z
  .string()
  .min(VALIDATION_CONSTANTS.NAME_MIN_LENGTH, ERROR_MESSAGES.too_short('Name', VALIDATION_CONSTANTS.NAME_MIN_LENGTH))
  .max(VALIDATION_CONSTANTS.NAME_MAX_LENGTH, ERROR_MESSAGES.too_long('Name', VALIDATION_CONSTANTS.NAME_MAX_LENGTH))
  .trim();

export const titleSchema = z
  .string()
  .min(VALIDATION_CONSTANTS.TITLE_MIN_LENGTH, ERROR_MESSAGES.required)
  .max(VALIDATION_CONSTANTS.TITLE_MAX_LENGTH, ERROR_MESSAGES.too_long('Title', VALIDATION_CONSTANTS.TITLE_MAX_LENGTH))
  .trim();

export const descriptionSchema = z
  .string()
  .max(VALIDATION_CONSTANTS.DESCRIPTION_MAX_LENGTH, ERROR_MESSAGES.too_long('Description', VALIDATION_CONSTANTS.DESCRIPTION_MAX_LENGTH))
  .trim()
  .optional();

export const bioSchema = z
  .string()
  .max(VALIDATION_CONSTANTS.BIO_MAX_LENGTH, ERROR_MESSAGES.too_long('Bio', VALIDATION_CONSTANTS.BIO_MAX_LENGTH))
  .trim()
  .optional();

export const messageSchema = z
  .string()
  .min(1, ERROR_MESSAGES.required)
  .max(VALIDATION_CONSTANTS.MESSAGE_MAX_LENGTH, ERROR_MESSAGES.too_long('Message', VALIDATION_CONSTANTS.MESSAGE_MAX_LENGTH))
  .trim();

// ===========================
// Pagination Schemas
// ===========================

export const paginationSchema = z.object({
  page: z.coerce
    .number()
    .min(VALIDATION_CONSTANTS.PAGE_MIN, ERROR_MESSAGES.min_value('Page', VALIDATION_CONSTANTS.PAGE_MIN))
    .max(VALIDATION_CONSTANTS.PAGE_MAX, ERROR_MESSAGES.max_value('Page', VALIDATION_CONSTANTS.PAGE_MAX))
    .default(1),
  limit: z.coerce
    .number()
    .min(VALIDATION_CONSTANTS.LIMIT_MIN, ERROR_MESSAGES.min_value('Limit', VALIDATION_CONSTANTS.LIMIT_MIN))
    .max(VALIDATION_CONSTANTS.LIMIT_MAX, ERROR_MESSAGES.max_value('Limit', VALIDATION_CONSTANTS.LIMIT_MAX))
    .default(VALIDATION_CONSTANTS.LIMIT_DEFAULT),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ===========================
// Address Schema
// ===========================

export const addressSchema = z.object({
  street: z.string().min(1, ERROR_MESSAGES.required).max(100),
  city: z.string().min(1, ERROR_MESSAGES.required).max(50),
  state: z.string().min(2).max(50).optional(),
  postalCode: z.string().min(3).max(20),
  country: z.string().length(2, 'Country code must be 2 characters').toUpperCase(),
});

// ===========================
// Helper Functions
// ===========================

/**
 * Create an optional version of a schema
 */
export function optional<T extends z.ZodType>(schema: T) {
  return schema.optional().or(z.literal('').transform(() => undefined));
}

/**
 * Create a nullable version of a schema
 */
export function nullable<T extends z.ZodType>(schema: T) {
  return schema.nullable();
}

/**
 * Create an array schema with min/max constraints
 */
export function arraySchema<T extends z.ZodType>(
  itemSchema: T,
  options?: { min?: number; max?: number; unique?: boolean }
) {
  let schema = z.array(itemSchema);
  
  if (options?.min !== undefined) {
    schema = schema.min(options.min, `Must have at least ${options.min} items`);
  }
  
  if (options?.max !== undefined) {
    schema = schema.max(options.max, `Must not exceed ${options.max} items`);
  }
  
  if (options?.unique) {
    schema = schema.refine(
      (items) => new Set(items).size === items.length,
      { message: 'Items must be unique' }
    );
  }
  
  return schema;
}

/**
 * Create an enum schema from an object's values
 */
export function enumFromObject<T extends Record<string, string>>(
  obj: T,
  errorMessage?: string
): z.ZodEnum<[T[keyof T], ...T[keyof T][]]> {
  const values = Object.values(obj) as [T[keyof T], ...T[keyof T][]];
  return z.enum(values, {
    errorMap: () => ({ message: errorMessage || ERROR_MESSAGES.invalid_enum('Value', values) }),
  });
}

/**
 * Password strength calculator
 */
export function getPasswordStrength(password: string): {
  score: number;
  strength: 'weak' | 'medium' | 'strong' | 'very-strong';
  feedback: string[];
} {
  let score = 0;
  const feedback: string[] = [];

  if (password.length >= VALIDATION_CONSTANTS.PASSWORD_MIN_LENGTH) score++;
  else feedback.push(`At least ${VALIDATION_CONSTANTS.PASSWORD_MIN_LENGTH} characters`);

  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  else feedback.push('Lowercase letter');

  if (/[A-Z]/.test(password)) score++;
  else feedback.push('Uppercase letter');

  if (/[0-9]/.test(password)) score++;
  else feedback.push('Number');

  if (/[^A-Za-z0-9]/.test(password)) score++;
  else feedback.push('Special character');

  const strength = 
    score <= 2 ? 'weak' :
    score <= 4 ? 'medium' :
    score <= 5 ? 'strong' : 'very-strong';

  return { score, strength, feedback };
}

// ===========================
// Export Types
// ===========================

export type ValidationConstants = typeof VALIDATION_CONSTANTS;
export type ErrorMessages = typeof ERROR_MESSAGES;

// Export all schemas for convenience
export default {
  // Basic schemas
  email: emailSchema,
  password: strongPasswordSchema,
  simplePassword: simplePasswordSchema,
  username: usernameSchema,
  phone: phoneSchema,
  url: urlSchema,
  date: dateSchema,
  dateOnly: dateOnlySchema,
  futureDate: futureDateSchema,
  pastDate: pastDateSchema,
  
  // Field schemas
  id: idSchema,
  slug: slugSchema,
  color: colorSchema,
  currency: currencySchema,
  name: nameSchema,
  title: titleSchema,
  description: descriptionSchema,
  bio: bioSchema,
  message: messageSchema,
  
  // Complex schemas
  file: fileSchema,
  imageFile: imageFileSchema,
  documentFile: documentFileSchema,
  address: addressSchema,
  pagination: paginationSchema,
  
  // Helper functions
  optional,
  nullable,
  arraySchema,
  enumFromObject,
  getPasswordStrength,
  
  // Constants
  VALIDATION_CONSTANTS,
  ERROR_MESSAGES,
};