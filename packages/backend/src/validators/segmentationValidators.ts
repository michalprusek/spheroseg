import { z } from 'zod';
import { imageIdParams } from './commonValidators';

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
    .refine(
      (data) =>
        data.status === 'failed' || (data.status === 'completed' && data.result_data !== undefined),
      {
        message: 'Result data is required when status is completed',
        path: ['result_data'], // Specify the path for the error message
      }
    ),
});

// Schema for POST /api/projects/:projectId/segmentation/batch-trigger
export const triggerProjectBatchSegmentationSchema = z.object({
  params: z.object({
    projectId: z.string().uuid('Invalid project ID format'),
  }),
  body: z
    .object({
      imageIds: z
        .array(
          z.string().refine(
            (id) => {
              // Accept either UUID format or frontend-generated format (img-timestamp-random)
              const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
              const frontendIdRegex = /^img-\d+-\d{4}$/;
              return uuidRegex.test(id) || frontendIdRegex.test(id);
            },
            { message: 'Invalid image ID format in array' }
          )
        )
        .min(1, 'At least one image ID is required')
        .max(100, 'Maximum 100 image IDs allowed per batch'), // Zvýšeno z 10 na 100
      priority: z.number().int().min(0).max(10).optional(),
      model_type: z.string().optional(),
      // Allow other parameters to be passed through for segmentation if needed
    })
    .passthrough(),
});
