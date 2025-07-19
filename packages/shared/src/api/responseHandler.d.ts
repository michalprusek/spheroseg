import { ZodType } from 'zod';
import { ApiResponse, ApiErrorResponse, ValidationError, ResponseMetadata } from './response.types';
/**
 * Unified Response Handler
 *
 * This class provides methods to standardize API responses and handle errors consistently
 * across the entire application.
 */
export declare class UnifiedResponseHandler {
    /**
     * Transform any response into standardized ApiResponse format
     * @param response - Raw response data
     * @param schema - Optional Zod schema for validation
     * @returns Standardized API response
     */
    static transform<T>(response: unknown, schema?: ZodType<T>): ApiResponse<T>;
    /**
     * Handle errors and transform them into standardized error responses
     * @param error - Any error object
     * @param context - Additional context for the error
     * @returns Standardized error response
     */
    static handleError(error: unknown, context?: {
        path?: string;
        operation?: string;
    }): ApiErrorResponse;
    /**
     * Create a successful response
     */
    static success<T>(data: T, message?: string, metadata?: Partial<ResponseMetadata>): ApiResponse<T>;
    /**
     * Create an error response
     */
    static error(message: string, code?: string, errors?: ValidationError[]): ApiErrorResponse;
    /**
     * Check if response has standard structure
     */
    private static isStandardResponse;
    /**
     * Check if error is an HTTP error with status code
     */
    private static isHttpError;
    /**
     * Create validation error response from Zod error
     */
    private static createValidationError;
    /**
     * Create HTTP error response
     */
    private static createHttpError;
    /**
     * Generate response metadata
     */
    private static generateMetadata;
    /**
     * Create a paginated response
     */
    static paginated<T>(data: T[], pagination: {
        page: number;
        pageSize: number;
        totalItems: number;
    }, message?: string): ApiResponse<T[]>;
}
//# sourceMappingURL=responseHandler.d.ts.map