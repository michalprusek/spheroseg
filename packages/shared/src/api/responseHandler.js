"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnifiedResponseHandler = void 0;
const zod_1 = require("zod");
/**
 * Unified Response Handler
 *
 * This class provides methods to standardize API responses and handle errors consistently
 * across the entire application.
 */
class UnifiedResponseHandler {
    /**
     * Transform any response into standardized ApiResponse format
     * @param response - Raw response data
     * @param schema - Optional Zod schema for validation
     * @returns Standardized API response
     */
    static transform(response, schema) {
        try {
            // If response already has our structure, validate and return
            if (this.isStandardResponse(response)) {
                const data = schema ? schema.parse(response.data) : response.data;
                const result = {
                    success: true,
                    data,
                    metadata: this.generateMetadata(response.metadata),
                };
                if (response.message !== undefined) {
                    result.message = response.message;
                }
                return result;
            }
            // Transform non-standard response
            const data = schema ? schema.parse(response) : response;
            return {
                success: true,
                data,
                metadata: this.generateMetadata(),
            };
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
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
    static handleError(error, context) {
        // Handle Zod validation errors
        if (error instanceof zod_1.ZodError) {
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
                        ...(process.env['NODE_ENV'] === 'development' && error.stack ? { stack: error.stack } : {}),
                    },
                    ...(context?.path ? { path: context.path } : {}),
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
                ...(context?.path ? { path: context.path } : {}),
            },
            metadata: this.generateMetadata(),
        };
    }
    /**
     * Create a successful response
     */
    static success(data, message, metadata) {
        const result = {
            success: true,
            data,
            metadata: this.generateMetadata(metadata),
        };
        if (message !== undefined) {
            result.message = message;
        }
        return result;
    }
    /**
     * Create an error response
     */
    static error(message, code, errors) {
        const result = {
            success: false,
            data: null,
            message,
            metadata: this.generateMetadata(),
        };
        if (errors !== undefined) {
            result.errors = errors;
        }
        if (code !== undefined) {
            result.error = { code, message };
        }
        return result;
    }
    /**
     * Check if response has standard structure
     */
    static isStandardResponse(response) {
        return (typeof response === 'object' &&
            response !== null &&
            'success' in response &&
            'data' in response);
    }
    /**
     * Check if error is an HTTP error with status code
     */
    static isHttpError(error) {
        return (typeof error === 'object' &&
            error !== null &&
            'status' in error &&
            typeof error.status === 'number');
    }
    /**
     * Create validation error response from Zod error
     */
    static createValidationError(zodError, context) {
        const errors = zodError.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
        }));
        const apiError = {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
        };
        if (context?.operation) {
            apiError.details = { operation: context.operation };
        }
        if (context?.path) {
            apiError.path = context.path;
        }
        return {
            success: false,
            data: null,
            message: 'Validation failed',
            errors,
            error: apiError,
            metadata: this.generateMetadata(),
        };
    }
    /**
     * Create HTTP error response
     */
    static createHttpError(error, context) {
        const statusMessages = {
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
        let apiError;
        let validationErrors;
        if (error.response?.data && typeof error.response.data === 'object') {
            const responseData = error.response.data;
            if (responseData.errors && Array.isArray(responseData.errors)) {
                validationErrors = responseData.errors;
            }
            if (responseData.error) {
                apiError = responseData.error;
            }
        }
        const result = {
            success: false,
            data: null,
            message,
            metadata: this.generateMetadata(),
        };
        if (validationErrors !== undefined) {
            result.errors = validationErrors;
        }
        result.error = apiError || {
            code,
            message,
            details: { status: error.status },
            ...(context?.path ? { path: context.path } : {}),
        };
        return result;
    }
    /**
     * Generate response metadata
     */
    static generateMetadata(partial) {
        return {
            timestamp: new Date().toISOString(),
            ...partial,
        };
    }
    /**
     * Create a paginated response
     */
    static paginated(data, pagination, message) {
        const totalPages = Math.ceil(pagination.totalItems / pagination.pageSize);
        const result = {
            success: true,
            data,
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
        if (message !== undefined) {
            result.message = message;
        }
        return result;
    }
}
exports.UnifiedResponseHandler = UnifiedResponseHandler;
//# sourceMappingURL=responseHandler.js.map