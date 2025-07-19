"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const zod_1 = require("zod");
const responseHandler_1 = require("../responseHandler");
(0, vitest_1.describe)('UnifiedResponseHandler', () => {
    (0, vitest_1.describe)('transform', () => {
        (0, vitest_1.it)('should transform raw data into standardized response', () => {
            const rawData = { id: '123', name: 'Test' };
            const result = responseHandler_1.UnifiedResponseHandler.transform(rawData);
            (0, vitest_1.expect)(result).toEqual({
                success: true,
                data: rawData,
                metadata: vitest_1.expect.objectContaining({
                    timestamp: vitest_1.expect.any(String),
                }),
            });
        });
        (0, vitest_1.it)('should validate data with Zod schema', () => {
            const schema = zod_1.z.object({
                id: zod_1.z.string(),
                name: zod_1.z.string(),
            });
            const rawData = { id: '123', name: 'Test' };
            const result = responseHandler_1.UnifiedResponseHandler.transform(rawData, schema);
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.data).toEqual(rawData);
        });
        (0, vitest_1.it)('should throw validation error for invalid data', () => {
            const schema = zod_1.z.object({
                id: zod_1.z.string(),
                name: zod_1.z.string(),
            });
            const invalidData = { id: 123, name: 'Test' }; // id should be string
            (0, vitest_1.expect)(() => {
                responseHandler_1.UnifiedResponseHandler.transform(invalidData, schema);
            }).toThrow();
        });
        (0, vitest_1.it)('should handle already standardized responses', () => {
            const standardResponse = {
                success: true,
                data: { id: '123' },
                message: 'Test message',
            };
            const result = responseHandler_1.UnifiedResponseHandler.transform(standardResponse);
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.data).toEqual({ id: '123' });
            (0, vitest_1.expect)(result.message).toBe('Test message');
        });
    });
    (0, vitest_1.describe)('handleError', () => {
        (0, vitest_1.it)('should handle ZodError', () => {
            const zodError = new zod_1.ZodError([
                {
                    code: 'invalid_type',
                    expected: 'string',
                    received: 'number',
                    path: ['id'],
                    message: 'Expected string, received number',
                },
            ]);
            const result = responseHandler_1.UnifiedResponseHandler.handleError(zodError);
            (0, vitest_1.expect)(result.success).toBe(false);
            (0, vitest_1.expect)(result.data).toBeNull();
            (0, vitest_1.expect)(result.message).toBe('Validation failed');
            (0, vitest_1.expect)(result.errors).toEqual([
                {
                    field: 'id',
                    message: 'Expected string, received number',
                    code: 'invalid_type',
                },
            ]);
        });
        (0, vitest_1.it)('should handle standard Error', () => {
            const error = new Error('Something went wrong');
            const result = responseHandler_1.UnifiedResponseHandler.handleError(error);
            (0, vitest_1.expect)(result.success).toBe(false);
            (0, vitest_1.expect)(result.data).toBeNull();
            (0, vitest_1.expect)(result.message).toBe('Something went wrong');
            (0, vitest_1.expect)(result.error).toEqual({
                code: 'INTERNAL_ERROR',
                message: 'Something went wrong',
                details: vitest_1.expect.objectContaining({
                    name: 'Error',
                }),
            });
        });
        (0, vitest_1.it)('should handle HTTP errors', () => {
            const httpError = {
                status: 404,
                message: 'Resource not found',
            };
            const result = responseHandler_1.UnifiedResponseHandler.handleError(httpError);
            (0, vitest_1.expect)(result.success).toBe(false);
            (0, vitest_1.expect)(result.message).toBe('Resource not found');
            (0, vitest_1.expect)(result.error).toEqual({
                code: 'HTTP_404',
                message: 'Resource not found',
                details: { status: 404 },
            });
        });
        (0, vitest_1.it)('should handle unknown errors', () => {
            const unknownError = 'Something unexpected';
            const result = responseHandler_1.UnifiedResponseHandler.handleError(unknownError);
            (0, vitest_1.expect)(result.success).toBe(false);
            (0, vitest_1.expect)(result.message).toBe('An unknown error occurred');
            (0, vitest_1.expect)(result.error).toEqual({
                code: 'UNKNOWN_ERROR',
                message: 'Something unexpected',
            });
        });
        (0, vitest_1.it)('should include context in error response', () => {
            const error = new Error('Test error');
            const context = { path: '/api/test', operation: 'GET /api/test' };
            const result = responseHandler_1.UnifiedResponseHandler.handleError(error, context);
            (0, vitest_1.expect)(result.error?.path).toBe('/api/test');
        });
    });
    (0, vitest_1.describe)('success', () => {
        (0, vitest_1.it)('should create a success response', () => {
            const data = { id: '123', name: 'Test' };
            const result = responseHandler_1.UnifiedResponseHandler.success(data, 'Operation successful');
            (0, vitest_1.expect)(result).toEqual({
                success: true,
                data,
                message: 'Operation successful',
                metadata: vitest_1.expect.objectContaining({
                    timestamp: vitest_1.expect.any(String),
                }),
            });
        });
        (0, vitest_1.it)('should include custom metadata', () => {
            const data = { id: '123' };
            const metadata = { version: '1.0.0' };
            const result = responseHandler_1.UnifiedResponseHandler.success(data, undefined, metadata);
            (0, vitest_1.expect)(result.metadata).toEqual(vitest_1.expect.objectContaining({
                timestamp: vitest_1.expect.any(String),
                version: '1.0.0',
            }));
        });
    });
    (0, vitest_1.describe)('error', () => {
        (0, vitest_1.it)('should create an error response', () => {
            const result = responseHandler_1.UnifiedResponseHandler.error('Validation failed', 'VALIDATION_ERROR');
            (0, vitest_1.expect)(result).toEqual({
                success: false,
                data: null,
                message: 'Validation failed',
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Validation failed',
                },
                metadata: vitest_1.expect.objectContaining({
                    timestamp: vitest_1.expect.any(String),
                }),
            });
        });
        (0, vitest_1.it)('should include validation errors', () => {
            const validationErrors = [
                { field: 'email', message: 'Invalid email', code: 'invalid_email' },
            ];
            const result = responseHandler_1.UnifiedResponseHandler.error('Validation failed', 'VALIDATION_ERROR', validationErrors);
            (0, vitest_1.expect)(result.errors).toEqual(validationErrors);
        });
    });
    (0, vitest_1.describe)('paginated', () => {
        (0, vitest_1.it)('should create a paginated response', () => {
            const data = [
                { id: '1', name: 'Item 1' },
                { id: '2', name: 'Item 2' },
            ];
            const pagination = {
                page: 1,
                pageSize: 10,
                totalItems: 2,
            };
            const result = responseHandler_1.UnifiedResponseHandler.paginated(data, pagination);
            (0, vitest_1.expect)(result).toEqual({
                success: true,
                data,
                metadata: vitest_1.expect.objectContaining({
                    timestamp: vitest_1.expect.any(String),
                    pagination: {
                        page: 1,
                        pageSize: 10,
                        totalPages: 1,
                        totalItems: 2,
                    },
                }),
            });
        });
        (0, vitest_1.it)('should calculate total pages correctly', () => {
            const data = [];
            const pagination = {
                page: 2,
                pageSize: 10,
                totalItems: 25,
            };
            const result = responseHandler_1.UnifiedResponseHandler.paginated(data, pagination);
            (0, vitest_1.expect)(result.metadata?.pagination?.totalPages).toBe(3);
        });
        (0, vitest_1.it)('should include message in paginated response', () => {
            const data = [];
            const pagination = {
                page: 1,
                pageSize: 10,
                totalItems: 0,
            };
            const result = responseHandler_1.UnifiedResponseHandler.paginated(data, pagination, 'No items found');
            (0, vitest_1.expect)(result.message).toBe('No items found');
        });
    });
    (0, vitest_1.describe)('Type guards', () => {
        (0, vitest_1.it)('isApiSuccess should correctly identify success responses', () => {
            const success = {
                success: true,
                data: { id: '123' },
            };
            const _error = {
                success: false,
                data: null,
                message: 'Error',
            };
            (0, vitest_1.expect)(responseHandler_1.UnifiedResponseHandler.transform(success)).toMatchObject({
                success: true,
            });
            (0, vitest_1.expect)(responseHandler_1.UnifiedResponseHandler.handleError(new Error())).toMatchObject({
                success: false,
            });
        });
    });
});
//# sourceMappingURL=responseHandler.test.js.map