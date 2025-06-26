/**
 * Authentication Routes
 * Handles user registration, login, token refresh, and related functionality
 */
import express, { Response, Router } from 'express';
import bcryptjs from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db';
import { validate } from '../middleware/validationMiddleware';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  RegisterRequest,
  LoginRequest,
  RefreshTokenRequest,
} from '../validators/authValidators';
import authMiddleware, { AuthenticatedRequest, optionalAuthMiddleware } from '../middleware/authMiddleware';
import logger from '../utils/logger';
import { ApiError } from '../middleware/errorMiddleware';
import config from '../config';
import tokenService from '../services/tokenService';
import tutorialProjectService from '../services/tutorialProjectService';
import { sendPasswordReset } from '../services/emailService';

const router: Router = express.Router();

/**
 * Generates a secure random password
 */
function generateSecurePassword(length: number = 12): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
  const crypto = require('crypto');
  let password = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, chars.length);
    password += chars[randomIndex];
  }
  
  return password;
}

// POST /api/auth/register - Register a new user
router.post('/register', validate(registerSchema), async (req: express.Request, res: Response) => {
  const { email, password, name, preferred_language } = req.body as RegisterRequest;

  try {
    logger.info('Processing user registration request', { email });

    // Check if email already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      logger.warn('Registration attempt with existing email', { email });
      return res.status(409).json({ message: 'Email already in use' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcryptjs.hash(password, saltRounds);

    // Generate new UUID for the user
    const newUserId = uuidv4();
    logger.debug('Generated newUserId for registration', {
      newUserId,
      email,
    });

    // Begin transaction
    await pool.query('BEGIN');
    let userId: string;
    let userEmail: string;
    let userName: string | undefined;

    try {
      // Insert new user
      const result = await pool.query(
        'INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id, email, name, created_at',
        [newUserId, email, passwordHash, name || email.split('@')[0]], // Use part of email as default name if not provided
      );

      userId = result.rows[0].id;
      userEmail = result.rows[0].email;
      userName = result.rows[0].name; // Capture name for token response
      logger.debug('User inserted into DB, obtained userId', {
        userId,
        email: userEmail,
      });

      // Create user profile if preferred_language is provided
      if (preferred_language) {
        await pool.query(
          'INSERT INTO user_profiles (user_id, preferred_language, created_at, updated_at) VALUES ($1, $2, NOW(), NOW())',
          [userId, preferred_language],
        );
      }

      // Commit transaction for user and profile creation
      await pool.query('COMMIT');
      logger.info('User and profile DB transaction committed', {
        userId,
        email: userEmail,
      });
    } catch (error) {
      // Rollback transaction on error
      await pool.query('ROLLBACK');
      logger.error('Error during user/profile DB transaction', {
        error,
        email,
      });
      // Re-throw the error to be caught by the outer catch block
      throw error;
    }

    // Create tutorial project for the new user - AFTER user transaction is committed
    try {
      logger.debug('Attempting to create tutorial project with userId', {
        userIdFromRegistration: userId,
        email: userEmail,
      });
      await tutorialProjectService.createTutorialProject(pool, userId);
      logger.info('Tutorial project creation initiated/completed for new user', { userId });
    } catch (tutorialError) {
      logger.warn('Failed to create tutorial project (non-critical), continuing with registration', {
        error: tutorialError,
        userId,
      });
      // Don't fail registration if tutorial project creation fails
    }

    // Generate tokens
    // Use userEmail and userId obtained before the try-catch for tutorial project
    const tokenResponse = await tokenService.createTokenResponse(userId, userEmail);

    logger.info('User registered successfully', { userId, email: userEmail });
    res.status(201).json({
      user: {
        id: userId,
        email: userEmail,
        name: userName,
        created_at: new Date(),
      }, // Reconstruct user object for response
      ...tokenResponse,
    });
  } catch (error) {
    logger.error('Registration error', { error, email });
    // Ensure that if error originated from DB transaction, it's handled
    // The main DB transaction error is re-thrown and caught here.
    res.status(500).json({
      message: 'Failed to register user',
      error: (error as Error).message,
    });
  }
});

// POST /api/auth/login - Login with email/password
router.post('/login', validate(loginSchema), async (req: express.Request, res: Response) => {
  const { email, password, remember_me } = req.body as LoginRequest;

  try {
    logger.info('Processing login request', { email });

    // Find user by email
    const result = await pool.query('SELECT id, email, name, password_hash, created_at FROM users WHERE email = $1', [
      email,
    ]);

    if (result.rows.length === 0) {
      logger.warn('Login attempt with non-existent email', { email });
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Check password
    const passwordMatch = await bcryptjs.compare(password, user.password_hash);
    if (!passwordMatch) {
      logger.warn('Login attempt with incorrect password', { email });
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate tokens with longer expiry if remember_me is true
    const tokenOptions = remember_me
      ? {
          accessTokenExpiry: '1d',
          refreshTokenExpiry: '30d',
        }
      : {};

    // Generate tokens
    const accessToken = tokenService.generateAccessToken(user.id, user.email);
    const refreshToken = await tokenService.generateRefreshToken(user.id, user.email);

    // Update last login time
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    // Get user profile data if exists
    const profileQuery = `
      SELECT 
        preferred_language, 
        avatar_url,
        theme_preference
      FROM user_profiles
      WHERE user_id = $1
    `;

    const profileRecord = await pool.query(profileQuery, [user.id]);
    const profileData = profileRecord.rows.length > 0 ? profileRecord.rows[0] : {};

    // Remove password_hash from user object
    delete user.password_hash;

    logger.info('User logged in successfully', { userId: user.id, email });
    res.json({
      user: {
        ...user,
        ...profileData,
      },
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
    });
  } catch (error) {
    logger.error('Login error', { error, email });
    res.status(500).json({ message: 'Failed to login', error: (error as Error).message });
  }
});

// POST /api/auth/refresh - Refresh access token using refresh token
router.post('/refresh', validate(refreshTokenSchema), async (req: express.Request, res: Response) => {
  const { refreshToken } = req.body as RefreshTokenRequest;

  try {
    logger.info('Processing token refresh request');

    // Verify refresh token
    const decoded = await tokenService.verifyRefreshToken(refreshToken);

    // Generate new tokens
    const userId = decoded.userId;
    const email = decoded.email;

    // Generate new access token
    const accessToken = tokenService.generateAccessToken(userId, email);

    // Rotate refresh token (revoke old one, create new one)
    const newRefreshToken = await tokenService.rotateRefreshToken(refreshToken, userId, email);

    logger.info('Token refreshed successfully', { userId });
    res.json({
      accessToken,
      refreshToken: newRefreshToken,
      tokenType: 'Bearer',
    });
  } catch (error) {
    logger.warn('Token refresh failed', { error });

    // Provide specific error messages for common failure cases
    if (error instanceof Error) {
      if (error.message.includes('expired')) {
        return res.status(401).json({ message: 'Refresh token expired', code: 'token_expired' });
      } else if (error.message.includes('revoked')) {
        return res.status(401).json({ message: 'Refresh token revoked', code: 'token_revoked' });
      } else if (error.message.includes('not found')) {
        return res.status(401).json({ message: 'Invalid refresh token', code: 'invalid_token' });
      }
    }

    res.status(401).json({ message: 'Invalid refresh token', code: 'invalid_token' });
  }
});

// POST /api/auth/forgot-password - Request password reset
router.post('/forgot-password', validate(forgotPasswordSchema), async (req: express.Request, res: Response) => {
  const { email } = req.body;

  try {
    logger.info('Processing forgot password request', { email });

    // Check if user exists
    const result = await pool.query('SELECT id, name FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      // Don't reveal that email doesn't exist for security
      logger.info('Forgot password request for non-existent email', {
        email,
      });
      return res.status(200).json({
        message: 'If an account with that email exists, a new password has been sent to your email',
      });
    }

    const { id: userId, name } = result.rows[0];

    // Generate new secure password
    const newPassword = generateSecurePassword(12);
    const passwordHash = await bcryptjs.hash(newPassword, 10);

    // Update user's password
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, userId]
    );

    // Revoke all existing refresh tokens for security
    await pool.query(
      'UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1',
      [userId]
    );

    // Send password reset email
    try {
      const emailResult = await sendPasswordReset(email, name, newPassword);
      logger.info('Password reset email sent', { 
        userId, 
        email, 
        testUrl: emailResult.testUrl 
      });
      
      res.json({
        message: 'If an account with that email exists, a new password has been sent to your email',
        // Include test URL for development/testing only
        testUrl: process.env.NODE_ENV === 'development' ? emailResult.testUrl : undefined,
      });
    } catch (emailError) {
      logger.error('Failed to send password reset email', { error: emailError, email, userId });
      // Still return success to not reveal if email exists
      res.json({
        message: 'If an account with that email exists, a new password has been sent to your email',
      });
    }
  } catch (error) {
    logger.error('Forgot password error', { error, email });
    res.status(500).json({ message: 'Failed to process password reset request' });
  }
});

// POST /api/auth/reset-password - Reset password with token (deprecated - now using direct password reset)
router.post('/reset-password', validate(resetPasswordSchema), async (req: express.Request, res: Response) => {
  const { token, password } = req.body;

  try {
    logger.info('Processing password reset request');

    // Get all non-expired tokens (we'll check them one by one)
    const result = await pool.query(
      'SELECT id, user_id, token_hash FROM password_reset_tokens WHERE expires_at > NOW()',
    );

    if (result.rows.length === 0) {
      logger.warn('No valid reset tokens found');
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    let tokenValid = false;
    let userId = null;
    let tokenId = null;

    // Check each token
    for (const row of result.rows) {
      const isMatch = await bcryptjs.compare(token, row.token_hash);
      if (isMatch) {
        tokenValid = true;
        userId = row.user_id;
        tokenId = row.id;
        break;
      }
    }

    if (!tokenValid || !userId) {
      logger.warn('Invalid reset token provided');
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    // Hash new password
    const passwordHash = await bcryptjs.hash(password, 10);

    // Update password and invalidate token
    await pool.query('BEGIN');
    try {
      await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, userId]);
      await pool.query('DELETE FROM password_reset_tokens WHERE id = $1', [tokenId]);

      // Revoke all refresh tokens for this user for security
      await tokenService.revokeAllUserTokens(userId);

      await pool.query('COMMIT');

      logger.info('Password reset successful', { userId });
      res.json({ message: 'Password has been reset successfully' });
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    logger.error('Password reset error', { error });
    res.status(500).json({ message: 'Failed to reset password' });
  }
});

// POST /api/auth/logout - Invalidate refresh token on logout
router.post('/logout', optionalAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { refreshToken } = req.body;
  const userId = req.user?.userId;

  try {
    // If we have a refresh token, invalidate it
    if (refreshToken) {
      try {
        // Try to get the token ID from the refresh token
        const [, jti] = refreshToken.split('.');

        if (jti) {
          // Revoke the specific token
          await pool.query('UPDATE refresh_tokens SET is_revoked = true, updated_at = NOW() WHERE token_id = $1', [
            jti,
          ]);
          logger.info('Refresh token revoked on logout', { jti });
        }
      } catch (error) {
        logger.warn('Failed to parse refresh token during logout', { error });
        // Continue logout process even if token revocation fails
      }
    }

    // If we have a user ID, log that the user logged out
    if (userId) {
      logger.info('User logged out', { userId });
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error', { error, userId });
    // Still return success to client - even if DB operation failed, the client
    // will discard tokens so the user is effectively logged out
    res.json({ message: 'Logged out successfully' });
  }
});

// POST /api/auth/revoke - Revoke all refresh tokens for current user
router.post('/revoke', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    logger.info('Revoking all refresh tokens for user', { userId });

    // Revoke all refresh tokens for this user
    await tokenService.revokeAllUserTokens(userId);

    res.json({ message: 'All sessions revoked successfully' });
  } catch (error) {
    logger.error('Error revoking sessions', { error, userId });
    res.status(500).json({ message: 'Failed to revoke sessions' });
  }
});

// GET /api/auth/check-email - Check if email exists in the system
router.get('/check-email', async (req: express.Request, res: Response) => {
  const { email } = req.query;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ 
      exists: false, 
      error: 'Email parameter is required' 
    });
  }

  try {
    logger.info('Checking email existence', { email });

    // Check if email exists in users table
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    const exists = userResult.rows.length > 0;

    // Try to check access requests table, but handle if it doesn't exist
    let hasAccessRequest = false;
    try {
      const accessRequestResult = await pool.query('SELECT id FROM access_requests WHERE email = $1', [email]);
      hasAccessRequest = accessRequestResult.rows.length > 0;
    } catch (accessRequestError: any) {
      // If access_requests table doesn't exist, log and continue
      if (accessRequestError.code === '42P01') { // relation does not exist
        logger.debug('access_requests table does not exist, skipping check', { email });
      } else {
        logger.warn('Error checking access_requests table', { error: accessRequestError, email });
      }
    }

    res.json({ 
      exists,
      hasAccessRequest,
      message: exists 
        ? 'Email is already registered' 
        : hasAccessRequest 
          ? 'Email has pending access request'
          : 'Email is available'
    });
  } catch (error) {
    logger.error('Error checking email existence', { error, email });
    res.status(500).json({ 
      exists: false, 
      error: 'Failed to check email' 
    });
  }
});

// GET /api/auth/me - Get current user (useful for token verification)
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    logger.info('Fetching current user data', { userId });

    // Get user data
    const userResult = await pool.query('SELECT id, email, name, created_at FROM users WHERE id = $1', [userId]);

    if (userResult.rows.length === 0) {
      logger.warn('User not found in database', { userId });
      return res.status(404).json({ message: 'User not found' });
    }

    // Get profile data
    const profileQuery = `
      SELECT 
        username, 
        full_name, 
        title, 
        organization, 
        bio, 
        location, 
        preferred_language, 
        avatar_url,
        theme_preference
      FROM user_profiles
      WHERE user_id = $1
    `;

    const profileResult = await pool.query(profileQuery, [userId]);
    const profileData = profileResult.rows.length > 0 ? profileResult.rows[0] : {};

    // Return combined data
    res.json({
      ...userResult.rows[0],
      ...profileData,
    });
  } catch (error) {
    logger.error('Error fetching current user', { error, userId });
    res.status(500).json({ message: 'Failed to fetch user data' });
  }
});

export default router;
