import { z } from 'zod';
import { emailSchema, passwordSchema, nameSchema, optionalStringSchema } from './commonValidators';

// Schema for user registration
export const registerSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: passwordSchema,
    name: nameSchema.optional(),
    preferred_language: optionalStringSchema,
  }),
});

// Schema for user login
export const loginSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
    remember_me: z.boolean().optional(),
  }),
});

// Schema for refreshing access token
export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
});

// Schema for logout
export const logoutSchema = z.object({
  body: z.object({
    refreshToken: z.string().optional(),
  }),
});

// Schema for password change
export const changePasswordSchema = z.object({
  body: z
    .object({
      current_password: z.string().min(1, 'Current password is required'),
      new_password: passwordSchema,
      confirm_password: passwordSchema,
    })
    .refine((data) => data.new_password === data.confirm_password, {
      message: 'Passwords do not match',
      path: ['confirm_password'],
    }),
});

// Schema for password reset request
export const forgotPasswordSchema = z.object({
  body: z.object({
    email: emailSchema,
  }),
});

// Schema for password reset with token
export const resetPasswordSchema = z.object({
  body: z
    .object({
      token: z.string().min(1, 'Reset token is required'),
      password: passwordSchema,
      confirm_password: passwordSchema,
    })
    .refine((data) => data.password === data.confirm_password, {
      message: 'Passwords do not match',
      path: ['confirm_password'],
    }),
});

// Schema for account deletion
export const deleteAccountSchema = z.object({
  body: z.object({
    username: emailSchema, // Using emailSchema for username as it's email confirmation
    password: z.string().min(1, 'Password is required'),
  }),
});

// Schema for email verification request
export const sendVerificationEmailSchema = z.object({
  body: z.object({
    email: emailSchema,
  }),
});

// Schema for email verification with token
export const verifyEmailSchema = z.object({
  query: z.object({
    token: z.string().min(1, 'Verification token is required'),
  }),
});

// Export types based on the schemas
export type RegisterRequest = z.infer<typeof registerSchema>['body'];
export type LoginRequest = z.infer<typeof loginSchema>['body'];
export type RefreshTokenRequest = z.infer<typeof refreshTokenSchema>['body'];
export type LogoutRequest = z.infer<typeof logoutSchema>['body'];
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>['body'];
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordSchema>['body'];
export type ResetPasswordRequest = z.infer<typeof resetPasswordSchema>['body'];
export type DeleteAccountRequest = z.infer<typeof deleteAccountSchema>['body'];
export type SendVerificationEmailRequest = z.infer<typeof sendVerificationEmailSchema>['body'];
export type VerifyEmailRequest = z.infer<typeof verifyEmailSchema>['query'];
