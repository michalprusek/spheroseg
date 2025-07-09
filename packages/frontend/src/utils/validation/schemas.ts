/**
 * Centralized Validation Schemas
 *
 * This module contains all reusable Zod schemas for form validation
 * across the application. It provides consistent validation rules
 * and error messages.
 */

import { z } from 'zod';

// ===========================
// Common Validation Rules
// ===========================

export const VALIDATION_RULES = {
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 30,
  TITLE_MIN_LENGTH: 1,
  TITLE_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 500,
  EMAIL_MAX_LENGTH: 254,
} as const;

// ===========================
// Base Schemas
// ===========================

/**
 * Email validation schema
 */
export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Invalid email format')
  .max(VALIDATION_RULES.EMAIL_MAX_LENGTH, 'Email is too long')
  .toLowerCase()
  .trim();

/**
 * Password validation schema
 */
export const passwordSchema = z
  .string()
  .min(
    VALIDATION_RULES.PASSWORD_MIN_LENGTH,
    `Password must be at least ${VALIDATION_RULES.PASSWORD_MIN_LENGTH} characters`,
  )
  .max(
    VALIDATION_RULES.PASSWORD_MAX_LENGTH,
    `Password must not exceed ${VALIDATION_RULES.PASSWORD_MAX_LENGTH} characters`,
  )
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

/**
 * Simple password schema (less strict)
 */
export const simplePasswordSchema = z
  .string()
  .min(
    VALIDATION_RULES.PASSWORD_MIN_LENGTH,
    `Password must be at least ${VALIDATION_RULES.PASSWORD_MIN_LENGTH} characters`,
  )
  .max(
    VALIDATION_RULES.PASSWORD_MAX_LENGTH,
    `Password must not exceed ${VALIDATION_RULES.PASSWORD_MAX_LENGTH} characters`,
  );

/**
 * Username validation schema
 */
export const usernameSchema = z
  .string()
  .min(
    VALIDATION_RULES.USERNAME_MIN_LENGTH,
    `Username must be at least ${VALIDATION_RULES.USERNAME_MIN_LENGTH} characters`,
  )
  .max(
    VALIDATION_RULES.USERNAME_MAX_LENGTH,
    `Username must not exceed ${VALIDATION_RULES.USERNAME_MAX_LENGTH} characters`,
  )
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, hyphens, and underscores')
  .trim();

/**
 * Title validation schema (for projects, etc.)
 */
export const titleSchema = z
  .string()
  .min(VALIDATION_RULES.TITLE_MIN_LENGTH, 'Title is required')
  .max(VALIDATION_RULES.TITLE_MAX_LENGTH, `Title must not exceed ${VALIDATION_RULES.TITLE_MAX_LENGTH} characters`)
  .trim();

/**
 * Description validation schema
 */
export const descriptionSchema = z
  .string()
  .max(
    VALIDATION_RULES.DESCRIPTION_MAX_LENGTH,
    `Description must not exceed ${VALIDATION_RULES.DESCRIPTION_MAX_LENGTH} characters`,
  )
  .optional();

/**
 * Boolean checkbox schema
 */
export const booleanSchema = z.boolean();

/**
 * Required checkbox schema (must be true)
 */
export const requiredCheckboxSchema = z.boolean().refine((val) => val === true, 'This field must be checked');

// ===========================
// Composite Schemas
// ===========================

/**
 * Sign up form schema
 */
export const signUpSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    agreeToTerms: requiredCheckboxSchema.refine((val) => val === true, 'You must agree to the terms and conditions'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

/**
 * Sign in form schema
 */
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: booleanSchema.optional(),
});

/**
 * Forgot password form schema
 */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

/**
 * Reset password form schema
 */
export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

/**
 * Change password form schema
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from current password',
    path: ['newPassword'],
  });

/**
 * Create project form schema
 */
export const createProjectSchema = z.object({
  title: titleSchema,
  description: descriptionSchema,
});

/**
 * Update project form schema
 */
export const updateProjectSchema = z.object({
  title: titleSchema.optional(),
  description: descriptionSchema,
});

/**
 * Share project form schema
 */
export const shareProjectSchema = z.object({
  email: emailSchema,
  permission: z.enum(['view', 'edit', 'admin'], {
    required_error: 'Please select a permission level',
  }),
});

/**
 * User profile form schema
 */
export const userProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50).trim(),
  lastName: z.string().min(1, 'Last name is required').max(50).trim(),
  bio: z.string().max(500).optional(),
  preferredLanguage: z.enum(['en', 'cs', 'de', 'es', 'fr', 'zh']).optional(),
});

/**
 * Request access form schema
 */
export const requestAccessSchema = z.object({
  email: emailSchema,
  firstName: z.string().min(1, 'First name is required').max(50).trim(),
  lastName: z.string().min(1, 'Last name is required').max(50).trim(),
  institution: z.string().min(1, 'Institution is required').max(100).trim(),
  purpose: z.string().min(10, 'Please provide more details about your purpose').max(500).trim(),
});

// ===========================
// Validation Helpers
// ===========================

/**
 * Create a dynamic schema with translations
 */
export function createTranslatedSchema<T extends z.ZodType>(schema: T, translations: Record<string, string>): T {
  // This is a placeholder for translation logic
  // In practice, you'd integrate with your i18n system
  return schema;
}

/**
 * Password strength validator
 */
export function getPasswordStrength(password: string): {
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= VALIDATION_RULES.PASSWORD_MIN_LENGTH) score++;
  else feedback.push(`At least ${VALIDATION_RULES.PASSWORD_MIN_LENGTH} characters`);

  if (/[A-Z]/.test(password)) score++;
  else feedback.push('At least one uppercase letter');

  if (/[a-z]/.test(password)) score++;
  else feedback.push('At least one lowercase letter');

  if (/[0-9]/.test(password)) score++;
  else feedback.push('At least one number');

  if (/[^A-Za-z0-9]/.test(password)) score++;
  else feedback.push('At least one special character');

  if (password.length >= 12) score++;

  return {
    score: Math.min(score, 5),
    feedback,
  };
}

/**
 * Email validation with async check
 */
export const createAsyncEmailSchema = (checkEmailExists: (email: string) => Promise<boolean>) => {
  return emailSchema.refine(
    async (email) => {
      const exists = await checkEmailExists(email);
      return !exists;
    },
    {
      message: 'This email is already registered',
    },
  );
};

// ===========================
// Type Exports
// ===========================

export type SignUpForm = z.infer<typeof signUpSchema>;
export type SignInForm = z.infer<typeof signInSchema>;
export type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordForm = z.infer<typeof changePasswordSchema>;
export type CreateProjectForm = z.infer<typeof createProjectSchema>;
export type UpdateProjectForm = z.infer<typeof updateProjectSchema>;
export type ShareProjectForm = z.infer<typeof shareProjectSchema>;
export type UserProfileForm = z.infer<typeof userProfileSchema>;
export type RequestAccessForm = z.infer<typeof requestAccessSchema>;

// ===========================
// Default Export
// ===========================

export default {
  // Rules
  VALIDATION_RULES,

  // Base schemas
  emailSchema,
  passwordSchema,
  simplePasswordSchema,
  usernameSchema,
  titleSchema,
  descriptionSchema,
  booleanSchema,
  requiredCheckboxSchema,

  // Form schemas
  signUpSchema,
  signInSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  createProjectSchema,
  updateProjectSchema,
  shareProjectSchema,
  userProfileSchema,
  requestAccessSchema,

  // Helpers
  createTranslatedSchema,
  getPasswordStrength,
  createAsyncEmailSchema,
};
