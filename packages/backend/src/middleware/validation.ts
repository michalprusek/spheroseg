/**
 * Express-validator middleware
 *
 * Provides validation and sanitization of inputs for API endpoints
 */

import { body, param, query, validationResult, ValidationChain } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';

/**
 * Middleware for processing validation results
 */
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((error) => ({
      field: error.param,
      message: error.msg,
      value: error.value,
    }));

    throw new ApiError('Validation failed', 400, formattedErrors);
  }

  next();
};

/**
 * Common validators
 */
export const validators = {
  // Email validation
  email: () =>
    body('email').isEmail().withMessage('Invalid email format').normalizeEmail().toLowerCase(),

  // Password validation
  password: () =>
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain a lowercase letter, uppercase letter, and number'),

  // ID validation (UUID)
  uuid: (field: string = 'id') => param(field).isUUID().withMessage('Invalid ID'),

  // Pagination
  pagination: () => [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive number')
      .toInt(),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
      .toInt(),
  ],

  // General text
  text: (field: string, options: { min?: number; max?: number } = {}) =>
    body(field)
      .trim()
      .notEmpty()
      .withMessage(`${field} is required`)
      .isLength({ min: options.min || 1, max: options.max || 1000 })
      .withMessage(`${field} must be ${options.min || 1}-${options.max || 1000} characters`)
      .escape(),

  // Phone number
  phone: () => body('phone').optional().isMobilePhone('any').withMessage('Invalid phone number'),

  // URL
  url: (field: string = 'url') =>
    body(field)
      .optional()
      .isURL({ protocols: ['http', 'https'], require_protocol: true })
      .withMessage('Invalid URL'),

  // Date
  date: (field: string) =>
    body(field).optional().isISO8601().withMessage('Invalid date format').toDate(),

  // Boolean
  boolean: (field: string) =>
    body(field).optional().isBoolean().withMessage(`${field} must be true or false`).toBoolean(),

  // Number
  number: (field: string, options: { min?: number; max?: number } = {}) =>
    body(field)
      .isNumeric()
      .withMessage(`${field} must be a number`)
      .toFloat()
      .custom((value) => {
        if (options.min !== undefined && value < options.min) {
          throw new Error(`${field} must be at least ${options.min}`);
        }
        if (options.max !== undefined && value > options.max) {
          throw new Error(`${field} must be at most ${options.max}`);
        }
        return true;
      }),

  // Array
  array: (field: string, itemValidator?: ValidationChain) =>
    body(field)
      .isArray()
      .withMessage(`${field} must be an array`)
      .custom((items, { req }) => {
        if (itemValidator) {
          // Validate each item in the array
          items.forEach((item: any, index: number) => {
            req.body[`${field}[${index}]`] = item;
          });
        }
        return true;
      }),

  // JSON
  json: (field: string) =>
    body(field).optional().isJSON().withMessage(`${field} must be valid JSON`),

  // File upload
  file: (field: string, options: { mimeTypes?: string[]; maxSize?: number } = {}) =>
    body(field).custom((value, { req }) => {
      if (!req.file && !req.files) {
        throw new Error('File is required');
      }

      const file = req.file || (req.files as any)[field];

      if (options.mimeTypes && !options.mimeTypes.includes(file.mimetype)) {
        throw new Error(`Invalid file type. Allowed: ${options.mimeTypes.join(', ')}`);
      }

      if (options.maxSize && file.size > options.maxSize) {
        throw new Error(`File is too large. Maximum: ${options.maxSize / 1024 / 1024}MB`);
      }

      return true;
    }),
};

/**
 * Validation rules for specific endpoints
 */
export const validationRules = {
  // User registration
  userRegistration: [
    validators.email(),
    validators.password(),
    validators.text('name', { min: 2, max: 100 }),
    validators.phone(),
    handleValidationErrors,
  ],

  // User login
  userLogin: [
    validators.email(),
    body('password').notEmpty().withMessage('Password is required'),
    handleValidationErrors,
  ],

  // Update profile
  updateProfile: [
    validators.text('name', { min: 2, max: 100 }).optional(),
    validators.phone(),
    validators.url('avatar'),
    handleValidationErrors,
  ],

  // Create project
  createProject: [
    validators.text('name', { min: 3, max: 200 }),
    validators.text('description', { min: 10, max: 1000 }).optional(),
    validators.boolean('isPublic'),
    handleValidationErrors,
  ],

  // Upload image
  uploadImage: [
    validators.file('image', {
      mimeTypes: ['image/jpeg', 'image/png', 'image/tiff'],
      maxSize: 50 * 1024 * 1024, // 50MB
    }),
    validators.text('description', { max: 500 }).optional(),
    handleValidationErrors,
  ],

  // Segmentation request
  segmentationRequest: [
    validators.uuid('imageId'),
    validators.json('parameters').optional(),
    handleValidationErrors,
  ],

  // Pagination
  pagination: [...validators.pagination(), handleValidationErrors],
};

/**
 * Custom validators
 */
export const customValidators = {
  // Check email uniqueness
  uniqueEmail: () =>
    body('email').custom(async (_email) => {
      // TODO: Implement database check
      // const exists = await userService.emailExists(_email);
      // if (exists) {
      //   throw new Error('Email is already registered');
      // }
      return true;
    }),

  // Check password strength
  strongPassword: () =>
    body('password').custom((password) => {
      const strength = calculatePasswordStrength(password);
      if (strength < 3) {
        throw new Error('Password is too weak');
      }
      return true;
    }),

  // Check CSRF token
  csrfToken: () =>
    body('_csrf')
      .notEmpty()
      .withMessage('CSRF token is required')
      .custom((_token, { req: _req }) => {
        // TODO: Implement CSRF validation
        // if (!validateCsrfToken(_req, _token)) {
        //   throw new Error('Invalid CSRF token');
        // }
        return true;
      }),
};

/**
 * Helper function for calculating password strength
 */
function calculatePasswordStrength(password: string): number {
  let strength = 0;

  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  if (/[a-z]/.test(password)) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^a-zA-Z0-9]/.test(password)) strength++;

  return strength;
}

/**
 * Sanitization functions
 */
export const sanitizers = {
  // HTML sanitization
  html: (field: string) =>
    body(field).customSanitizer((value) => {
      // Remove dangerous HTML tags
      return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
        .replace(/on\w+\s*=\s*'[^']*'/gi, '');
    }),

  // SQL sanitization
  sql: (field: string) =>
    body(field).customSanitizer((value) => {
      // Basic protection against SQL injection
      return value.replace(/'/g, "''").replace(/;/g, '').replace(/--/g, '');
    }),

  // Filename sanitization
  filename: (field: string) =>
    body(field).customSanitizer((value) => {
      // Remove dangerous characters from filenames
      return value
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/\.{2,}/g, '.')
        .substring(0, 255);
    }),
};
