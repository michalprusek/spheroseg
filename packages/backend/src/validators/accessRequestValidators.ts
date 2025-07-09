import { z } from 'zod';
import { emailSchema, nameSchema } from './commonValidators';

export const createAccessRequestSchema = z.object({
  body: z.object({
    email: emailSchema,
    name: nameSchema.min(1, { message: 'Name is required' }).max(100),
    organization: z.string().max(100).optional(),
    reason: z.string().min(1, { message: 'Reason is required' }),
  }),
});

export type CreateAccessRequestInput = z.infer<typeof createAccessRequestSchema>;
