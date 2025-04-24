import { z } from 'zod';

// Schema for GET /api/projects/:projectId/images params
export const listImagesSchema = z.object({
    params: z.object({
        projectId: z.string().uuid({ message: "Invalid project ID format" }),
    }),
});

// Schema for POST /api/projects/:projectId/images params (only validates projectId)
export const uploadImagesSchema = z.object({
    params: z.object({
        projectId: z.string().uuid({ message: "Invalid project ID format" }),
    }),
});

// Schema for DELETE /api/images/:id params
export const imageIdSchema = z.object({
    params: z.object({
        id: z.string().uuid({ message: "Invalid image ID format" }),
    }),
}); 