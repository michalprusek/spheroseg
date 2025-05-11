import { z } from 'zod';

// Schema for user registration
export const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    name: z.string().min(2, 'Name must be at least 2 characters').optional(),
    preferred_language: z.string().optional(),
  }),
});

// Schema for user login
export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
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
      new_password: z.string().min(8, 'New password must be at least 8 characters'),
      confirm_password: z.string().min(8, 'Password confirmation is required'),
    })
    .refine((data) => data.new_password === data.confirm_password, {
      message: 'Passwords do not match',
      path: ['confirm_password'],
    }),
});

// Schema for password reset request
export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
  }),
});

// Schema for password reset with token
export const resetPasswordSchema = z.object({
  body: z
    .object({
      token: z.string().min(1, 'Reset token is required'),
      password: z.string().min(8, 'Password must be at least 8 characters'),
      confirm_password: z.string().min(8, 'Password confirmation is required'),
    })
    .refine((data) => data.password === data.confirm_password, {
      message: 'Passwords do not match',
      path: ['confirm_password'],
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
