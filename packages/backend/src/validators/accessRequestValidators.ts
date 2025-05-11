import { z } from 'zod';

export const createAccessRequestSchema = z.object({
  body: z.object({
    email: z.string().email({ message: 'Invalid email address' }),
    name: z.string().min(1, { message: 'Name is required' }).max(100),
    organization: z.string().max(100).optional(),
    reason: z.string().min(1, { message: 'Reason is required' }),
    // user_id is optional and ideally attached server-side if user is logged in
    // It shouldn't be part of the public-facing request body directly for security.
  }),
});

export type CreateAccessRequestInput = z.infer<typeof createAccessRequestSchema>;
