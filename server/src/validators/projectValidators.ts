import { z } from 'zod';

// Schema for GET /api/projects query parameters
export const listProjectsSchema = z.object({
    query: z.object({
        limit: z.string().optional().refine((val) => !val || /^[0-9]+$/.test(val), {
            message: 'Limit must be a positive integer',
        }).transform(val => val ? parseInt(val, 10) : 10),
        offset: z.string().optional().refine((val) => !val || /^[0-9]+$/.test(val), {
            message: 'Offset must be a positive integer',
        }).transform(val => val ? parseInt(val, 10) : 0),
    }),
});

// Schema for POST /api/projects body
export const createProjectSchema = z.object({
    body: z.object({
        title: z.string({
            required_error: 'Project title is required',
        }).min(1, 'Project title cannot be empty'),
        description: z.string().optional(),
    }),
});

// Schema for GET /api/projects/:id and DELETE /api/projects/:id params
export const projectIdSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid project ID format'),
    }),
});

// Schema for POST /api/projects/:id/duplicate params
export const duplicateProjectSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid original project ID format'),
    }),
}); 