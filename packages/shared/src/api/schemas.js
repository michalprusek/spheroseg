"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.schemas = exports.BatchOperationResultSchema = exports.SuccessMessageSchema = exports.FileUploadResponseSchema = exports.BaseEntitySchema = exports.PaginationParamsSchema = exports.EmailSchema = exports.TimestampSchema = exports.IdSchema = exports.ApiErrorResponseSchema = exports.ApiResponseSchema = exports.ResponseMetadataSchema = exports.ApiErrorSchema = exports.ValidationErrorSchema = void 0;
exports.createPaginatedSchema = createPaginatedSchema;
const zod_1 = require("zod");
/**
 * Common validation schemas for API responses
 *
 * These schemas can be used with the UnifiedResponseHandler to validate
 * API responses and ensure type safety.
 */
// Base schemas
exports.ValidationErrorSchema = zod_1.z.object({
    field: zod_1.z.string(),
    message: zod_1.z.string(),
    code: zod_1.z.string().optional(),
});
exports.ApiErrorSchema = zod_1.z.object({
    code: zod_1.z.string(),
    message: zod_1.z.string(),
    details: zod_1.z.record(zod_1.z.unknown()).optional(),
    timestamp: zod_1.z.string().optional(),
    path: zod_1.z.string().optional(),
});
exports.ResponseMetadataSchema = zod_1.z.object({
    timestamp: zod_1.z.string(),
    duration: zod_1.z.number().optional(),
    pagination: zod_1.z.object({
        page: zod_1.z.number(),
        pageSize: zod_1.z.number(),
        totalPages: zod_1.z.number(),
        totalItems: zod_1.z.number(),
    }).optional(),
    version: zod_1.z.string().optional(),
});
// Generic API response schemas
const ApiResponseSchema = (dataSchema) => zod_1.z.object({
    data: dataSchema,
    success: zod_1.z.literal(true),
    message: zod_1.z.string().optional(),
    metadata: exports.ResponseMetadataSchema.optional(),
});
exports.ApiResponseSchema = ApiResponseSchema;
exports.ApiErrorResponseSchema = zod_1.z.object({
    data: zod_1.z.null(),
    success: zod_1.z.literal(false),
    message: zod_1.z.string(),
    errors: zod_1.z.array(exports.ValidationErrorSchema).optional(),
    error: exports.ApiErrorSchema.optional(),
    metadata: exports.ResponseMetadataSchema.optional(),
});
// Common data schemas
exports.IdSchema = zod_1.z.string().uuid();
exports.TimestampSchema = zod_1.z.string().datetime();
exports.EmailSchema = zod_1.z.string().email();
exports.PaginationParamsSchema = zod_1.z.object({
    page: zod_1.z.number().int().positive().default(1),
    pageSize: zod_1.z.number().int().positive().max(100).default(20),
    sortBy: zod_1.z.string().optional(),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('asc'),
});
// Entity schemas that can be reused
exports.BaseEntitySchema = zod_1.z.object({
    id: exports.IdSchema,
    createdAt: exports.TimestampSchema,
    updatedAt: exports.TimestampSchema,
});
// File upload schemas
exports.FileUploadResponseSchema = zod_1.z.object({
    id: exports.IdSchema,
    filename: zod_1.z.string(),
    originalName: zod_1.z.string(),
    mimetype: zod_1.z.string(),
    size: zod_1.z.number(),
    url: zod_1.z.string().url(),
    createdAt: exports.TimestampSchema,
});
// Success message schema
exports.SuccessMessageSchema = zod_1.z.object({
    message: zod_1.z.string(),
});
// Batch operation schemas
exports.BatchOperationResultSchema = zod_1.z.object({
    successful: zod_1.z.number(),
    failed: zod_1.z.number(),
    errors: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        error: zod_1.z.string(),
    })).optional(),
});
// Helper function to create paginated response schema
function createPaginatedSchema(itemSchema) {
    return (0, exports.ApiResponseSchema)(zod_1.z.array(itemSchema)).extend({
        metadata: exports.ResponseMetadataSchema.extend({
            pagination: zod_1.z.object({
                page: zod_1.z.number(),
                pageSize: zod_1.z.number(),
                totalPages: zod_1.z.number(),
                totalItems: zod_1.z.number(),
            }),
        }),
    });
}
// Export all schemas for easy access
exports.schemas = {
    ValidationErrorSchema: exports.ValidationErrorSchema,
    ApiErrorSchema: exports.ApiErrorSchema,
    ResponseMetadataSchema: exports.ResponseMetadataSchema,
    ApiResponseSchema: exports.ApiResponseSchema,
    ApiErrorResponseSchema: exports.ApiErrorResponseSchema,
    IdSchema: exports.IdSchema,
    TimestampSchema: exports.TimestampSchema,
    EmailSchema: exports.EmailSchema,
    PaginationParamsSchema: exports.PaginationParamsSchema,
    BaseEntitySchema: exports.BaseEntitySchema,
    FileUploadResponseSchema: exports.FileUploadResponseSchema,
    SuccessMessageSchema: exports.SuccessMessageSchema,
    BatchOperationResultSchema: exports.BatchOperationResultSchema,
    createPaginatedSchema,
};
//# sourceMappingURL=schemas.js.map