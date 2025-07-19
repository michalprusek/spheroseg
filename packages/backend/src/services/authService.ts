import db from '../db';
import bcryptjs from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import logger from '../utils/logger';
import { ApiError } from '../utils/errors';
import tokenService from './tokenService';
import { sendPasswordReset } from './emailService';
import config from '../config';
import { cacheService, CACHE_TTL } from './cacheService';

// Response type interfaces
interface RegisterResponse {
  user: {
    id: string;
    email: string;
    name: string;
    created_at: Date;
  };
  accessToken: string;
  refreshToken: string;
  tokenType: string;
}

interface LoginResponse {
  user: {
    id: string;
    email: string;
    name: string;
    created_at: Date;
    updated_at: Date;
    [key: string]: unknown; // For profile data
  };
  accessToken: string;
  refreshToken: string;
  tokenType: string;
}

interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
}

interface UserResponse {
  id: string;
  email: string;
  name: string;
  created_at: Date;
  updated_at: Date;
  [key: string]: unknown; // For profile data
}

class AuthService {
  /**
   * Registers a new user.
   * @param email User's email
   * @param password User's password
   * @param name User's name (optional)
   * @param preferred_language User's preferred language (optional)
   * @returns User object and tokens
   */
  public async registerUser(
    email: string,
    password: string,
    name?: string,
    preferred_language?: string
  ): Promise<RegisterResponse> {
    logger.info('Processing user registration request', { email });

    let client;
    try {
      client = await db.getPool().connect();
    } catch (dbError) {
      logger.error('Failed to connect to database', { error: dbError });
      throw new ApiError('Database connection failed', 500);
    }
    try {
      // Check if email already exists
      const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingUser.rows.length > 0) {
        logger.warn('Registration attempt with existing email', { email });
        throw new ApiError('Email already in use', 409);
      }

      // Hash password
      const saltRounds = config.auth.saltRounds;
      const passwordHash = await bcryptjs.hash(password, saltRounds);

      // Generate new UUID for the user
      const newUserId = uuidv4();
      logger.debug('Generated newUserId for registration', {
        newUserId,
        email,
      });

      await client.query('BEGIN');

      // Insert new user
      const result = await client.query(
        'INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id, email, name, created_at',
        [newUserId, email, passwordHash, name || email.split('@')[0]]
      );

      const userId = result.rows[0].id;
      const userEmail = result.rows[0].email;
      const userName = result.rows[0].name;
      logger.debug('User inserted into DB, obtained userId', {
        userId,
        email: userEmail,
      });

      // Create user profile if preferred_language is provided
      if (preferred_language) {
        await client.query(
          'INSERT INTO user_profiles (user_id, preferred_language, created_at, updated_at) VALUES ($1, $2, NOW(), NOW())',
          [userId, preferred_language]
        );
      }

      await client.query('COMMIT');
      logger.info('User and profile DB transaction committed', {
        userId,
        email: userEmail,
      });

      // Generate tokens
      const tokenResponse = await tokenService.createTokenResponse(userId, userEmail);

      logger.info('User registered successfully', { userId, email: userEmail });

      // Send verification email asynchronously
      this.sendVerificationEmail(userEmail).catch((error) => {
        logger.error('Failed to send verification email after registration', {
          error,
          email: userEmail,
        });
        // Don't throw error here - user is already registered
      });

      return {
        user: {
          id: userId,
          email: userEmail,
          name: userName,
          created_at: new Date(),
        },
        ...tokenResponse,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Registration error', { error, email });
      throw new ApiError(
        'Failed to register user',
        500,
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      client.release();
    }
  }

  /**
   * Logs in a user.
   * @param email User's email
   * @param password User's password
   * @param remember_me Whether to remember the user (longer token expiry)
   * @returns User object and tokens
   */
  public async loginUser(
    email: string,
    password: string,
    remember_me?: boolean
  ): Promise<LoginResponse> {
    logger.info('Processing login request', { email });

    const client = await db.getPool().connect();
    try {
      // Find user by email
      const result = await client.query(
        'SELECT id, email, name, password_hash, created_at FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        logger.warn('Login attempt with non-existent email', { email });
        throw new ApiError(
          'This email address is not registered. Please check your email or sign up for a new account.',
          404
        );
      }

      const user = result.rows[0];

      // Check password
      const passwordMatch = await bcryptjs.compare(password, user.password_hash);
      if (!passwordMatch) {
        logger.warn('Login attempt with incorrect password', { email });
        throw new ApiError('Incorrect password. Please check your password and try again.', 401);
      }

      // Generate tokens with longer expiry if remember_me is true
      const tokenOptions = remember_me
        ? {
            accessTokenExpiry: '1d',
            refreshTokenExpiry: '30d',
          }
        : {};

      // Generate tokens
      const accessToken = tokenService.generateAccessToken(
        user.id,
        user.email,
        tokenOptions.accessTokenExpiry
      );
      const refreshToken = await tokenService.generateRefreshToken(
        user.id,
        user.email,
        tokenOptions.refreshTokenExpiry
      );

      // Update last login time
      await client.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

      // Get user profile data if exists
      const profileQuery = `
        SELECT 
          preferred_language, 
          avatar_url,
          theme_preference
        FROM user_profiles
        WHERE user_id = $1
      `;

      const profileRecord = await client.query(profileQuery, [user.id]);
      const profileData = profileRecord.rows.length > 0 ? profileRecord.rows[0] : {};

      // Remove password_hash from user object
      delete user.password_hash;

      logger.info('User logged in successfully', { userId: user.id, email });
      return {
        user: {
          ...user,
          ...profileData,
        },
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
      };
    } catch (error) {
      logger.error('Login error', { error, email });
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'Failed to login',
        500,
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      client.release();
    }
  }

  /**
   * Refreshes an access token using a refresh token.
   * @param refreshToken The refresh token
   * @returns New access token and refresh token
   */
  public async refreshAccessToken(refreshToken: string): Promise<RefreshTokenResponse> {
    logger.info('Processing token refresh request');

    try {
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
      return {
        accessToken,
        refreshToken: newRefreshToken,
        tokenType: 'Bearer',
      };
    } catch (error) {
      logger.warn('Token refresh failed', { error });

      if (error instanceof Error) {
        if (error.message.includes('expired')) {
          throw new ApiError('Refresh token expired', 401, 'token_expired');
        } else if (error.message.includes('revoked')) {
          throw new ApiError('Refresh token revoked', 401, 'token_revoked');
        } else if (error.message.includes('not found')) {
          throw new ApiError('Invalid refresh token', 401, 'invalid_token');
        }
      }
      throw new ApiError(
        'Invalid refresh token',
        401,
        'invalid_token',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Handles forgot password request.
   * Generates a new password and sends it to the user's email.
   * @param email User's email
   */
  public async forgotPassword(email: string): Promise<void> {
    logger.info('Processing forgot password request', { email });

    const client = await db.getPool().connect();
    try {
      // Check if user exists
      const result = await client.query('SELECT id, name FROM users WHERE email = $1', [email]);
      if (result.rows.length === 0) {
        logger.info('Forgot password request for non-existent email', {
          email,
        });
        throw new ApiError('No account found with this email address', 404, 'USER_NOT_FOUND');
      }

      const { id: userId, name } = result.rows[0];

      // Generate new secure password
      const newPassword = this.generateSecurePassword(12);
      const passwordHash = await bcryptjs.hash(newPassword, config.auth.saltRounds);

      // Update user's password
      await client.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
        passwordHash,
        userId,
      ]);

      // Revoke all existing refresh tokens for security
      await client.query('UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1', [
        userId,
      ]);

      // Send password reset email
      try {
        const emailResult = await sendPasswordReset(email, name, newPassword);
        logger.info('Password reset email sent', {
          userId,
          email,
          testUrl: emailResult.testUrl,
        });
      } catch (emailError) {
        logger.error('Failed to send password reset email', { error: emailError, email, userId });
        // Still return success to not reveal if email exists
      }
    } catch (error) {
      logger.error('Forgot password error', { error, email });
      throw new ApiError(
        'Failed to process password reset request',
        500,
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      client.release();
    }
  }

  /**
   * Resets user password using a token.
   * @param token Reset token
   * @param newPassword New password
   */
  public async resetPassword(token: string, newPassword: string): Promise<void> {
    logger.info('Processing password reset request');

    const client = await db.getPool().connect();
    try {
      // Get all non-expired tokens (we'll check them one by one)
      const result = await client.query(
        'SELECT id, user_id, token_hash FROM password_reset_tokens WHERE expires_at > NOW()'
      );

      if (result.rows.length === 0) {
        logger.warn('No valid reset tokens found');
        throw new ApiError('Invalid or expired reset token', 400);
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
        throw new ApiError('Invalid or expired reset token', 400);
      }

      // Hash new password
      const passwordHash = await bcryptjs.hash(newPassword, config.auth.saltRounds);

      // Update password and invalidate token
      await client.query('BEGIN');
      try {
        await client.query(
          'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
          [passwordHash, userId]
        );
        await client.query('DELETE FROM password_reset_tokens WHERE id = $1', [tokenId]);

        // Revoke all refresh tokens for this user for security
        await tokenService.revokeAllUserTokens(userId);

        await client.query('COMMIT');

        logger.info('Password reset successful', { userId });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      logger.error('Password reset error', { error });
      throw new ApiError(
        'Failed to reset password',
        500,
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      client.release();
    }
  }

  /**
   * Logs out a user by invalidating their refresh token.
   * @param refreshToken The refresh token to invalidate (optional)
   * @param userId The ID of the user logging out (optional, from auth middleware)
   */
  public async logoutUser(refreshToken?: string, userId?: string): Promise<void> {
    try {
      // If we have a refresh token, invalidate it
      if (refreshToken) {
        try {
          // Try to get the token ID from the refresh token
          const [, jti] = refreshToken.split('.');

          if (jti) {
            // Revoke the specific token
            await db.query(
              'UPDATE refresh_tokens SET is_revoked = true, updated_at = NOW() WHERE token_id = $1',
              [jti]
            );
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
    } catch (error) {
      logger.error('Logout error', { error, userId });
      // Still return success to client - even if DB operation failed, the client
      // will discard tokens so the user is effectively logged out
    }
  }

  /**
   * Revokes all refresh tokens for a given user.
   * @param userId The ID of the user
   */
  public async revokeAllUserTokens(userId: string): Promise<void> {
    if (!userId) {
      throw new ApiError('User ID is required', 400);
    }

    try {
      logger.info('Revoking all refresh tokens for user', { userId });
      await tokenService.revokeAllUserTokens(userId);
    } catch (error) {
      logger.error('Error revoking sessions', { error, userId });
      throw new ApiError(
        'Failed to revoke sessions',
        500,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Checks if an email exists in the system.
   * @param email The email to check
   * @returns Object indicating if email exists and if there's a pending access request
   */
  public async checkEmailExists(
    email: string
  ): Promise<{ exists: boolean; hasAccessRequest: boolean }> {
    logger.info('Checking email existence', { email });

    const client = await db.getPool().connect();
    try {
      // Check if email exists in users table
      const userResult = await client.query('SELECT id FROM users WHERE email = $1', [email]);
      const exists = userResult.rows.length > 0;

      // Try to check access requests table, but handle if it doesn't exist
      let hasAccessRequest = false;
      try {
        const accessRequestResult = await client.query(
          'SELECT id FROM access_requests WHERE email = $1',
          [email]
        );
        hasAccessRequest = accessRequestResult.rows.length > 0;
      } catch (accessRequestError) {
        if (
          accessRequestError instanceof Error &&
          (accessRequestError as { code?: string }).code === '42P01'
        ) {
          logger.debug('access_requests table does not exist, skipping check', { email });
        } else {
          logger.warn('Error checking access_requests table', { error: accessRequestError, email });
        }
      }

      return { exists, hasAccessRequest };
    } catch (error) {
      logger.error('Error checking email existence', { error, email });
      throw new ApiError(
        'Failed to check email',
        500,
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      client.release();
    }
  }

  /**
   * Gets current user data.
   * @param userId The ID of the authenticated user
   * @returns User data including profile information
   */
  public async getCurrentUser(userId: string): Promise<UserResponse> {
    if (!userId) {
      throw new ApiError('User ID is required', 400);
    }

    // Try to get from cache first
    const cacheKey = cacheService.generateKey('user:current:', userId);
    const cached = await cacheService.get<UserResponse>(cacheKey);
    
    if (cached) {
      logger.debug('Current user data retrieved from cache', { userId });
      return cached;
    }

    logger.info('Fetching current user data from database', { userId });

    const client = await db.getPool().connect();
    try {
      // Get user data
      const userResult = await client.query(
        'SELECT id, email, name, created_at FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        logger.warn('User not found in database', { userId });
        throw new ApiError('User not found', 404);
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

      const profileResult = await client.query(profileQuery, [userId]);
      const profileData = profileResult.rows.length > 0 ? profileResult.rows[0] : {};

      // Return combined data
      const userData = {
        ...userResult.rows[0],
        ...profileData,
      };

      // Cache the result
      await cacheService.set(cacheKey, userData, CACHE_TTL.MEDIUM);

      return userData;
    } catch (error) {
      logger.error('Error fetching current user', { error, userId });
      throw new ApiError(
        'Failed to fetch user data',
        500,
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      client.release();
    }
  }

  /**
   * Changes user password.
   * @param userId The ID of the user
   * @param currentPassword Current password
   * @param newPassword New password
   */
  public async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    if (!userId) {
      throw new ApiError('User ID is required', 400);
    }

    logger.info('Processing password change request', { userId });

    const client = await db.getPool().connect();
    try {
      // Get current user data
      const userResult = await client.query(
        'SELECT id, email, password_hash FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new ApiError('User not found', 404);
      }

      const user = userResult.rows[0];

      // Verify current password
      const isCurrentPasswordValid = await bcryptjs.compare(currentPassword, user.password_hash);
      if (!isCurrentPasswordValid) {
        logger.warn('Invalid current password provided', { userId });
        throw new ApiError('Current password is incorrect', 400);
      }

      // Hash new password
      const newPasswordHash = await bcryptjs.hash(newPassword, config.auth.saltRounds);

      // Update password in database
      await client.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
        newPasswordHash,
        userId,
      ]);

      // Revoke all existing refresh tokens for security
      await client.query('UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1', [
        userId,
      ]);

      // Invalidate user cache since password has changed
      await cacheService.invalidateRelated('user', userId);

      logger.info('Password changed successfully', { userId });
    } catch (error) {
      logger.error('Error changing password', { error, userId });
      throw new ApiError(
        'Failed to change password',
        500,
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      client.release();
    }
  }

  /**
   * Deletes a user account.
   * @param userId The ID of the user to delete
   * @param username The username (email) for confirmation
   * @param password The password for confirmation
   */
  public async deleteAccount(userId: string, username: string, password: string): Promise<void> {
    if (!userId) {
      throw new ApiError('User ID is required', 400);
    }

    logger.info('Processing account deletion request', { userId });

    const client = await db.getPool().connect();
    try {
      // Get current user data
      const userResult = await client.query(
        'SELECT id, email, password_hash FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new ApiError('User not found', 404);
      }

      const user = userResult.rows[0];

      // Verify email confirmation
      if (username !== user.email) {
        logger.warn('Email confirmation failed', { userId, providedEmail: username });
        throw new ApiError('Email confirmation does not match', 400);
      }

      // Verify password
      const isPasswordValid = await bcryptjs.compare(password, user.password_hash);
      if (!isPasswordValid) {
        logger.warn('Invalid password provided for account deletion', { userId });
        throw new ApiError('Password is incorrect', 400);
      }

      await client.query('BEGIN');
      try {
        // 1. Update access requests to remove processed_by reference (no CASCADE DELETE)
        await client.query(
          'UPDATE access_requests SET processed_by = NULL WHERE processed_by = $1',
          [userId]
        );

        // 2. Delete user (CASCADE DELETE will handle most dependencies)
        await client.query('DELETE FROM users WHERE id = $1', [userId]);

        await client.query('COMMIT');
        logger.info('Account deleted successfully', { userId, email: user.email });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      logger.error('Error deleting account', { error, userId });
      throw new ApiError(
        'Failed to delete account',
        500,
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      client.release();
    }
  }

  /**
   * Generates a secure random password
   */
  private generateSecurePassword(length: number = 12): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let password = '';

    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, chars.length);
      password += chars[randomIndex];
    }

    return password;
  }

  /**
   * Sends a verification email to the user
   * @param email User's email
   * @returns Success status
   */
  public async sendVerificationEmail(email: string): Promise<void> {
    logger.info('Sending verification email', { email });

    const client = await db.getPool().connect();
    try {
      // Check if user exists
      const userResult = await client.query(
        'SELECT id, email_verified FROM users WHERE email = $1',
        [email]
      );

      if (userResult.rows.length === 0) {
        throw new ApiError('User not found', 404);
      }

      const user = userResult.rows[0];

      if (user.email_verified) {
        throw new ApiError('Email already verified', 400);
      }

      // Generate verification token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours expiry

      // Store verification token
      await client.query(
        'INSERT INTO email_verifications (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [user.id, token, expiresAt]
      );

      // Send email with verification link
      const verificationUrl = `${config.appUrl || 'https://spherosegapp.utia.cas.cz'}/verify-email?token=${token}`;

      // Import email service
      const { sendVerificationEmail } = await import('./emailService');

      // Send verification email
      await sendVerificationEmail(email, verificationUrl);

      logger.info('Verification email sent successfully', { email, verificationUrl });
    } catch (error) {
      logger.error('Error sending verification email', { error, email });
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'Failed to send verification email',
        500,
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      client.release();
    }
  }

  /**
   * Verifies user's email with token
   * @param token Verification token
   * @returns Success status
   */
  public async verifyEmail(token: string): Promise<void> {
    logger.info('Verifying email with token');

    const client = await db.getPool().connect();
    try {
      await client.query('BEGIN');

      // Find valid token
      const tokenResult = await client.query(
        `SELECT ev.*, u.email 
         FROM email_verifications ev
         JOIN users u ON ev.user_id = u.id
         WHERE ev.token = $1 
         AND ev.expires_at > NOW() 
         AND ev.used_at IS NULL`,
        [token]
      );

      if (tokenResult.rows.length === 0) {
        throw new ApiError('Invalid or expired verification token', 400);
      }

      const verification = tokenResult.rows[0];

      // Mark token as used
      await client.query('UPDATE email_verifications SET used_at = NOW() WHERE id = $1', [
        verification.id,
      ]);

      // Mark user as verified
      await client.query(
        'UPDATE users SET email_verified = true, email_verified_at = NOW() WHERE id = $1',
        [verification.user_id]
      );

      await client.query('COMMIT');

      logger.info('Email verified successfully', { email: verification.email });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error verifying email', { error });
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'Failed to verify email',
        500,
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get user's preferred language
   * @param userId User ID
   * @returns Preferred language code or null
   */
  async getUserLanguage(userId: string): Promise<string | null> {
    const client = await pool.getClient();
    try {
      const result = await client.query('SELECT preferred_language FROM users WHERE id = $1', [
        userId,
      ]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0].preferred_language || 'en';
    } catch (error) {
      logger.error('Error fetching user language', { error, userId });
      return 'en'; // Default to English on error
    } finally {
      client.release();
    }
  }
}

export default new AuthService();
