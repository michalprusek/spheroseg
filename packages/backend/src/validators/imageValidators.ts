import { z } from 'zod';
import { uuidSchema, projectIdParams, optionalStringSchema } from './commonValidators';

// Schema for GET /api/projects/:projectId/images params and query
export const listImagesSchema = z.object({
  params: projectIdParams,
  query: z
    .object({
      name: optionalStringSchema,
      verifyFiles: z.enum(['true', 'false']).optional(),
      filterMissing: z.enum(['true', 'false']).optional(),
    })
    .optional(),
});

// Schema for POST /api/projects/:projectId/images params (only validates projectId)
export const uploadImagesSchema = z.object({
  params: projectIdParams,
});

// Schema for GET /api/projects/:projectId/images/:imageId params and query
export const imageDetailSchema = z.object({
  params: z.object({
    projectId: uuidSchema,
    imageId: z.string(), // Can be UUID or name
  }),
  query: z
    .object({
      name: optionalStringSchema,
      skipVerify: z.enum(['true', 'false']).optional(),
    })
    .optional(),
});

// Schema for DELETE /api/images/:id params (legacy route) or /api/projects/:projectId/images/:imageId
export const deleteImageSchema = z.object({
  params: z.object({
    projectId: uuidSchema.optional(), // Optional for legacy /images/:id route
    imageId: uuidSchema, // Image ID must be a UUID
  }),
});

// Schema for DELETE /api/projects/:projectId/images
export const batchDeleteImagesSchema = z.object({
  params: projectIdParams,
  body: z.object({
    imageIds: z.array(uuidSchema).min(1, { message: 'At least one image ID is required' }),
  }),
});
