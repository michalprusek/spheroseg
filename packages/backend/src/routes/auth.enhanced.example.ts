/**
 * Example Authentication Routes with Enhanced Error Handling
 * 
 * This demonstrates how to use the new structured error handling
 * in authentication routes.
 */

import express, { Router } from 'express';
import { ApiError } from '../utils/ApiError.enhanced';
import { asyncHandler } from '../middleware/errorHandler.enhanced';
import authService from '../services/authService';
import { validate } from '../middleware/validationMiddleware';
import { loginSchema, registerSchema } from '../validators/authValidators';
import logger from '../utils/logger';

const router: Router = express.Router();

/**
 * Login endpoint with structured error handling
 */
router.post('/login', 
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const context = {
      requestId: req.id,
      action: 'login',
      metadata: { email },
    };

    try {
      // Attempt login
      const result = await authService.login(email, password);
      
      if (!result) {
        // Invalid credentials
        throw ApiError.invalidCredentials(context);
      }

      // Check if account is active
      if (result.user.status === 'disabled') {
        throw ApiError.accountDisabled({
          ...context,
          userId: result.user.id,
        });
      }

      // Check if email is verified
      if (!result.user.emailVerified) {
        throw ApiError.emailNotVerified({
          ...context,
          userId: result.user.id,
        });
      }

      // Success
      logger.info('User logged in successfully', {
        userId: result.user.id,
        requestId: req.id,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      // Re-throw ApiErrors, wrap others
      if (error instanceof ApiError) {
        throw error;
      }
      
      // Check for rate limiting
      if (error.message?.includes('rate limit')) {
        throw ApiError.tooManyAttempts(context);
      }

      // Generic auth error
      throw ApiError.internalError('Authentication failed', error as Error, context);
    }
  })
);

/**
 * Register endpoint with validation error handling
 */
router.post('/register',
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { email, password, username } = req.body;
    const context = {
      requestId: req.id,
      action: 'register',
      metadata: { email, username },
    };

    try {
      // Check if user exists
      const existingUser = await authService.findUserByEmail(email);
      if (existingUser) {
        throw ApiError.duplicateValue('email', email, context);
      }

      // Check username availability
      const existingUsername = await authService.findUserByUsername(username);
      if (existingUsername) {
        throw ApiError.duplicateValue('username', username, context);
      }

      // Validate password strength
      if (!authService.isPasswordStrong(password)) {
        throw ApiError.validationError(
          'Password does not meet requirements',
          [
            {
              field: 'password',
              constraint: 'strength',
              message: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character',
            },
          ],
          context
        );
      }

      // Create user
      const user = await authService.createUser({
        email,
        password,
        username,
      });

      logger.info('User registered successfully', {
        userId: user.id,
        requestId: req.id,
      });

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
          },
          message: 'Registration successful. Please check your email to verify your account.',
        },
      });
    } catch (error) {
      // Database constraint errors
      if (error.code === '23505') { // PostgreSQL unique violation
        const field = error.detail?.includes('email') ? 'email' : 'username';
        throw ApiError.duplicateValue(field, req.body[field], context);
      }

      // Re-throw ApiErrors
      if (error instanceof ApiError) {
        throw error;
      }

      // Generic error
      throw ApiError.internalError('Registration failed', error as Error, context);
    }
  })
);

/**
 * Token refresh with proper error codes
 */
router.post('/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    const context = {
      requestId: req.id,
      action: 'refresh_token',
    };

    if (!refreshToken) {
      throw ApiError.requiredField('refreshToken', context);
    }

    try {
      const result = await authService.refreshToken(refreshToken);
      
      if (!result) {
        throw ApiError.tokenInvalid(context);
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw ApiError.tokenExpired(context);
      }
      
      if (error.name === 'JsonWebTokenError') {
        throw ApiError.tokenInvalid(context);
      }

      if (error instanceof ApiError) {
        throw error;
      }

      throw ApiError.internalError('Token refresh failed', error as Error, context);
    }
  })
);

/**
 * Logout with session handling
 */
router.post('/logout',
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.id;
    const context = {
      requestId: req.id,
      userId,
      action: 'logout',
    };

    try {
      if (userId) {
        await authService.logout(userId);
        
        logger.info('User logged out', {
          userId,
          requestId: req.id,
        });
      }

      // Clear session
      req.session?.destroy((err) => {
        if (err) {
          logger.error('Session destruction failed', {
            error: err,
            ...context,
          });
        }
      });

      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      // Log but don't fail logout
      logger.error('Logout error', {
        error,
        ...context,
      });

      // Still return success
      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    }
  })
);

/**
 * Password reset request
 */
router.post('/forgot-password',
  asyncHandler(async (req, res) => {
    const { email } = req.body;
    const context = {
      requestId: req.id,
      action: 'forgot_password',
      metadata: { email },
    };

    if (!email) {
      throw ApiError.requiredField('email', context);
    }

    try {
      // Always return success to prevent user enumeration
      await authService.requestPasswordReset(email);
      
      res.json({
        success: true,
        message: 'If an account exists with this email, you will receive password reset instructions.',
      });
    } catch (error) {
      // Log error but don't expose it
      logger.error('Password reset request failed', {
        error,
        ...context,
      });

      // Still return success to prevent enumeration
      res.json({
        success: true,
        message: 'If an account exists with this email, you will receive password reset instructions.',
      });
    }
  })
);

export default router;