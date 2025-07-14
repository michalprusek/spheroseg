/**
 * Common Form Schemas
 * 
 * This module contains pre-built validation schemas for common
 * forms used throughout the application.
 */

import { z } from 'zod';
import {
  emailSchema,
  strongPasswordSchema,
  simplePasswordSchema,
  usernameSchema,
  nameSchema,
  titleSchema,
  descriptionSchema,
  phoneSchema,
  idSchema,
  paginationSchema,
  messageSchema,
  urlSchema,
  imageFileSchema,
} from './schemas';

// ===========================
// Authentication Schemas
// ===========================

/**
 * Sign up form schema
 */
export const signUpSchema = z.object({
  email: emailSchema,
  password: strongPasswordSchema,
  confirmPassword: z.string(),
  username: usernameSchema.optional(),
  firstName: nameSchema,
  lastName: nameSchema,
  acceptTerms: z.boolean().refine((val) => val === true, {
    message: 'You must accept the terms and conditions',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type SignUpFormData = z.infer<typeof signUpSchema>;

/**
 * Sign in form schema
 */
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

export type SignInFormData = z.infer<typeof signInSchema>;

/**
 * Forgot password schema
 */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

/**
 * Reset password schema
 */
export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: strongPasswordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

/**
 * Change password schema
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: strongPasswordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.newPassword !== data.currentPassword, {
  message: 'New password must be different from current password',
  path: ['newPassword'],
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

// ===========================
// User Profile Schemas
// ===========================

/**
 * User profile update schema
 */
export const updateProfileSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  username: usernameSchema.optional(),
  bio: z.string().max(500).optional(),
  phone: phoneSchema.optional(),
  website: urlSchema.optional(),
  location: z.string().max(100).optional(),
  timezone: z.string().optional(),
  language: z.string().length(2).optional(),
});

export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>;

/**
 * Account settings schema
 */
export const accountSettingsSchema = z.object({
  email: emailSchema,
  emailNotifications: z.boolean(),
  marketingEmails: z.boolean(),
  twoFactorEnabled: z.boolean(),
  visibility: z.enum(['public', 'private', 'friends']),
});

export type AccountSettingsFormData = z.infer<typeof accountSettingsSchema>;

// ===========================
// Project Schemas
// ===========================

/**
 * Create project schema
 */
export const createProjectSchema = z.object({
  title: titleSchema,
  description: descriptionSchema,
  visibility: z.enum(['private', 'public', 'team']).default('private'),
  tags: z.array(z.string()).max(10).optional(),
});

export type CreateProjectFormData = z.infer<typeof createProjectSchema>;

/**
 * Update project schema
 */
export const updateProjectSchema = createProjectSchema.partial();

export type UpdateProjectFormData = z.infer<typeof updateProjectSchema>;

/**
 * Project invitation schema
 */
export const projectInvitationSchema = z.object({
  email: emailSchema,
  role: z.enum(['viewer', 'editor', 'admin']).default('viewer'),
  message: messageSchema.optional(),
});

export type ProjectInvitationFormData = z.infer<typeof projectInvitationSchema>;

// ===========================
// Image Upload Schemas
// ===========================

/**
 * Image upload schema
 */
export const imageUploadSchema = z.object({
  files: z.array(imageFileSchema).min(1, 'At least one image is required').max(100),
  projectId: idSchema,
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string()).optional(),
});

export type ImageUploadFormData = z.infer<typeof imageUploadSchema>;

/**
 * Image metadata update schema
 */
export const imageMetadataSchema = z.object({
  title: titleSchema.optional(),
  description: descriptionSchema,
  tags: z.array(z.string()).max(20),
  customFields: z.record(z.string()).optional(),
});

export type ImageMetadataFormData = z.infer<typeof imageMetadataSchema>;

// ===========================
// Segmentation Schemas
// ===========================

/**
 * Segmentation parameters schema
 */
export const segmentationParamsSchema = z.object({
  model: z.enum(['resunet', 'unet', 'maskrcnn']).default('resunet'),
  confidence: z.number().min(0).max(1).default(0.5),
  minArea: z.number().min(0).default(10),
  maxArea: z.number().min(0).optional(),
  preprocessingOptions: z.object({
    normalize: z.boolean().default(true),
    enhance: z.boolean().default(false),
    denoise: z.boolean().default(false),
  }).optional(),
});

export type SegmentationParamsFormData = z.infer<typeof segmentationParamsSchema>;

// ===========================
// Export Schemas
// ===========================

/**
 * Export configuration schema
 */
export const exportConfigSchema = z.object({
  format: z.enum(['csv', 'excel', 'json', 'matlab']),
  includeImages: z.boolean().default(false),
  includeMetadata: z.boolean().default(true),
  includeAnnotations: z.boolean().default(true),
  includeMetrics: z.boolean().default(true),
  dateRange: z.object({
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional(),
  }).optional(),
  filters: z.object({
    status: z.array(z.enum(['completed', 'processing', 'failed'])).optional(),
    tags: z.array(z.string()).optional(),
  }).optional(),
});

export type ExportConfigFormData = z.infer<typeof exportConfigSchema>;

// ===========================
// Contact & Support Schemas
// ===========================

/**
 * Contact form schema
 */
export const contactFormSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  subject: z.string().min(5).max(100),
  message: messageSchema,
  category: z.enum(['general', 'support', 'bug', 'feature', 'other']).default('general'),
});

export type ContactFormData = z.infer<typeof contactFormSchema>;

/**
 * Feedback form schema
 */
export const feedbackFormSchema = z.object({
  rating: z.number().min(1).max(5),
  category: z.enum(['ui', 'performance', 'features', 'documentation', 'other']),
  message: messageSchema.optional(),
  allowContact: z.boolean().default(false),
});

export type FeedbackFormData = z.infer<typeof feedbackFormSchema>;

// ===========================
// Search & Filter Schemas
// ===========================

/**
 * Search schema with pagination
 */
export const searchSchema = paginationSchema.extend({
  q: z.string().optional(),
  filters: z.record(z.string()).optional(),
});

export type SearchFormData = z.infer<typeof searchSchema>;

/**
 * Advanced search schema
 */
export const advancedSearchSchema = z.object({
  query: z.string().optional(),
  fields: z.array(z.string()).optional(),
  dateRange: z.object({
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional(),
  }).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  includeArchived: z.boolean().default(false),
});

export type AdvancedSearchFormData = z.infer<typeof advancedSearchSchema>;

// ===========================
// API Request Schemas
// ===========================

/**
 * Batch operation schema
 */
export const batchOperationSchema = z.object({
  operation: z.enum(['delete', 'archive', 'restore', 'export']),
  ids: z.array(idSchema).min(1).max(1000),
  options: z.record(z.any()).optional(),
});

export type BatchOperationData = z.infer<typeof batchOperationSchema>;

// ===========================
// Utility Functions
// ===========================

/**
 * Get all form schemas
 */
export function getAllSchemas() {
  return {
    // Auth
    signUp: signUpSchema,
    signIn: signInSchema,
    forgotPassword: forgotPasswordSchema,
    resetPassword: resetPasswordSchema,
    changePassword: changePasswordSchema,
    
    // Profile
    updateProfile: updateProfileSchema,
    accountSettings: accountSettingsSchema,
    
    // Projects
    createProject: createProjectSchema,
    updateProject: updateProjectSchema,
    projectInvitation: projectInvitationSchema,
    
    // Images
    imageUpload: imageUploadSchema,
    imageMetadata: imageMetadataSchema,
    
    // Segmentation
    segmentationParams: segmentationParamsSchema,
    
    // Export
    exportConfig: exportConfigSchema,
    
    // Contact
    contactForm: contactFormSchema,
    feedbackForm: feedbackFormSchema,
    
    // Search
    search: searchSchema,
    advancedSearch: advancedSearchSchema,
    
    // Operations
    batchOperation: batchOperationSchema,
  };
}

// Export all schemas
export default getAllSchemas();