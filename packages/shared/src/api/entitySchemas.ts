import { z } from 'zod';
import { IdSchema, TimestampSchema, EmailSchema } from './schemas';

/**
 * Entity-specific validation schemas
 * 
 * These schemas define the structure of core entities in the application
 * and can be used for validation and type generation.
 */

// User schemas
export const UserSchema = z.object({
  id: IdSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  email: EmailSchema,
  name: z.string(),
  preferredLanguage: z.enum(['en', 'cs', 'de', 'es', 'fr', 'zh']),
  emailVerified: z.boolean(),
  role: z.enum(['user', 'admin']),
  isActive: z.boolean(),
  lastLoginAt: TimestampSchema.optional(),
});

export const UserProfileSchema = z.object({
  id: IdSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  email: EmailSchema,
  name: z.string(),
  preferredLanguage: z.enum(['en', 'cs', 'de', 'es', 'fr', 'zh']),
  emailVerified: z.boolean(),
  role: z.enum(['user', 'admin']),
  isActive: z.boolean(),
  lastLoginAt: TimestampSchema.optional(),
  avatar: z.string().optional(),
  bio: z.string().optional(),
  organization: z.string().optional(),
  location: z.string().optional(),
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
export const ProjectSchema = z.object({
  id: IdSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  name: z.string(),
  description: z.string().optional(),
  userId: IdSchema,
  imageCount: z.number(),
  isPublic: z.boolean(),
  tags: z.array(z.string()),
  settings: z.any(),
});

export const ProjectStatsSchema = z.object({
  totalImages: z.number(),
  segmentedImages: z.number(),
  totalCells: z.number(),
  averageCellsPerImage: z.number(),
  lastActivityAt: TimestampSchema.optional(),
});

// Image schemas
export const ImageSchema = z.object({
  id: IdSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  projectId: IdSchema,
  name: z.string(),
  filename: z.string(),
  originalName: z.string(),
  mimetype: z.string(),
  size: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  segmentationStatus: z.enum([
    'without_segmentation',
    'queued',
    'processing',
    'completed',
    'failed'
  ]),
  url: z.string(),
  thumbnailUrl: z.string().optional(),
});

// Segmentation schemas
export const SegmentationResultSchema = z.object({
  id: IdSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  imageId: IdSchema,
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  cellCount: z.number().optional(),
  processingTime: z.number().optional(),
  error: z.string().optional(),
  metadata: z.any(),
});

export const CellSchema = z.object({
  id: IdSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  segmentationResultId: IdSchema,
  cellNumber: z.number(),
  area: z.number(),
  perimeter: z.number(),
  centroidX: z.number(),
  centroidY: z.number(),
  eccentricity: z.number(),
  solidity: z.number(),
  circularity: z.number(),
  polygon: z.array(z.array(z.number())),
  features: z.any(),
});

// Task schemas
export const SegmentationTaskSchema = z.object({
  id: IdSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  imageId: IdSchema,
  priority: z.number(),
  taskStatus: z.enum(['queued', 'processing', 'completed', 'failed']),
  startedAt: TimestampSchema.optional(),
  completedAt: TimestampSchema.optional(),
  error: z.string().optional(),
  retryCount: z.number(),
});

// Settings schemas
export const UserSettingSchema = z.object({
  key: z.string(),
  value: z.union([z.string(), z.number(), z.boolean(), z.any()]),
  category: z.string().optional(),
  updatedAt: TimestampSchema,
});

// Export data schemas
export const ExportRequestSchema = z.object({
  projectId: IdSchema,
  format: z.enum(['csv', 'json', 'excel']),
  includeImages: z.boolean(),
  includeFeatures: z.boolean(),
  imageIds: z.array(IdSchema).optional(),
});

// Batch operation schemas
export const BatchDeleteRequestSchema = z.object({
  ids: z.array(IdSchema),
  type: z.enum(['images', 'projects', 'cells']),
});

export const BatchDeleteResponseSchema = z.object({
  successful: z.number(),
  failed: z.number(),
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
  expiresAt: TimestampSchema.optional(),
});

// Search/filter schemas
export const SearchQuerySchema = z.object({
  query: z.string(),
  filters: z.object({
    projectId: IdSchema.optional(),
    status: z.string().optional(),
    dateFrom: TimestampSchema.optional(),
    dateTo: TimestampSchema.optional(),
    tags: z.array(z.string()).optional(),
  }).optional(),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
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