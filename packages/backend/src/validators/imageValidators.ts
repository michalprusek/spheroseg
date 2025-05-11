import { z } from 'zod';

// Schema for GET /api/projects/:projectId/images params and query
export const listImagesSchema = z.object({
  params: z.object({
    projectId: z.string().uuid({ message: 'Invalid project ID format' }),
  }),
  query: z
    .object({
      name: z.string().optional(),
      verifyFiles: z.enum(['true', 'false']).optional(),
      filterMissing: z.enum(['true', 'false']).optional(),
    })
    .optional(),
});

// Schema for POST /api/projects/:projectId/images params (only validates projectId)
export const uploadImagesSchema = z.object({
  params: z.object({
    projectId: z.string().uuid({ message: 'Invalid project ID format' }),
  }),
});

// Schema for GET /api/projects/:projectId/images/:imageId params and query
export const imageDetailSchema = z.object({
  params: z.object({
    projectId: z.string().uuid({ message: 'Invalid project ID format' }),
    imageId: z.string(), // Can be UUID or name
  }),
  query: z
    .object({
      name: z.string().optional(),
      skipVerify: z.enum(['true', 'false']).optional(),
    })
    .optional(),
});

// Schema for DELETE /api/images/:id params (legacy route)
export const imageIdSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid image ID format' }),
  }),
});

// Schema for DELETE /api/projects/:projectId/images/:imageId params
export const deleteImageSchema = z.object({
  params: z.object({
    projectId: z.string().uuid({ message: 'Invalid project ID format' }),
    imageId: z.string().uuid({ message: 'Invalid image ID format' }),
  }),
});

// Schema for DELETE /api/projects/:projectId/images
export const batchDeleteImagesSchema = z.object({
  params: z.object({
    projectId: z.string().uuid({ message: 'Invalid project ID format' }),
  }),
  body: z.object({
    imageIds: z
      .array(z.string().uuid({ message: 'Invalid image ID format' }))
      .min(1, { message: 'At least one image ID is required' }),
  }),
});
