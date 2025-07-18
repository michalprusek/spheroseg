import { z, ZodError, ZodType } from 'zod';
import { 
  ApiResponse, 
  ApiErrorResponse, 
  ApiResult, 
  ValidationError,
  ApiError,
  ResponseMetadata 
} from './response.types';

/**
 * Unified Response Handler
 * 
 * This class provides methods to standardize API responses and handle errors consistently
 * across the entire application.
 */
export class UnifiedResponseHandler {
  /**
   * Transform any response into standardized ApiResponse format
   * @param response - Raw response data
   * @param schema - Optional Zod schema for validation
   * @returns Standardized API response
   */
  static transform<T>(
    response: unknown,
    schema?: ZodType<T>
  ): ApiResponse<T> {
    try {
      // If response already has our structure, validate and return
      if (this.isStandardResponse(response)) {
        const data = schema ? schema.parse(response.data) : response.data as T;
        return {
          success: true,
          data,
          message: response.message,
          metadata: this.generateMetadata(response.metadata),
        };
      }

      // Transform non-standard response
      const data = schema ? schema.parse(response) : response as T;
      return {
        success: true,
        data,
        metadata: this.generateMetadata(),
      };
    } catch (error) {
      if (error instanceof ZodError) {
        throw this.createValidationError(error);
      }
      throw error;
    }
  }

  /**
   * Handle errors and transform them into standardized error responses
   * @param error - Any error object
   * @param context - Additional context for the error
   * @returns Standardized error response
   */
  static handleError(
    error: unknown,
    context?: { path?: string; operation?: string }
  ): ApiErrorResponse {
    // Handle Zod validation errors
    if (error instanceof ZodError) {
      return this.createValidationError(error, context);
    }

    // Handle API errors with status codes
    if (this.isHttpError(error)) {
      return this.createHttpError(error, context);
    }

    // Handle standard Error objects
    if (error instanceof Error) {
      return {
        success: false,
        data: null,
        message: error.message || 'An unexpected error occurred',
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message,
          details: {
            name: error.name,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
          },
          path: context?.path,
        },
        metadata: this.generateMetadata(),
      };
    }

    // Handle unknown errors
    return {
      success: false,
      data: null,
      message: 'An unknown error occurred',
      error: {
        code: 'UNKNOWN_ERROR',
        message: String(error),
        path: context?.path,
      },
      metadata: this.generateMetadata(),
    };
  }

  /**
   * Create a successful response
   */
  static success<T>(
    data: T,
    message?: string,
    metadata?: Partial<ResponseMetadata>
  ): ApiResponse<T> {
    return {
      success: true,
      data,
      message,
      metadata: this.generateMetadata(metadata),
    };
  }

  /**
   * Create an error response
   */
  static error(
    message: string,
    code?: string,
    errors?: ValidationError[]
  ): ApiErrorResponse {
    return {
      success: false,
      data: null,
      message,
      errors,
      error: code ? { code, message } : undefined,
      metadata: this.generateMetadata(),
    };
  }

  /**
   * Check if response has standard structure
   */
  private static isStandardResponse(response: unknown): response is ApiResult {
    return (
      typeof response === 'object' &&
      response !== null &&
      'success' in response &&
      'data' in response
    );
  }

  /**
   * Check if error is an HTTP error with status code
   */
  private static isHttpError(
    error: unknown
  ): error is { status: number; message?: string; response?: { data?: unknown } } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      typeof (error as any).status === 'number'
    );
  }

  /**
   * Create validation error response from Zod error
   */
  private static createValidationError(
    zodError: ZodError,
    context?: { path?: string; operation?: string }
  ): ApiErrorResponse {
    const errors: ValidationError[] = zodError.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    }));

    return {
      success: false,
      data: null,
      message: 'Validation failed',
      errors,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: { operation: context?.operation },
        path: context?.path,
      },
      metadata: this.generateMetadata(),
    };
  }

  /**
   * Create HTTP error response
   */
  private static createHttpError(
    error: { status: number; message?: string; response?: { data?: unknown } },
    context?: { path?: string; operation?: string }
  ): ApiErrorResponse {
    const statusMessages: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
    };

    const message = error.message || statusMessages[error.status] || 'Request failed';
    const code = `HTTP_${error.status}`;

    // Extract error details from response if available
    let apiError: ApiError | undefined;
    let validationErrors: ValidationError[] | undefined;

    if (error.response?.data && typeof error.response.data === 'object') {
      const responseData = error.response.data as any;
      if (responseData.errors && Array.isArray(responseData.errors)) {
        validationErrors = responseData.errors;
      }
      if (responseData.error) {
        apiError = responseData.error;
      }
    }

    return {
      success: false,
      data: null,
      message,
      errors: validationErrors,
      error: apiError || {
        code,
        message,
        details: { status: error.status },
        path: context?.path,
      },
      metadata: this.generateMetadata(),
    };
  }

  /**
   * Generate response metadata
   */
  private static generateMetadata(
    partial?: Partial<ResponseMetadata>
  ): ResponseMetadata {
    return {
      timestamp: new Date().toISOString(),
      ...partial,
    };
  }

  /**
   * Create a paginated response
   */
  static paginated<T>(
    data: T[],
    pagination: {
      page: number;
      pageSize: number;
      totalItems: number;
    },
    message?: string
  ): ApiResponse<T[]> {
    const totalPages = Math.ceil(pagination.totalItems / pagination.pageSize);
    
    return {
      success: true,
      data,
      message,
      metadata: {
        timestamp: new Date().toISOString(),
        pagination: {
          page: pagination.page,
          pageSize: pagination.pageSize,
          totalPages,
          totalItems: pagination.totalItems,
        },
      },
    };
  }
}