/**
 * Express-validator middleware
 *
 * Poskytuje validaci a sanitizaci vstupů pro API endpointy
 */

import { body, param, query, validationResult, ValidationChain } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';

/**
 * Middleware pro zpracování výsledků validace
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
 * Společné validátory
 */
export const validators = {
  // Email validace
  email: () =>
    body('email').isEmail().withMessage('Neplatný formát emailu').normalizeEmail().toLowerCase(),

  // Heslo validace
  password: () =>
    body('password')
      .isLength({ min: 8 })
      .withMessage('Heslo musí mít alespoň 8 znaků')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Heslo musí obsahovat malé písmeno, velké písmeno a číslo'),

  // ID validace (UUID)
  uuid: (field: string = 'id') => param(field).isUUID().withMessage('Neplatné ID'),

  // Stránkování
  pagination: () => [
    query('page').optional().isInt({ min: 1 }).withMessage('Stránka musí být kladné číslo').toInt(),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit musí být mezi 1 a 100')
      .toInt(),
  ],

  // Obecný text
  text: (field: string, options: { min?: number; max?: number } = {}) =>
    body(field)
      .trim()
      .notEmpty()
      .withMessage(`${field} je povinné pole`)
      .isLength({ min: options.min || 1, max: options.max || 1000 })
      .withMessage(`${field} musí mít ${options.min || 1}-${options.max || 1000} znaků`)
      .escape(),

  // Telefonní číslo
  phone: () =>
    body('phone').optional().isMobilePhone('any').withMessage('Neplatné telefonní číslo'),

  // URL
  url: (field: string = 'url') =>
    body(field)
      .optional()
      .isURL({ protocols: ['http', 'https'], require_protocol: true })
      .withMessage('Neplatná URL adresa'),

  // Datum
  date: (field: string) =>
    body(field).optional().isISO8601().withMessage('Neplatný formát data').toDate(),

  // Boolean
  boolean: (field: string) =>
    body(field).optional().isBoolean().withMessage(`${field} musí být true nebo false`).toBoolean(),

  // Číslo
  number: (field: string, options: { min?: number; max?: number } = {}) =>
    body(field)
      .isNumeric()
      .withMessage(`${field} musí být číslo`)
      .toFloat()
      .custom((value) => {
        if (options.min !== undefined && value < options.min) {
          throw new Error(`${field} musí být alespoň ${options.min}`);
        }
        if (options.max !== undefined && value > options.max) {
          throw new Error(`${field} musí být maximálně ${options.max}`);
        }
        return true;
      }),

  // Array
  array: (field: string, itemValidator?: ValidationChain) =>
    body(field)
      .isArray()
      .withMessage(`${field} musí být pole`)
      .custom((items, { req }) => {
        if (itemValidator) {
          // Validace každé položky v poli
          items.forEach((item: any, index: number) => {
            req.body[`${field}[${index}]`] = item;
          });
        }
        return true;
      }),

  // JSON
  json: (field: string) =>
    body(field).optional().isJSON().withMessage(`${field} musí být platný JSON`),

  // File upload
  file: (field: string, options: { mimeTypes?: string[]; maxSize?: number } = {}) =>
    body(field).custom((value, { req }) => {
      if (!req.file && !req.files) {
        throw new Error('Soubor je povinný');
      }

      const file = req.file || (req.files as any)[field];

      if (options.mimeTypes && !options.mimeTypes.includes(file.mimetype)) {
        throw new Error(`Nepovolený typ souboru. Povolené: ${options.mimeTypes.join(', ')}`);
      }

      if (options.maxSize && file.size > options.maxSize) {
        throw new Error(`Soubor je příliš velký. Maximum: ${options.maxSize / 1024 / 1024}MB`);
      }

      return true;
    }),
};

/**
 * Validační pravidla pro specifické endpointy
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
    body('password').notEmpty().withMessage('Heslo je povinné'),
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
  // Kontrola unikátnosti emailu
  uniqueEmail: () =>
    body('email').custom(async (email) => {
      // TODO: Implementovat kontrolu v databázi
      // const exists = await userService.emailExists(email);
      // if (exists) {
      //   throw new Error('Email už je registrovaný');
      // }
      return true;
    }),

  // Kontrola síly hesla
  strongPassword: () =>
    body('password').custom((password) => {
      const strength = calculatePasswordStrength(password);
      if (strength < 3) {
        throw new Error('Heslo je příliš slabé');
      }
      return true;
    }),

  // Kontrola CSRF tokenu
  csrfToken: () =>
    body('_csrf')
      .notEmpty()
      .withMessage('CSRF token je povinný')
      .custom((token, { req }) => {
        // TODO: Implementovat CSRF validaci
        // if (!validateCsrfToken(req, token)) {
        //   throw new Error('Neplatný CSRF token');
        // }
        return true;
      }),
};

/**
 * Helper funkce pro výpočet síly hesla
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
 * Sanitizace funkcí
 */
export const sanitizers = {
  // HTML sanitizace
  html: (field: string) =>
    body(field).customSanitizer((value) => {
      // Odstranění nebezpečných HTML tagů
      return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
        .replace(/on\w+\s*=\s*'[^']*'/gi, '');
    }),

  // SQL sanitizace
  sql: (field: string) =>
    body(field).customSanitizer((value) => {
      // Základní ochrana proti SQL injection
      return value.replace(/'/g, "''").replace(/;/g, '').replace(/--/g, '');
    }),

  // Filename sanitizace
  filename: (field: string) =>
    body(field).customSanitizer((value) => {
      // Odstranění nebezpečných znaků z názvů souborů
      return value
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/\.{2,}/g, '.')
        .substring(0, 255);
    }),
};
