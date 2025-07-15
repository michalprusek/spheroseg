/**
 * Authentication Routes
 * Handles user registration, login, token refresh, and related functionality
 */
import express, { Request, Response, Router } from 'express';
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
// TODO: Re-enable i18n when fixed
// import { 
//   sendSuccess, 
//   sendCreated, 
//   sendError, 
//   sendServerError 
// } from '../utils/apiResponsei18n';

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
  res.json({ message: 'Auth routes are working' });
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
router.post('/register', validate(registerSchema), async (req: express.Request, res: Response) => {
  logger.info('Register endpoint hit', { body: req.body });
  const { email, password, name, preferred_language } = req.body as RegisterRequest;

  try {
    const result = await authService.registerUser(email, password, name, preferred_language);
    res.status(201).json(result);
  } catch (error) {
    logger.error('Registration error', { error, email });
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    res.status(500).json({ message: 'Failed to register user' });
  }
});

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
router.post('/login', validate(loginSchema), async (req: express.Request, res: Response) => {
  const { email, password, remember_me } = req.body as LoginRequest;

  try {
    const result = await authService.loginUser(email, password, remember_me);
    res.json(result);
  } catch (error) {
    logger.error('Login error', { error, email });
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    res.status(500).json({ message: 'Failed to login' });
  }
});

// POST /api/auth/refresh - Refresh access token using refresh token
router.post(
  '/refresh',
  validate(refreshTokenSchema),
  async (req: express.Request, res: Response) => {
    const { refreshToken } = req.body as RefreshTokenRequest;

    try {
      const result = await authService.refreshAccessToken(refreshToken);
      res.json(result);
    } catch (error) {
      logger.warn('Token refresh failed', { error });
      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({ message: error.message, code: error.code });
      }
      res.status(500).json({ message: 'Invalid refresh token' });
    }
  }
);

// POST /api/auth/forgot-password - Request password reset
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

// POST /api/auth/reset-password - Reset password with token
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

// POST /api/auth/logout - Invalidate refresh token on logout
router.post('/logout', optionalAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { refreshToken } = req.body;
  const userId = req.user?.userId;

  try {
    await authService.logoutUser(refreshToken, userId);
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

// GET /api/auth/check-email - Check if email exists in the system
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

// GET /api/auth/me - Get current user (useful for token verification)
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const user = await authService.getCurrentUser(userId);
    res.json(user);
  } catch (error) {
    logger.error('Error fetching current user', { error, userId });
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    res.status(500).json({ message: 'Failed to fetch user data' });
  }
});

// PUT /api/auth/change-password - Change user password
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

// DELETE /api/auth/account - Delete user account
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

// POST /api/auth/send-verification-email - Send verification email
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

// GET /api/auth/verify-email - Verify email with token
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
