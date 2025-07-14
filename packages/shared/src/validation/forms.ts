/**
 * Form Validation Utilities
 * 
 * This module provides utilities for integrating Zod schemas with
 * react-hook-form and backend validation middleware.
 */

import { z } from 'zod';
import type { UseFormReturn, FieldErrors, Path, PathValue } from 'react-hook-form';

// ===========================
// Type Utilities
// ===========================

/**
 * Extract the shape type from a Zod schema
 */
export type InferSchemaType<T> = T extends z.ZodType<infer U> ? U : never;

/**
 * Get form field type from schema
 */
export type FormFieldType<
  TSchema extends z.ZodType,
  TPath extends Path<InferSchemaType<TSchema>>
> = PathValue<InferSchemaType<TSchema>, TPath>;

/**
 * Form error type
 */
export interface FormError {
  field: string;
  message: string;
  code?: string;
}

/**
 * Validation result type
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: FormError[];
}

// ===========================
// Validation Utilities
// ===========================

/**
 * Validate data against a schema
 */
export function validate<T extends z.ZodType>(
  schema: T,
  data: unknown
): ValidationResult<z.infer<T>> {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: FormError[] = error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      }));
      return { success: false, errors };
    }
    throw error;
  }
}

/**
 * Safe parse with detailed error info
 */
export function safeParse<T extends z.ZodType>(
  schema: T,
  data: unknown
): { 
  success: boolean; 
  data?: z.infer<T>; 
  error?: z.ZodError;
  fieldErrors?: Record<string, string[]>;
} {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const fieldErrors: Record<string, string[]> = {};
  result.error.errors.forEach((err) => {
    const field = err.path.join('.');
    if (!fieldErrors[field]) {
      fieldErrors[field] = [];
    }
    fieldErrors[field].push(err.message);
  });
  
  return { 
    success: false, 
    error: result.error,
    fieldErrors,
  };
}

/**
 * Validate a single field
 */
export function validateField<T extends z.ZodType>(
  schema: T,
  fieldName: string,
  value: unknown
): { valid: boolean; error?: string } {
  try {
    // Extract field schema if nested
    const fieldPath = fieldName.split('.');
    let fieldSchema: z.ZodType = schema;
    
    for (const segment of fieldPath) {
      if (fieldSchema instanceof z.ZodObject) {
        fieldSchema = fieldSchema.shape[segment];
      } else if (fieldSchema instanceof z.ZodArray) {
        fieldSchema = fieldSchema.element;
      }
    }
    
    fieldSchema.parse(value);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, error: error.errors[0]?.message };
    }
    return { valid: false, error: 'Validation failed' };
  }
}

// ===========================
// Form Integration Helpers
// ===========================

/**
 * Convert Zod errors to react-hook-form errors
 */
export function zodErrorsToFieldErrors<T extends Record<string, any>>(
  zodError: z.ZodError
): FieldErrors<T> {
  const fieldErrors: FieldErrors<T> = {};
  
  zodError.errors.forEach((error) => {
    const path = error.path.join('.') as Path<T>;
    const current = fieldErrors[path];
    
    if (!current) {
      fieldErrors[path] = {
        type: error.code,
        message: error.message,
      };
    }
  });
  
  return fieldErrors;
}

/**
 * Set server errors on form
 */
export function setServerErrors<T extends Record<string, any>>(
  form: UseFormReturn<T>,
  errors: FormError[]
): void {
  errors.forEach((error) => {
    const path = error.field as Path<T>;
    form.setError(path, {
      type: 'server',
      message: error.message,
    });
  });
}

/**
 * Clear specific field errors
 */
export function clearFieldErrors<T extends Record<string, any>>(
  form: UseFormReturn<T>,
  fields: Path<T>[]
): void {
  fields.forEach((field) => {
    form.clearErrors(field);
  });
}

// ===========================
// Schema Composition Helpers
// ===========================

/**
 * Merge multiple schemas
 */
export function mergeSchemas<T extends z.ZodRawShape>(
  ...schemas: z.ZodObject<any>[]
): z.ZodObject<T> {
  let merged = z.object({});
  
  for (const schema of schemas) {
    merged = merged.merge(schema);
  }
  
  return merged as z.ZodObject<T>;
}

/**
 * Pick fields from schema
 */
export function pickSchema<
  T extends z.ZodObject<any>,
  K extends keyof T['shape']
>(
  schema: T,
  keys: K[]
): z.ZodObject<Pick<T['shape'], K>> {
  const shape: any = {};
  
  keys.forEach((key) => {
    if (schema.shape[key]) {
      shape[key] = schema.shape[key];
    }
  });
  
  return z.object(shape);
}

/**
 * Omit fields from schema
 */
export function omitSchema<
  T extends z.ZodObject<any>,
  K extends keyof T['shape']
>(
  schema: T,
  keys: K[]
): z.ZodObject<Omit<T['shape'], K>> {
  const shape: any = {};
  
  Object.keys(schema.shape).forEach((key) => {
    if (!keys.includes(key as K)) {
      shape[key] = schema.shape[key];
    }
  });
  
  return z.object(shape);
}

/**
 * Make all fields optional
 */
export function partialSchema<T extends z.ZodObject<any>>(
  schema: T
): z.ZodObject<{ [K in keyof T['shape']]: z.ZodOptional<T['shape'][K]> }> {
  return schema.partial();
}

/**
 * Make specific fields optional
 */
export function partialFields<
  T extends z.ZodObject<any>,
  K extends keyof T['shape']
>(
  schema: T,
  keys: K[]
): z.ZodObject<
  Omit<T['shape'], K> & { [P in K]: z.ZodOptional<T['shape'][P]> }
> {
  const shape: any = { ...schema.shape };
  
  keys.forEach((key) => {
    if (shape[key]) {
      shape[key] = shape[key].optional();
    }
  });
  
  return z.object(shape);
}

// ===========================
// Async Validation Helpers
// ===========================

/**
 * Debounced validation
 */
export function createDebouncedValidator<T extends z.ZodType>(
  schema: T,
  delay: number = 300
): (value: unknown) => Promise<ValidationResult<z.infer<T>>> {
  let timeoutId: NodeJS.Timeout;
  
  return (value: unknown) => {
    return new Promise((resolve) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        resolve(validate(schema, value));
      }, delay);
    });
  };
}

/**
 * Async field validator
 */
export async function validateAsync<T>(
  validator: (value: T) => Promise<boolean | string>,
  value: T
): Promise<{ valid: boolean; error?: string }> {
  try {
    const result = await validator(value);
    if (typeof result === 'string') {
      return { valid: false, error: result };
    }
    return { valid: result };
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Validation failed' 
    };
  }
}

// ===========================
// Conditional Validation
// ===========================

/**
 * Create conditional schema based on another field
 */
export function conditionalSchema<T extends z.ZodType>(
  condition: (data: any) => boolean,
  trueSchema: T,
  falseSchema?: T
): z.ZodType {
  return z.custom((data) => {
    if (condition(data)) {
      return trueSchema.parse(data);
    }
    return falseSchema ? falseSchema.parse(data) : data;
  });
}

/**
 * Required if another field has value
 */
export function requiredIf<T extends z.ZodType>(
  schema: T,
  conditionField: string,
  conditionValue?: any
): z.ZodType {
  return z.custom((data, ctx) => {
    const rootData = ctx.path.length > 0 ? ctx.parent : data;
    const fieldValue = rootData?.[conditionField];
    
    const isRequired = conditionValue !== undefined
      ? fieldValue === conditionValue
      : Boolean(fieldValue);
    
    if (isRequired && !data) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'This field is required',
      });
      return z.NEVER;
    }
    
    return schema.parse(data);
  });
}

// ===========================
// Transform Utilities
// ===========================

/**
 * Transform empty strings to undefined
 */
export function emptyStringToUndefined<T extends z.ZodType>(schema: T) {
  return z.preprocess(
    (val) => (val === '' ? undefined : val),
    schema
  );
}

/**
 * Trim whitespace from strings
 */
export function trimString<T extends z.ZodString>(schema: T) {
  return schema.transform((val) => val.trim());
}

/**
 * Normalize whitespace in strings
 */
export function normalizeWhitespace<T extends z.ZodString>(schema: T) {
  return schema.transform((val) => val.trim().replace(/\s+/g, ' '));
}

// ===========================
// Export Utilities
// ===========================

export default {
  // Core validation
  validate,
  safeParse,
  validateField,
  
  // Form integration
  zodErrorsToFieldErrors,
  setServerErrors,
  clearFieldErrors,
  
  // Schema composition
  mergeSchemas,
  pickSchema,
  omitSchema,
  partialSchema,
  partialFields,
  
  // Async validation
  createDebouncedValidator,
  validateAsync,
  
  // Conditional validation
  conditionalSchema,
  requiredIf,
  
  // Transforms
  emptyStringToUndefined,
  trimString,
  normalizeWhitespace,
};