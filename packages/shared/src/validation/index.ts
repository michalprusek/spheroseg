/**
 * Unified Validation Module
 * 
 * Central export point for all validation utilities, schemas, and middleware.
 * This module standardizes form validation across the application using Zod.
 */

// Re-export everything from schemas
export * from './schemas';
import schemas from './schemas';

// Re-export everything from forms
export * from './forms';
import forms from './forms';

// Re-export everything from middleware
export * from './middleware';
import middleware from './middleware';

// Re-export everything from common schemas
export * from './commonSchemas';
import commonSchemas from './commonSchemas';

// Re-export zod for convenience
export { z } from 'zod';
export type { ZodError, ZodIssue, ZodSchema, ZodType } from 'zod';

// Import for internal use
import { safeParse } from './forms';
import { validateRequest, validateBody, validateParams, validateQuery } from './middleware';
import { VALIDATION_CONSTANTS, ERROR_MESSAGES } from './schemas';
import type { ZodType } from 'zod';

// ===========================
// Quick Access Exports
// ===========================

// Most commonly used schemas
export {
  emailSchema,
  strongPasswordSchema,
  simplePasswordSchema,
  usernameSchema,
  nameSchema,
  titleSchema,
  descriptionSchema,
  phoneSchema,
  urlSchema,
  dateSchema,
  idSchema,
  paginationSchema,
  VALIDATION_CONSTANTS,
  ERROR_MESSAGES,
} from './schemas';

// Most commonly used form schemas
export {
  signUpSchema,
  signInSchema,
  createProjectSchema,
  updateProfileSchema,
} from './commonSchemas';

// Most commonly used middleware
export {
  validateRequest,
  validateBody,
  validateParams,
  validateQuery,
} from './middleware';

// Most commonly used utilities
export {
  validate,
  safeParse,
  validateField,
  setServerErrors,
} from './forms';

// ===========================
// Preset Configurations
// ===========================

/**
 * Frontend validation configuration
 */
export const frontendValidation = {
  schemas: schemas,
  forms: forms,
  commonSchemas: commonSchemas,
  
  // Helper for react-hook-form integration
  createResolver: (schema: ZodType<any>) => {
    return async (data: any) => {
      const result = safeParse(schema, data);
      if (result.success) {
        return { values: result.data, errors: {} };
      }
      return {
        values: {},
        errors: result.fieldErrors || {},
      };
    };
  },
};

/**
 * Backend validation configuration
 */
export const backendValidation = {
  schemas: schemas,
  middleware: middleware,
  commonSchemas: commonSchemas,
  
  // Helper for Express route validation
  validate: validateRequest,
  body: validateBody,
  params: validateParams,
  query: validateQuery,
};

// ===========================
// Type Exports
// ===========================

export type {
  ValidationConstants,
  ErrorMessages,
  FormError,
  ValidationResult,
  ValidationSource,
  ValidationOptions,
  ValidationError,
} from './schemas';

export type {
  SignUpFormData,
  SignInFormData,
  CreateProjectFormData,
  UpdateProfileFormData,
  ImageUploadFormData,
  ExportConfigFormData,
} from './commonSchemas';

// ===========================
// Default Export
// ===========================

// Export the imported modules
export { schemas, forms, middleware, commonSchemas };

export default {
  // Core modules
  schemas: schemas,
  forms: forms,
  middleware: middleware,
  commonSchemas: commonSchemas,
  
  // Configurations
  frontend: frontendValidation,
  backend: backendValidation,
  
  // Constants
  VALIDATION_CONSTANTS: VALIDATION_CONSTANTS,
  ERROR_MESSAGES: ERROR_MESSAGES,
} as const;