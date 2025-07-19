"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchQuerySchema = exports.ProjectShareSchema = exports.BatchDeleteResponseSchema = exports.BatchDeleteRequestSchema = exports.ExportRequestSchema = exports.UserSettingSchema = exports.SegmentationTaskSchema = exports.CellSchema = exports.SegmentationResultSchema = exports.ImageSchema = exports.ProjectStatsSchema = exports.ProjectSchema = exports.UserLoginResponseSchema = exports.UserProfileSchema = exports.UserSchema = void 0;
const zod_1 = require("zod");
const schemas_1 = require("./schemas");
/**
 * Entity-specific validation schemas
 *
 * These schemas define the structure of core entities in the application
 * and can be used for validation and type generation.
 */
// User schemas
exports.UserSchema = schemas_1.BaseEntitySchema.extend({
    email: schemas_1.EmailSchema,
    name: zod_1.z.string().min(1).max(255),
    preferredLanguage: zod_1.z.enum(['en', 'cs', 'de', 'es', 'fr', 'zh']).default('en'),
    emailVerified: zod_1.z.boolean().default(false),
    role: zod_1.z.enum(['user', 'admin']).default('user'),
    isActive: zod_1.z.boolean().default(true),
    lastLoginAt: schemas_1.TimestampSchema.nullable().optional(),
});
exports.UserProfileSchema = exports.UserSchema.extend({
    avatar: zod_1.z.string().url().nullable().optional(),
    bio: zod_1.z.string().max(500).nullable().optional(),
    organization: zod_1.z.string().max(255).nullable().optional(),
    location: zod_1.z.string().max(255).nullable().optional(),
});
exports.UserLoginResponseSchema = zod_1.z.object({
    user: exports.UserSchema,
    tokens: zod_1.z.object({
        accessToken: zod_1.z.string(),
        refreshToken: zod_1.z.string(),
        expiresIn: zod_1.z.number(),
    }),
});
// Project schemas
exports.ProjectSchema = schemas_1.BaseEntitySchema.extend({
    name: zod_1.z.string().min(1).max(255),
    description: zod_1.z.string().max(1000).nullable().optional(),
    userId: schemas_1.IdSchema,
    imageCount: zod_1.z.number().int().min(0).default(0),
    isPublic: zod_1.z.boolean().default(false),
    tags: zod_1.z.array(zod_1.z.string()).default([]),
    settings: zod_1.z.record(zod_1.z.unknown()).default({}),
});
exports.ProjectStatsSchema = zod_1.z.object({
    totalImages: zod_1.z.number().int().min(0),
    segmentedImages: zod_1.z.number().int().min(0),
    totalCells: zod_1.z.number().int().min(0),
    averageCellsPerImage: zod_1.z.number().min(0),
    lastActivityAt: schemas_1.TimestampSchema.nullable().optional(),
});
// Image schemas
exports.ImageSchema = schemas_1.BaseEntitySchema.extend({
    projectId: schemas_1.IdSchema,
    name: zod_1.z.string().min(1).max(255),
    filename: zod_1.z.string().min(1).max(255),
    originalName: zod_1.z.string().min(1).max(255),
    mimetype: zod_1.z.string(),
    size: zod_1.z.number().int().positive(),
    width: zod_1.z.number().int().positive().nullable().optional(),
    height: zod_1.z.number().int().positive().nullable().optional(),
    segmentationStatus: zod_1.z.enum([
        'without_segmentation',
        'queued',
        'processing',
        'completed',
        'failed'
    ]).default('without_segmentation'),
    url: zod_1.z.string().url(),
    thumbnailUrl: zod_1.z.string().url().nullable().optional(),
});
// Segmentation schemas
exports.SegmentationResultSchema = schemas_1.BaseEntitySchema.extend({
    imageId: schemas_1.IdSchema,
    status: zod_1.z.enum(['pending', 'processing', 'completed', 'failed']),
    cellCount: zod_1.z.number().int().min(0).nullable().optional(),
    processingTime: zod_1.z.number().min(0).nullable().optional(),
    error: zod_1.z.string().nullable().optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).default({}),
});
exports.CellSchema = schemas_1.BaseEntitySchema.extend({
    segmentationResultId: schemas_1.IdSchema,
    cellNumber: zod_1.z.number().int().positive(),
    area: zod_1.z.number().positive(),
    perimeter: zod_1.z.number().positive(),
    centroidX: zod_1.z.number(),
    centroidY: zod_1.z.number(),
    eccentricity: zod_1.z.number().min(0).max(1),
    solidity: zod_1.z.number().min(0).max(1),
    circularity: zod_1.z.number().min(0).max(1),
    polygon: zod_1.z.array(zod_1.z.tuple([zod_1.z.number(), zod_1.z.number()])),
    features: zod_1.z.record(zod_1.z.number()).default({}),
});
// Task schemas
exports.SegmentationTaskSchema = schemas_1.BaseEntitySchema.extend({
    imageId: schemas_1.IdSchema,
    priority: zod_1.z.number().int().min(0).max(10).default(5),
    taskStatus: zod_1.z.enum(['queued', 'processing', 'completed', 'failed']),
    startedAt: schemas_1.TimestampSchema.nullable().optional(),
    completedAt: schemas_1.TimestampSchema.nullable().optional(),
    error: zod_1.z.string().nullable().optional(),
    retryCount: zod_1.z.number().int().min(0).default(0),
});
// Settings schemas
exports.UserSettingSchema = zod_1.z.object({
    key: zod_1.z.string().min(1).max(255),
    value: zod_1.z.union([zod_1.z.string(), zod_1.z.number(), zod_1.z.boolean(), zod_1.z.record(zod_1.z.unknown())]),
    category: zod_1.z.string().max(100).nullable().optional(),
    updatedAt: schemas_1.TimestampSchema,
});
// Export data schemas
exports.ExportRequestSchema = zod_1.z.object({
    projectId: schemas_1.IdSchema,
    format: zod_1.z.enum(['csv', 'json', 'excel']),
    includeImages: zod_1.z.boolean().default(true),
    includeFeatures: zod_1.z.boolean().default(true),
    imageIds: zod_1.z.array(schemas_1.IdSchema).optional(),
});
// Batch operation schemas
exports.BatchDeleteRequestSchema = zod_1.z.object({
    ids: zod_1.z.array(schemas_1.IdSchema).min(1),
    type: zod_1.z.enum(['images', 'projects', 'cells']),
});
exports.BatchDeleteResponseSchema = zod_1.z.object({
    successful: zod_1.z.number().int().min(0),
    failed: zod_1.z.number().int().min(0),
    errors: zod_1.z.array(zod_1.z.object({
        id: schemas_1.IdSchema,
        error: zod_1.z.string(),
    })).optional(),
});
// Share/collaboration schemas
exports.ProjectShareSchema = zod_1.z.object({
    projectId: schemas_1.IdSchema,
    sharedWithUserId: schemas_1.IdSchema,
    permission: zod_1.z.enum(['view', 'edit', 'admin']),
    sharedAt: schemas_1.TimestampSchema,
    expiresAt: schemas_1.TimestampSchema.nullable().optional(),
});
// Search/filter schemas
exports.SearchQuerySchema = zod_1.z.object({
    query: zod_1.z.string().min(1).max(255),
    filters: zod_1.z.object({
        projectId: schemas_1.IdSchema.optional(),
        status: zod_1.z.string().optional(),
        dateFrom: schemas_1.TimestampSchema.optional(),
        dateTo: schemas_1.TimestampSchema.optional(),
        tags: zod_1.z.array(zod_1.z.string()).optional(),
    }).optional(),
    pagination: zod_1.z.object({
        page: zod_1.z.number().int().positive().default(1),
        pageSize: zod_1.z.number().int().positive().max(100).default(20),
    }).optional(),
});
//# sourceMappingURL=entitySchemas.js.map