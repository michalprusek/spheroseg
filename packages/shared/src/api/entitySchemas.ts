import { z } from 'zod';
import { BaseEntitySchema, IdSchema, TimestampSchema, EmailSchema } from './schemas';

/**
 * Entity-specific validation schemas
 * 
 * These schemas define the structure of core entities in the application
 * and can be used for validation and type generation.
 */

// User schemas
export const UserSchema = BaseEntitySchema.extend({
  email: EmailSchema,
  name: z.string().min(1).max(255),
  preferredLanguage: z.enum(['en', 'cs', 'de', 'es', 'fr', 'zh']).default('en'),
  emailVerified: z.boolean().default(false),
  role: z.enum(['user', 'admin']).default('user'),
  isActive: z.boolean().default(true),
  lastLoginAt: TimestampSchema.nullable().optional(),
});

export const UserProfileSchema = UserSchema.extend({
  avatar: z.string().url().nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
  organization: z.string().max(255).nullable().optional(),
  location: z.string().max(255).nullable().optional(),
});

export const UserLoginResponseSchema = z.object({
  user: UserSchema,
  tokens: z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
    expiresIn: z.number(),
  }),
});

// Project schemas
export const ProjectSchema = BaseEntitySchema.extend({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).nullable().optional(),
  userId: IdSchema,
  imageCount: z.number().int().min(0).default(0),
  isPublic: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  settings: z.record(z.unknown()).default({}),
});

export const ProjectStatsSchema = z.object({
  totalImages: z.number().int().min(0),
  segmentedImages: z.number().int().min(0),
  totalCells: z.number().int().min(0),
  averageCellsPerImage: z.number().min(0),
  lastActivityAt: TimestampSchema.nullable().optional(),
});

// Image schemas
export const ImageSchema = BaseEntitySchema.extend({
  projectId: IdSchema,
  name: z.string().min(1).max(255),
  filename: z.string().min(1).max(255),
  originalName: z.string().min(1).max(255),
  mimetype: z.string(),
  size: z.number().int().positive(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  segmentationStatus: z.enum([
    'without_segmentation',
    'queued',
    'processing',
    'completed',
    'failed'
  ]).default('without_segmentation'),
  url: z.string().url(),
  thumbnailUrl: z.string().url().nullable().optional(),
});

// Segmentation schemas
export const SegmentationResultSchema = BaseEntitySchema.extend({
  imageId: IdSchema,
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  cellCount: z.number().int().min(0).nullable().optional(),
  processingTime: z.number().min(0).nullable().optional(),
  error: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const CellSchema = BaseEntitySchema.extend({
  segmentationResultId: IdSchema,
  cellNumber: z.number().int().positive(),
  area: z.number().positive(),
  perimeter: z.number().positive(),
  centroidX: z.number(),
  centroidY: z.number(),
  eccentricity: z.number().min(0).max(1),
  solidity: z.number().min(0).max(1),
  circularity: z.number().min(0).max(1),
  polygon: z.array(z.tuple([z.number(), z.number()])),
  features: z.record(z.number()).default({}),
});

// Task schemas
export const SegmentationTaskSchema = BaseEntitySchema.extend({
  imageId: IdSchema,
  priority: z.number().int().min(0).max(10).default(5),
  taskStatus: z.enum(['queued', 'processing', 'completed', 'failed']),
  startedAt: TimestampSchema.nullable().optional(),
  completedAt: TimestampSchema.nullable().optional(),
  error: z.string().nullable().optional(),
  retryCount: z.number().int().min(0).default(0),
});

// Settings schemas
export const UserSettingSchema = z.object({
  key: z.string().min(1).max(255),
  value: z.union([z.string(), z.number(), z.boolean(), z.record(z.unknown())]),
  category: z.string().max(100).nullable().optional(),
  updatedAt: TimestampSchema,
});

// Export data schemas
export const ExportRequestSchema = z.object({
  projectId: IdSchema,
  format: z.enum(['csv', 'json', 'excel']),
  includeImages: z.boolean().default(true),
  includeFeatures: z.boolean().default(true),
  imageIds: z.array(IdSchema).optional(),
});

// Batch operation schemas
export const BatchDeleteRequestSchema = z.object({
  ids: z.array(IdSchema).min(1),
  type: z.enum(['images', 'projects', 'cells']),
});

export const BatchDeleteResponseSchema = z.object({
  successful: z.number().int().min(0),
  failed: z.number().int().min(0),
  errors: z.array(z.object({
    id: IdSchema,
    error: z.string(),
  })).optional(),
});

// Share/collaboration schemas
export const ProjectShareSchema = z.object({
  projectId: IdSchema,
  sharedWithUserId: IdSchema,
  permission: z.enum(['view', 'edit', 'admin']),
  sharedAt: TimestampSchema,
  expiresAt: TimestampSchema.nullable().optional(),
});

// Search/filter schemas
export const SearchQuerySchema = z.object({
  query: z.string().min(1).max(255),
  filters: z.object({
    projectId: IdSchema.optional(),
    status: z.string().optional(),
    dateFrom: TimestampSchema.optional(),
    dateTo: TimestampSchema.optional(),
    tags: z.array(z.string()).optional(),
  }).optional(),
  pagination: z.object({
    page: z.number().int().positive().default(1),
    pageSize: z.number().int().positive().max(100).default(20),
  }).optional(),
});

// Export type helpers
export type User = z.infer<typeof UserSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type UserLoginResponse = z.infer<typeof UserLoginResponseSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type ProjectStats = z.infer<typeof ProjectStatsSchema>;
export type Image = z.infer<typeof ImageSchema>;
export type SegmentationResult = z.infer<typeof SegmentationResultSchema>;
export type Cell = z.infer<typeof CellSchema>;
export type SegmentationTask = z.infer<typeof SegmentationTaskSchema>;
export type UserSetting = z.infer<typeof UserSettingSchema>;
export type ExportRequest = z.infer<typeof ExportRequestSchema>;
export type BatchDeleteRequest = z.infer<typeof BatchDeleteRequestSchema>;
export type BatchDeleteResponse = z.infer<typeof BatchDeleteResponseSchema>;
export type ProjectShare = z.infer<typeof ProjectShareSchema>;
export type SearchQuery = z.infer<typeof SearchQuerySchema>;