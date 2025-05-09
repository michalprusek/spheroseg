import { z } from 'zod';

// Schema for updating user profile directly (not through body)
export const updateUserProfileSchema = z.object({
    // User fields (optional)
    email: z.string().email('Invalid email format').optional(),
    name: z.string().min(1, 'Name cannot be empty').optional(),

    // Profile fields (optional)
    username: z.string().min(3, 'Username must be at least 3 characters').optional(),
    full_name: z.string().optional(),
    title: z.string().optional(),
    organization: z.string().optional(),
    bio: z.string().optional(),
    location: z.string().optional(),
    avatar_url: z.string().optional(), // Removed URL validation to allow relative paths
    preferred_language: z.string().max(10, 'Language code too long').optional(),
    institution: z.string().optional(), // Additional field
    website: z.string().optional(), // Made URL validation optional
    twitter: z.string().optional(), // Additional field
    github: z.string().optional(), // Additional field
    linkedin: z.string().optional(), // Additional field
    orcid: z.string().optional(), // Additional field
    research_interests: z.string().optional(), // Additional field
    theme_preference: z.enum(['light', 'dark', 'system']).optional(), // Theme preference
    notification_preferences: z.object({
        email_notifications: z.boolean().optional(),
        project_updates: z.boolean().optional(),
        system_announcements: z.boolean().optional()
    }).optional()
}).refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
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