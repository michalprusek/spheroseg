/**
 * Unified API Response Module
 * 
 * This module exports all types, handlers, and schemas needed for
 * standardized API communication across the application.
 */

// Export all types
export * from './response.types';

// Export the response handler
export { UnifiedResponseHandler } from './responseHandler';

// Export all schemas
export * from './schemas';

// Export entity schemas
export * from './entitySchemas';

// Re-export commonly used items for convenience
export { UnifiedResponseHandler as ResponseHandler } from './responseHandler';
export { 
  ApiResponseSchema,
  ApiErrorResponseSchema,
  createPaginatedSchema,
} from './schemas';