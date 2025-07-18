/**
 * Unified API Response Types
 * 
 * This module provides standardized types for all API responses across the application.
 * All API responses should conform to these types to ensure consistency.
 */

/**
 * Validation error structure for field-specific errors
 */
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

/**
 * API error structure for general errors
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp?: string;
  path?: string;
}

/**
 * Response metadata for pagination, timing, etc.
 */
export interface ResponseMetadata {
  timestamp: string;
  duration?: number;
  pagination?: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
  };
  version?: string;
}

/**
 * Standard API response wrapper for successful responses
 */
export interface ApiResponse<T = unknown> {
  data: T;
  success: true;
  message?: string;
  metadata?: ResponseMetadata;
}

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  data: null;
  success: false;
  message: string;
  errors?: ValidationError[];
  error?: ApiError;
  metadata?: ResponseMetadata;
}

/**
 * Union type for all API responses
 */
export type ApiResult<T = unknown> = ApiResponse<T> | ApiErrorResponse;

/**
 * Type guard to check if response is successful
 */
export function isApiSuccess<T>(response: ApiResult<T>): response is ApiResponse<T> {
  return response.success === true;
}

/**
 * Type guard to check if response is an error
 */
export function isApiError<T>(response: ApiResult<T>): response is ApiErrorResponse {
  return response.success === false;
}

/**
 * Pagination request parameters
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Common query parameters
 */
export interface QueryParams extends PaginationParams {
  search?: string;
  filters?: Record<string, unknown>;
}