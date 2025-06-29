import { z } from 'zod';
import { emailSchema, nameSchema, optionalStringSchema } from './commonValidators';

// Schema for updating user profile directly (not through body)
export const updateUserProfileSchema = z
  .object({
    // User fields (optional)
    email: emailSchema.optional(),
    name: nameSchema.optional(),

    // Profile fields (optional)
    username: z.string().min(3, 'Username must be at least 3 characters').optional(),
    full_name: optionalStringSchema,
    title: optionalStringSchema,
    organization: optionalStringSchema,
    bio: optionalStringSchema,
    location: optionalStringSchema,
    avatar_url: optionalStringSchema, // Removed URL validation to allow relative paths
    preferred_language: z.string().max(10, 'Language code too long').optional(),
    institution: optionalStringSchema, // Additional field
    website: optionalStringSchema, // Made URL validation optional
    twitter: optionalStringSchema, // Additional field
    github: optionalStringSchema, // Additional field
    linkedin: optionalStringSchema, // Additional field
    orcid: optionalStringSchema, // Additional field
    research_interests: optionalStringSchema, // Additional field
    theme_preference: z.enum(['light', 'dark', 'system']).optional(), // Theme preference
    notification_preferences: z
      .object({
        email_notifications: z.boolean().optional(),
        project_updates: z.boolean().optional(),
        system_announcements: z.boolean().optional(),
      })
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const updateLanguageSchema = z.object({
  body: z.object({
    language: z
      .string({
        required_error: 'Language is required',
      })
      .max(10, 'Language code too long'),
  }),
});

export const changeRoleSchema = z.object({
  role: z.enum(['admin', 'annotator', 'user'], {
    // Assuming these are the valid roles
    required_error: 'Role is required',
    invalid_type_error: 'Invalid role specified',
  }),
});
