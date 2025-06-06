import { z } from 'zod';

// Schema for image ID in params (used by GET, POST, PUT)
const imageIdParams = z.object({
  id: z.string().uuid('Invalid image ID format'),
});

// Schema for GET /api/images/:id/segmentation
export const getSegmentationSchema = z.object({
  params: imageIdParams,
});

// Schema for POST /api/images/:id/segmentation (trigger)
export const triggerSegmentationSchema = z.object({
  params: imageIdParams,
  body: z
    .object({
      parameters: z.record(z.any()).optional(), // Allow any JSON object for parameters
    })
    .optional(), // Body itself is optional
});

// Schema for PUT /api/images/:id/segmentation (update result)
export const updateSegmentationSchema = z.object({
  params: imageIdParams,
  body: z
    .object({
      status: z.enum(['completed', 'failed'], {
        required_error: 'Status (completed or failed) is required',
      }),
      result_data: z.record(z.any()).optional(), // Allow any JSON object, optional
      parameters: z.record(z.any()).optional(), // Optional parameters update
    })
    .refine((data) => data.status === 'failed' || (data.status === 'completed' && data.result_data !== undefined), {
      message: 'Result data is required when status is completed',
      path: ['result_data'], // Specify the path for the error message
    }),
});

// Schema for POST /api/projects/:projectId/segmentation/batch-trigger
export const triggerProjectBatchSegmentationSchema = z.object({
  params: z.object({
    projectId: z.string().uuid('Invalid project ID format'),
  }),
  body: z
    .object({
      imageIds: z
        .array(z.string().uuid('Invalid image ID format in array'))
        .min(1, 'At least one image ID is required')
        .max(100, 'Maximum 100 image IDs allowed per batch'), // Zvýšeno z 10 na 100
      priority: z.number().int().min(0).max(10).optional(),
      model_type: z.string().optional(),
      // Allow other parameters to be passed through for segmentation if needed
    })
    .passthrough(),
});
