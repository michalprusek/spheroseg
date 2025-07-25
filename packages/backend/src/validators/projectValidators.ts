/**
 * Project validators
 */
import { z } from 'zod';
import { uuidSchema, paginationQuerySchema, optionalStringSchema } from './commonValidators';

/**
 * Schema for listing projects
 */
export const listProjectsSchema = z.object({
  query: paginationQuerySchema.extend({
    includeShared: z
      .string()
      .optional()
      .transform((val) => val === 'true'),
  }),
});

/**
 * Schema for project ID parameter
 */
export const projectIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

/**
 * Schema for project creation
 */
export const createProjectSchema = z.object({
  body: z.object({
    title: z
      .string()
      .min(1, 'Title must not be empty')
      .max(100, 'Title must be at most 100 characters long')
      .trim()
      .refine((val) => val.length > 0, 'Title cannot be empty after trimming'),
    description: z
      .string()
      .max(1000, 'Description must be at most 1000 characters long')
      .optional()
      .transform((val) => (val && val.trim() ? val.trim() : null)),
    tags: z
      .array(z.string().max(50, 'Each tag must be at most 50 characters'))
      .max(10, 'Maximum 10 tags allowed')
      .optional(),
    public: z.boolean().optional().default(false),
  }),
});

/**
 * Schema for project update
 */
export const updateProjectSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    title: z
      .string()
      .min(1, 'Title must not be empty')
      .max(100, 'Title must be at most 100 characters long')
      .trim()
      .optional(),
    description: z
      .string()
      .max(1000, 'Description must be at most 1000 characters long')
      .optional()
      .nullable()
      .transform((val) => (val && val.trim() ? val.trim() : null)),
    tags: z
      .array(z.string().max(50, 'Each tag must be at most 50 characters'))
      .max(10, 'Maximum 10 tags allowed')
      .optional(),
    public: z.boolean().optional(),
  }),
});

/**
 * Schema for project deletion
 */
export const deleteProjectSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});


/**
 * Schema for getting project images
 */
export const getProjectImagesSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  query: paginationQuerySchema.extend({
    status: optionalStringSchema,
  }),
});
