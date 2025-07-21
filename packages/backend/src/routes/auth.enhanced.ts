/**
 * Enhanced Authentication Routes
 * Handles user registration, login, token refresh with enhanced validation and sanitization
 */
import * as express from 'express';
import { Response, Router, RequestHandler } from 'express';
import { z } from 'zod';
import {
  validateRequestBody,
  validateRequestQuery,
  rateLimitByIP,
  validateContentType,
  sanitizeRequest,
} from '../middleware/enhancedValidation';
import {
  userRegistrationSchema,
  emailSchema,
  passwordSchema,
  createTextSchema,
} from '@spheroseg/shared/src/validation/enhancedValidation';
import {
  authenticate as authMiddleware,
  AuthenticatedRequest,
  optionalAuthenticate as optionalAuthMiddleware,
} from '../security/middleware/auth';
import logger from '../utils/logger';
import { ApiError } from '../utils/errors';
import authService from '../services/authService';

// Extend Express Request to include validated data
interface ValidatedRequest<T = any> extends express.Request {
  validatedBody: T;
  validatedQuery?: any;
}

// Helper function to create type-safe handlers
const createHandler = <T = any>(
  handler: (req: ValidatedRequest<T>, res: Response) => Promise<express.Response | void>
): RequestHandler => {
  return async (req: express.Request, res: Response) => {
    try {
      await handler(req as ValidatedRequest<T>, res);
    } catch (error) {
      logger.error('Route handler error:', { error });
      if (!res.headersSent) {
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  };
};

const router: Router = express.Router();

// ===========================
// Enhanced Validation Schemas
// ===========================

// Registration schema with enhanced validation and sanitization
const registerValidationSchema = userRegistrationSchema.extend({
  preferred_language: createTextSchema({
    minLength: 2,
    maxLength: 5,
    allowHtml: false,
    required: false,
  }),
}).transform((data) => ({
  ...data,
  name: `${data.firstName} ${data.lastName}`.trim(),
}));

// Login schema with enhanced validation
const loginValidationSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  remember_me: z.boolean().optional(),
});

// Password change schema
const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Current password is required'),
    new_password: passwordSchema,
    confirm_password: z.string(),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Passwords don't match",
    path: ['confirm_password'],
  });

// Forgot password schema
const forgotPasswordSchema = z.object({
  email: emailSchema,
});

// Reset password schema
const resetPasswordSchema = z
  .object({
    token: createTextSchema({
      minLength: 10,
      maxLength: 200,
      allowHtml: false,
    }),
    password: passwordSchema,
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords don't match",
    path: ['confirm_password'],
  });

// Refresh token schema
const refreshTokenSchema = z.object({
  refreshToken: createTextSchema({
    minLength: 10,
    maxLength: 500,
    allowHtml: false,
  }),
});

// Delete account schema
const deleteAccountSchema = z.object({
  username: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

// Email verification schemas
const sendVerificationEmailSchema = z.object({
  email: emailSchema,
});

const verifyEmailSchema = z.object({
  token: createTextSchema({
    minLength: 10,
    maxLength: 200,
    allowHtml: false,
  }),
});

// ===========================
// Security Middleware
// ===========================

// Apply rate limiting to all auth routes
router.use(rateLimitByIP(50, 15 * 60 * 1000)); // 50 requests per 15 minutes

// Apply request sanitization
router.use(sanitizeRequest());

// Apply content type validation for POST routes
router.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    return validateContentType(['application/json'])(req, res, next);
  }
  next();
});

// ===========================
// Routes
// ===========================

// GET /api/auth/test - Test route
router.get('/test', (_req: express.Request, res: Response) => {
  logger.info('Enhanced auth test route hit');
  res.json({
    message: 'Enhanced auth routes are working',
    features: [
      'Input sanitization',
      'Enhanced validation',
      'Rate limiting',
      'CSRF protection',
      'Content type validation',
    ],
  });
});

// POST /api/auth/register - Register a new user with enhanced validation
router.post(
  '/register',
  validateRequestBody(registerValidationSchema),
  createHandler<z.infer<typeof registerValidationSchema>>(async (req, res) => {
    const validatedData = req.validatedBody;
    
    if (!validatedData) {
      return res.status(400).json({ message: 'Invalid request data' });
    }
    
    logger.info('Enhanced register endpoint hit', {
      email: validatedData.email,
      hasName: !!validatedData.name,
    });

    const { email, password, name, preferred_language } = validatedData;

    try {
      const result = await authService.registerUser(email, password, name, preferred_language);
      return res.status(201).json(result);
    } catch (error) {
      logger.error('Registration error', { error, email });
      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({ message: error.message, code: error.code });
      }
      return res.status(500).json({ message: 'Failed to register user' });
    }
  })
);

// POST /api/auth/login - Login with enhanced validation
router.post(
  '/login',
  validateRequestBody(loginValidationSchema),
  async (req: express.Request, res: Response) => {
    const validatedData = (req as ValidatedRequest<z.infer<typeof loginValidationSchema>>).validatedBody;
    
    if (!validatedData) {
      return res.status(400).json({ message: 'Invalid request data' });
    }
    
    const { email, password, remember_me: rememberMe } = validatedData;

    try {
      const result = await authService.loginUser(email, password, rememberMe);
      return res.json(result);
    } catch (error) {
      logger.error('Login error', { error, email });
      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({ message: error.message, code: error.code });
      }
      return res.status(500).json({ message: 'Failed to login' });
    }
  }
);

// POST /api/auth/refresh - Refresh access token
router.post(
  '/refresh',
  validateRequestBody(refreshTokenSchema),
  async (req: express.Request, res: Response) => {
    const validatedData = (req as ValidatedRequest<z.infer<typeof refreshTokenSchema>>).validatedBody;
    const { refreshToken } = validatedData;

    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }

    try {
      const result = await authService.refreshAccessToken(refreshToken);
      return res.json(result);
    } catch (error) {
      logger.warn('Token refresh failed', { error });
      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({ message: error.message, code: error.code });
      }
      return res.status(500).json({ message: 'Invalid refresh token' });
    }
  }
);

// POST /api/auth/forgot-password - Request password reset
router.post(
  '/forgot-password',
  validateRequestBody(forgotPasswordSchema),
  async (req: express.Request, res: Response) => {
    const validatedData = (req as ValidatedRequest<z.infer<typeof forgotPasswordSchema>>).validatedBody;
    const { email } = validatedData;

    try {
      await authService.forgotPassword(email);
      return res.json({
        message: 'A new password has been sent to your email',
        success: true,
      });
    } catch (error) {
      logger.error('Forgot password error', { error, email });
      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({ message: error.message, code: error.code });
      }
      return res.status(500).json({ message: 'Failed to process password reset request' });
    }
  }
);

// POST /api/auth/reset-password - Reset password with enhanced validation
router.post(
  '/reset-password',
  validateRequestBody(resetPasswordSchema),
  async (req: express.Request, res: Response) => {
    const validatedData = (req as ValidatedRequest<z.infer<typeof resetPasswordSchema>>).validatedBody;
    const { token, password } = validatedData;

    if (!token || !password) {
      return res.status(400).json({ message: 'Token and password are required' });
    }

    try {
      await authService.resetPassword(token, password);
      return res.json({ message: 'Password has been reset successfully' });
    } catch (error) {
      logger.error('Password reset error', { error });
      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({ message: error.message, code: error.code });
      }
      return res.status(500).json({ message: 'Failed to reset password' });
    }
  }
);

// POST /api/auth/logout - Invalidate refresh token on logout
router.post('/logout', optionalAuthMiddleware, async (req: express.Request, res: Response) => {
  const authenticatedReq = req as AuthenticatedRequest;
  const { refreshToken } = req.body;
  const userId = authenticatedReq.user?.userId;

  try {
    await authService.logoutUser(refreshToken, userId);
    return res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error', { error, userId });
    // Still return success to client
    return res.json({ message: 'Logged out successfully' });
  }
});

// POST /api/auth/revoke - Revoke all refresh tokens
router.post('/revoke', authMiddleware, async (req: express.Request, res: Response) => {
  const authenticatedReq = req as AuthenticatedRequest;
  const userId = authenticatedReq.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: 'User not authenticated' });
  }

  try {
    await authService.revokeAllUserTokens(userId);
    return res.json({ message: 'All sessions revoked successfully' });
  } catch (error) {
    logger.error('Error revoking sessions', { error, userId });
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    return res.status(500).json({ message: 'Failed to revoke sessions' });
  }
});

// GET /api/auth/check-email - Check if email exists with validation
router.get(
  '/check-email',
  validateRequestQuery(z.object({ email: emailSchema })),
  async (req: express.Request, res: Response) => {
    const validatedData = (req as ValidatedRequest).validatedQuery as { email: string };
    const { email } = validatedData;

    try {
      const { exists, hasAccessRequest } = await authService.checkEmailExists(email);
      return res.json({
        exists,
        hasAccessRequest,
        message: exists
          ? 'Email is already registered'
          : hasAccessRequest
            ? 'Email has pending access request'
            : 'Email is available',
      });
    } catch (error) {
      logger.error('Error checking email existence', { error, email });
      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({ message: error.message, code: error.code });
      }
      return res.status(500).json({
        exists: false,
        error: 'Failed to check email',
      });
    }
  }
);

// GET /api/auth/me - Get current user
router.get('/me', authMiddleware, async (req: express.Request, res: Response) => {
  const authenticatedReq = req as AuthenticatedRequest;
  const userId = authenticatedReq.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const user = await authService.getCurrentUser(userId);
    return res.json(user);
  } catch (error) {
    logger.error('Error fetching current user', { error, userId });
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    return res.status(500).json({ message: 'Failed to fetch user data' });
  }
});

// PUT /api/auth/change-password - Change password with enhanced validation
router.put(
  '/change-password',
  authMiddleware,
  validateRequestBody(changePasswordSchema),
  async (req: express.Request, res: Response) => {
    const authenticatedReq = req as AuthenticatedRequest;
    const validatedData = (req as ValidatedRequest<z.infer<typeof changePasswordSchema>>).validatedBody;
    const { current_password, new_password } = validatedData;
    const userId = authenticatedReq.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    try {
      await authService.changePassword(userId, current_password, new_password);
      return res.json({ message: 'Password changed successfully' });
    } catch (error) {
      logger.error('Error changing password', { error, userId });
      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({ message: error.message, code: error.code });
      }
      return res.status(500).json({ message: 'Failed to change password' });
    }
  }
);

// DELETE /api/auth/account - Delete account with enhanced validation
router.delete(
  '/account',
  authMiddleware,
  validateRequestBody(deleteAccountSchema),
  async (req: express.Request, res: Response) => {
    const authenticatedReq = req as AuthenticatedRequest;
    const validatedData = (req as ValidatedRequest<z.infer<typeof deleteAccountSchema>>).validatedBody;
    const { username, password } = validatedData;
    const userId = authenticatedReq.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    try {
      await authService.deleteAccount(userId, username, password);
      return res.json({ message: 'Account deleted successfully' });
    } catch (error) {
      logger.error('Error deleting account', { error, userId });
      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({ message: error.message, code: error.code });
      }
      return res.status(500).json({ message: 'Failed to delete account' });
    }
  }
);

// POST /api/auth/send-verification-email - Send verification email
router.post(
  '/send-verification-email',
  validateRequestBody(sendVerificationEmailSchema),
  async (req: express.Request, res: Response) => {
    const validatedData = (req as ValidatedRequest<z.infer<typeof sendVerificationEmailSchema>>).validatedBody;
    const { email } = validatedData;

    try {
      await authService.sendVerificationEmail(email);
      return res.json({ message: 'Verification email sent successfully' });
    } catch (error) {
      logger.error('Error sending verification email', { error, email });
      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({ message: error.message, code: error.code });
      }
      return res.status(500).json({ message: 'Failed to send verification email' });
    }
  }
);

// GET /api/auth/verify-email - Verify email with enhanced validation
router.get(
  '/verify-email',
  validateRequestQuery(verifyEmailSchema),
  async (req: express.Request, res: Response) => {
    const validatedData = (req as ValidatedRequest).validatedQuery as z.infer<typeof verifyEmailSchema>;
    const { token } = validatedData;

    try {
      await authService.verifyEmail(token);
      return res.json({ message: 'Email verified successfully' });
    } catch (error) {
      logger.error('Error verifying email', { error });
      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({ message: error.message, code: error.code });
      }
      return res.status(500).json({ message: 'Failed to verify email' });
    }
  }
);

export default router;
