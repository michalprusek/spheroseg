import { z } from 'zod';

/**
 * Common validation schemas for API responses
 * 
 * These schemas can be used with the UnifiedResponseHandler to validate
 * API responses and ensure type safety.
 */

// Base schemas
export const ValidationErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
  code: z.string().optional(),
});

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.any().optional(),
  timestamp: z.string().optional(),
  path: z.string().optional(),
});

export const ResponseMetadataSchema = z.object({
  timestamp: z.string(),
  duration: z.number().optional(),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    totalPages: z.number(),
    totalItems: z.number(),
  }).optional(),
  version: z.string().optional(),
});

// Generic API response schemas
export const ApiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    success: z.literal(true),
    message: z.string().optional(),
    metadata: ResponseMetadataSchema.optional(),
  });

export const ApiErrorResponseSchema = z.object({
  data: z.null(),
  success: z.literal(false),
  message: z.string(),
  errors: z.array(ValidationErrorSchema).optional(),
  error: ApiErrorSchema.optional(),
  metadata: ResponseMetadataSchema.optional(),
});

// Common data schemas
export const IdSchema = z.string();

export const TimestampSchema = z.string();

export const EmailSchema = z.string();

export const PaginationParamsSchema = z.object({
  page: z.number(),
  pageSize: z.number(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']),
});

// Entity schemas that can be reused
export const BaseEntitySchema = z.object({
  id: IdSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

// File upload schemas
export const FileUploadResponseSchema = z.object({
  id: IdSchema,
  filename: z.string(),
  originalName: z.string(),
  mimetype: z.string(),
  size: z.number(),
  url: z.string(),
  createdAt: TimestampSchema,
});

// Success message schema
export const SuccessMessageSchema = z.object({
  message: z.string(),
});

// Batch operation schemas
export const BatchOperationResultSchema = z.object({
  successful: z.number(),
  failed: z.number(),
  errors: z.array(z.object({
    id: z.string(),
    error: z.string(),
  })).optional(),
});

// Helper function to create paginated response schema
export function createPaginatedSchema<T extends z.ZodType>(itemSchema: T) {
  return ApiResponseSchema(z.array(itemSchema)).extend({
    metadata: ResponseMetadataSchema.extend({
      pagination: z.object({
        page: z.number(),
        pageSize: z.number(),
        totalPages: z.number(),
        totalItems: z.number(),
      }),
    }),
  });
}

// Export all schemas for easy access
export const schemas = {
  ValidationErrorSchema,
  ApiErrorSchema,
  ResponseMetadataSchema,
  ApiResponseSchema,
  ApiErrorResponseSchema,
  IdSchema,
  TimestampSchema,
  EmailSchema,
  PaginationParamsSchema,
  BaseEntitySchema,
  FileUploadResponseSchema,
  SuccessMessageSchema,
  BatchOperationResultSchema,
  createPaginatedSchema,
} as const;