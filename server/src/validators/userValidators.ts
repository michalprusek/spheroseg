import { z } from 'zod';

export const updateUserProfileSchema = z.object({
    body: z.object({
        // User fields (optional)
        email: z.string().email('Invalid email format').optional(),
        name: z.string().min(1, 'Name cannot be empty').optional(),
        password: z.string().min(6, 'Password must be at least 6 characters').optional(),

        // Profile fields (optional)
        username: z.string().min(3, 'Username must be at least 3 characters').optional(),
        full_name: z.string().optional(),
        title: z.string().optional(),
        organization: z.string().optional(),
        bio: z.string().optional(),
        location: z.string().optional(),
        avatar_url: z.string().url('Invalid URL format').optional(),
        preferred_language: z.string().max(10, 'Language code too long').optional(),
    }).refine(data => Object.keys(data).length > 0, {
        message: 'At least one field must be provided for update',
    }),
});

export const updateLanguageSchema = z.object({
     body: z.object({
         language: z.string({
             required_error: 'Language is required',
         }).max(10, 'Language code too long'),
     }),
});

export const changeRoleSchema = z.object({
  role: z.enum(['admin', 'annotator', 'user'], { // Assuming these are the valid roles
    required_error: 'Role is required',
    invalid_type_error: 'Invalid role specified',
  }),
}); 