/**
 * Authentication Routes
 * Handles user registration, login, token refresh, and related functionality
 */
import express, { Response, Router } from 'express';
import { validate } from '../middleware/validationMiddleware';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  changePasswordSchema,
  deleteAccountSchema,
  sendVerificationEmailSchema,
  verifyEmailSchema,
  RegisterRequest,
  LoginRequest,
  RefreshTokenRequest,
  ChangePasswordRequest,
  DeleteAccountRequest,
  SendVerificationEmailRequest,
  VerifyEmailRequest,
} from '../validators/authValidators';
import {
  authenticate as authMiddleware,
  AuthenticatedRequest,
  optionalAuthenticate as optionalAuthMiddleware,
} from '../security/middleware/auth';
import logger from '../utils/logger';
import { ApiError } from '../utils/errors';
import authService from '../services/authService'; // Import the new auth service
import {
  sendSuccess,
  sendCreated,
  // sendError,
  // sendServerError,
  sendUnauthorized,
  asyncHandler
} from '../utils/responseHelpers';

const router: Router = express.Router();

/**
 * @openapi
 * /auth/test:
 *   get:
 *     tags: [Authentication]
 *     summary: Test authentication routes
 *     description: Simple test endpoint to verify auth routes are working
 *     responses:
 *       200:
 *         description: Routes are working
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Auth routes are working"
 */
router.get('/test', (req: express.Request, res: Response) => {
  logger.info('Test route hit');
  return sendSuccess(res, { message: 'Auth routes are working' });
});

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: Register a new user
 *     description: |
 *       Create a new user account with email and password.
 *       Returns user profile and authentication tokens upon successful registration.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address (must be unique)
 *                 example: "user@example.com"
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: User's password (min 8 characters, must include letters and numbers)
 *                 example: "securePassword123"
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 description: User's full name
 *                 example: "John Doe"
 *               preferred_language:
 *                 type: string
 *                 enum: [en, cs, de, es, fr, zh]
 *                 description: User's preferred language (optional, defaults to 'en')
 *                 example: "en"
 *     responses:
 *       201:
 *         description: User successfully registered
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Registration successful"
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 tokens:
 *                   $ref: '#/components/schemas/TokenResponse'
 *       400:
 *         description: Validation error - invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Conflict - email already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 */
router.post('/register', validate(registerSchema), asyncHandler(async (req: express.Request, res: Response) => {
  logger.info('Register endpoint hit', { body: req.body });
  const { email, password, name, preferred_language } = req.body as RegisterRequest;

  const result = await authService.registerUser(email, password, name, preferred_language);
  return sendCreated(res, result, 'Registration successful');
}));

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Authenticate user
 *     description: |
 *       Login with email and password to receive JWT access and refresh tokens.
 *       Supports optional "remember me" functionality for extended sessions.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's registered email address
 *                 example: "user@example.com"
 *               password:
 *                 type: string
 *                 description: User's password
 *                 example: "securePassword123"
 *               remember_me:
 *                 type: boolean
 *                 description: Extended session duration when true
 *                 default: false
 *                 example: false
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Login successful"
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 tokens:
 *                   $ref: '#/components/schemas/TokenResponse'
 *       400:
 *         description: Validation error - invalid input format
 *       401:
 *         description: Unauthorized - invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Invalid email or password"
 *                 code:
 *                   type: string
 *                   example: "INVALID_CREDENTIALS"
 *       429:
 *         description: Too many failed login attempts
 *       500:
 *         description: Internal server error
 */
router.post('/login', validate(loginSchema), asyncHandler(async (req: express.Request, res: Response) => {
  const { email, password, remember_me } = req.body as LoginRequest;

  const result = await authService.loginUser(email, password, remember_me);
  return sendSuccess(res, result, 'Login successful');
}));

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Authentication]
 *     summary: Refresh access token
 *     description: |
 *       Use a valid refresh token to obtain a new access token and refresh token pair.
 *       This endpoint implements token rotation for enhanced security.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Valid refresh token from previous login or refresh
 *                 example: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Token refreshed successfully"
 *                 tokens:
 *                   $ref: '#/components/schemas/TokenResponse'
 *       401:
 *         description: Invalid or expired refresh token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Invalid refresh token"
 *                 code:
 *                   type: string
 *                   example: "INVALID_REFRESH_TOKEN"
 *       500:
 *         description: Internal server error
 */
router.post(
  '/refresh',
  validate(refreshTokenSchema),
  asyncHandler(async (req: express.Request, res: Response) => {
    const { refreshToken } = req.body as RefreshTokenRequest;

    const result = await authService.refreshAccessToken(refreshToken);
    return sendSuccess(res, result, 'Token refreshed successfully');
  })
);

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     tags: [Authentication]
 *     summary: Request password reset
 *     description: |
 *       Send a password reset email to the specified email address.
 *       If the email exists in the system, a new temporary password will be generated and sent.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address of the account to reset
 *                 example: "user@example.com"
 *     responses:
 *       200:
 *         description: Password reset email sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "A new password has been sent to your email"
 *       400:
 *         description: Validation error - invalid email format
 *       404:
 *         description: Email not found in system
 *       500:
 *         description: Internal server error
 */
router.post(
  '/forgot-password',
  validate(forgotPasswordSchema),
  async (req: express.Request, res: Response) => {
    const { email } = req.body;

    try {
      await authService.forgotPassword(email);
      res.json({
        message: 'A new password has been sent to your email',
        success: true,
      });
    } catch (error) {
      logger.error('Forgot password error', { error, email });
      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({ message: error.message, code: error.code });
      }
      res.status(500).json({ message: 'Failed to process password reset request' });
    }
  }
);

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     tags: [Authentication]
 *     summary: Reset password with token
 *     description: |
 *       Reset user password using a valid reset token from email.
 *       The token is typically sent via the forgot-password endpoint.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token:
 *                 type: string
 *                 description: Password reset token from email
 *                 example: "reset-token-abc123"
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: New password (min 8 characters)
 *                 example: "newSecurePassword123"
 *     responses:
 *       200:
 *         description: Password reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Password has been reset successfully"
 *       400:
 *         description: Validation error - invalid input
 *       401:
 *         description: Invalid or expired reset token
 *       500:
 *         description: Internal server error
 */
router.post(
  '/reset-password',
  validate(resetPasswordSchema),
  async (req: express.Request, res: Response) => {
    const { token, password } = req.body;

    try {
      await authService.resetPassword(token, password);
      res.json({ message: 'Password has been reset successfully' });
    } catch (error) {
      logger.error('Password reset error', { error });
      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({ message: error.message, code: error.code });
      }
      res.status(500).json({ message: 'Failed to reset password' });
    }
  }
);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Authentication]
 *     summary: Logout user
 *     description: |
 *       Invalidate the current user session and refresh token.
 *       This endpoint can be called with or without authentication for graceful logout.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token to invalidate
 *                 example: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Logged out successfully"
 *       500:
 *         description: Internal server error (logout still considered successful)
 */
router.post('/logout', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { refreshToken } = req.body;
  const userId = req.user?.userId;

  try {
    await authService.logoutUser(refreshToken, userId);
  } catch (error) {
    logger.error('Logout error', { error, userId });
    // Continue with logout even if DB operation failed
  }
  
  // Always return success - client will discard tokens
  return sendSuccess(res, { message: 'Logged out successfully' });
}));

/**
 * @openapi
 * /auth/revoke:
 *   post:
 *     tags: [Authentication]
 *     summary: Revoke all user sessions
 *     description: |
 *       Revoke all refresh tokens for the authenticated user, effectively logging out
 *       from all devices and sessions. Requires valid authentication.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: All sessions revoked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "All sessions revoked successfully"
 *       401:
 *         description: Unauthorized - authentication required
 *       500:
 *         description: Internal server error
 */
router.post('/revoke', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;

  try {
    await authService.revokeAllUserTokens(userId);
    res.json({ message: 'All sessions revoked successfully' });
  } catch (error) {
    logger.error('Error revoking sessions', { error, userId });
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    res.status(500).json({ message: 'Failed to revoke sessions' });
  }
});

/**
 * @openapi
 * /auth/check-email:
 *   get:
 *     tags: [Authentication]
 *     summary: Check email availability
 *     description: |
 *       Check if an email address is already registered in the system.
 *       Useful for registration form validation and user existence checks.
 *     parameters:
 *       - name: email
 *         in: query
 *         required: true
 *         description: Email address to check
 *         schema:
 *           type: string
 *           format: email
 *           example: "user@example.com"
 *     responses:
 *       200:
 *         description: Email check completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exists:
 *                   type: boolean
 *                   description: Whether the email is already registered
 *                   example: true
 *                 hasAccessRequest:
 *                   type: boolean
 *                   description: Whether there's a pending access request for this email
 *                   example: false
 *                 message:
 *                   type: string
 *                   description: Human-readable status message
 *                   example: "Email is already registered"
 *       400:
 *         description: Missing or invalid email parameter
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exists:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Email parameter is required"
 *       500:
 *         description: Internal server error
 */
router.get('/check-email', async (req: express.Request, res: Response) => {
  const { email } = req.query;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({
      exists: false,
      error: 'Email parameter is required',
    });
  }

  try {
    const { exists, hasAccessRequest } = await authService.checkEmailExists(email);
    res.json({
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
    res.status(500).json({
      exists: false,
      error: 'Failed to check email',
    });
  }
});

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Authentication]
 *     summary: Get current user profile
 *     description: |
 *       Retrieve the authenticated user's profile information.
 *       Useful for token verification and getting current user data.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized - authentication required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 *       500:
 *         description: Internal server error
 */
router.get('/me', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return sendUnauthorized(res, 'User not authenticated');
  }

  const user = await authService.getCurrentUser(userId);
  return sendSuccess(res, user);
}));

/**
 * @openapi
 * /auth/change-password:
 *   put:
 *     tags: [Authentication]
 *     summary: Change user password
 *     description: |
 *       Change the authenticated user's password. Requires current password verification
 *       for security. User must be authenticated to use this endpoint.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [current_password, new_password]
 *             properties:
 *               current_password:
 *                 type: string
 *                 description: Current password for verification
 *                 example: "currentPassword123"
 *               new_password:
 *                 type: string
 *                 minLength: 8
 *                 description: New password (min 8 characters)
 *                 example: "newSecurePassword123"
 *     responses:
 *       200:
 *         description: Password changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Password changed successfully"
 *       400:
 *         description: Validation error - invalid input
 *       401:
 *         description: Unauthorized or incorrect current password
 *       500:
 *         description: Internal server error
 */
router.put(
  '/change-password',
  authMiddleware,
  validate(changePasswordSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const { current_password, new_password } = req.body as ChangePasswordRequest;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    try {
      await authService.changePassword(userId, current_password, new_password);
      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      logger.error('Error changing password', { error, userId });
      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({ message: error.message, code: error.code });
      }
      res.status(500).json({ message: 'Failed to change password' });
    }
  }
);

/**
 * @openapi
 * /auth/account:
 *   delete:
 *     tags: [Authentication]
 *     summary: Delete user account
 *     description: |
 *       Permanently delete the authenticated user's account and all associated data.
 *       This action is irreversible. Requires username and password confirmation.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username:
 *                 type: string
 *                 description: Username confirmation for account deletion
 *                 example: "john.doe"
 *               password:
 *                 type: string
 *                 description: Current password for verification
 *                 example: "currentPassword123"
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Account deleted successfully"
 *       400:
 *         description: Validation error - invalid input
 *       401:
 *         description: Unauthorized or incorrect credentials
 *       500:
 *         description: Internal server error
 */
router.delete(
  '/account',
  authMiddleware,
  validate(deleteAccountSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const { username, password } = req.body as DeleteAccountRequest;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    try {
      await authService.deleteAccount(userId, username, password);
      res.json({ message: 'Account deleted successfully' });
    } catch (error) {
      logger.error('Error deleting account', { error, userId });
      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({ message: error.message, code: error.code });
      }
      res.status(500).json({ message: 'Failed to delete account' });
    }
  }
);

/**
 * @openapi
 * /auth/send-verification-email:
 *   post:
 *     tags: [Authentication]
 *     summary: Send email verification
 *     description: |
 *       Send a verification email to the specified email address.
 *       Used for confirming email ownership during registration or email changes.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address to send verification to
 *                 example: "user@example.com"
 *     responses:
 *       200:
 *         description: Verification email sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Verification email sent successfully"
 *       400:
 *         description: Validation error - invalid email format
 *       500:
 *         description: Internal server error
 */
router.post(
  '/send-verification-email',
  validate(sendVerificationEmailSchema),
  async (req: express.Request, res: Response) => {
    const { email } = req.body as SendVerificationEmailRequest;

    try {
      await authService.sendVerificationEmail(email);
      res.json({ message: 'Verification email sent successfully' });
    } catch (error) {
      logger.error('Error sending verification email', { error, email });
      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({ message: error.message, code: error.code });
      }
      res.status(500).json({ message: 'Failed to send verification email' });
    }
  }
);

/**
 * @openapi
 * /auth/verify-email:
 *   get:
 *     tags: [Authentication]
 *     summary: Verify email address
 *     description: |
 *       Verify email address using a verification token sent via email.
 *       This confirms email ownership and activates the email verification status.
 *     parameters:
 *       - name: token
 *         in: query
 *         required: true
 *         description: Email verification token from email
 *         schema:
 *           type: string
 *           example: "verify-token-abc123"
 *     responses:
 *       200:
 *         description: Email verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Email verified successfully"
 *       400:
 *         description: Validation error - invalid or missing token
 *       401:
 *         description: Invalid or expired verification token
 *       500:
 *         description: Internal server error
 */
router.get(
  '/verify-email',
  validate(verifyEmailSchema),
  async (req: express.Request, res: Response) => {
    const { token } = req.query as VerifyEmailRequest;

    try {
      await authService.verifyEmail(token);
      res.json({ message: 'Email verified successfully' });
    } catch (error) {
      logger.error('Error verifying email', { error });
      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({ message: error.message, code: error.code });
      }
      res.status(500).json({ message: 'Failed to verify email' });
    }
  }
);

export default router;
