import { z } from 'zod';

export const uuidSchema = z.string().uuid('Invalid UUID format');
export const emailSchema = z.string().email('Invalid email format');
export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');
export const nameSchema = z.string().min(2, 'Name must be at least 2 characters');
export const optionalStringSchema = z.string().optional();
export const optionalUuidSchema = z.string().uuid('Invalid UUID format').optional();

export const imageIdParams = z.object({
  id: uuidSchema,
});

export const projectIdParams = z.object({
  projectId: uuidSchema,
});

export const paginationQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
  offset: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
  sortBy: optionalStringSchema,
  sortDirection: z.enum(['asc', 'desc']).optional(),
});

export const timestampSchema = z.string().datetime().optional();
