/**
 * Project validators
 */
import { z } from 'zod';

/**
 * Schema for project creation
 */
export const createProjectSchema = z.object({
  body: z.object({
    title: z.string()
      .min(3, 'Title must be at least 3 characters long')
      .max(100, 'Title must be at most 100 characters long')
      .trim()
      .refine(val => val.length > 0, 'Title cannot be empty after trimming'),
    description: z.string()
      .max(1000, 'Description must be at most 1000 characters long')
      .optional()
      .transform(val => val && val.trim() ? val.trim() : null),
    tags: z.array(z.string().max(50, 'Each tag must be at most 50 characters'))
      .max(10, 'Maximum 10 tags allowed')
      .optional(),
    public: z.boolean().optional().default(false),
  })
});

/**
 * Schema for project update
 */
export const updateProjectSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid project ID')
  }),
  body: z.object({
    title: z.string()
      .min(3, 'Title must be at least 3 characters long')
      .max(100, 'Title must be at most 100 characters long')
      .optional(),
    description: z.string()
      .max(1000, 'Description must be at most 1000 characters long')
      .optional(),
    thumbnail_url: z.string().optional(),
  })
});

/**
 * Schema for project deletion
 */
export const deleteProjectSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid project ID')
  })
});

/**
 * Schema for project duplication
 */
export const duplicateProjectSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid project ID')
  }),
  body: z.object({
    newTitle: z.string()
      .min(3, 'Title must be at least 3 characters long')
      .max(100, 'Title must be at most 100 characters long')
      .optional(),
    copyFiles: z.boolean().optional().default(true),
    copySegmentations: z.boolean().optional().default(false),
    resetStatus: z.boolean().optional().default(true),
    async: z.boolean().optional().default(false),
  })
});

/**
 * Schema for getting project images
 */
export const getProjectImagesSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid project ID')
  }),
  query: z.object({
    page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
    pageSize: z.string().optional().transform(val => val ? parseInt(val, 10) : 20),
    status: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
  }).optional(),
});

export default {
  createProjectSchema,
  updateProjectSchema,
  deleteProjectSchema,
  duplicateProjectSchema,
  getProjectImagesSchema
};