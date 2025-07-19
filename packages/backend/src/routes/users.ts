/**
 * User Routes
 *
 * This file contains routes for user-related operations.
 */
import express, { Response, Router, Request } from 'express';
import { authenticate as authMiddleware, AuthenticatedRequest } from '../security/middleware/auth';
import logger from '../utils/logger';
import pool from '../db';
import { v4 as uuidv4 } from 'uuid';
import tokenService from '../services/tokenService';
import { cacheControl, combineCacheStrategies } from '../middleware/cache';
import {
  sendSuccess,
  sendError,
  sendNotFound,
  sendUnauthorized,
  sendBadRequest,
  sendServerError,
  asyncHandler,
} from '../utils/responseHelpers';

const router: Router = express.Router();

/**
 * @openapi
 * /users/me:
 *   get:
 *     tags: [Users]
 *     summary: Get current user profile
 *     description: |
 *       Retrieve the authenticated user's complete profile information including
 *       basic user data and extended profile details from user_profiles table.
 *       Returns fallback values when extended profile is not available.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                   description: User's unique identifier
 *                   example: "123e4567-e89b-12d3-a456-426614174000"
 *                 email:
 *                   type: string
 *                   format: email
 *                   description: User's email address
 *                   example: "user@example.com"
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                   description: Account creation timestamp
 *                   example: "2023-12-01T10:30:00Z"
 *                 profile:
 *                   type: object
 *                   description: Extended user profile information
 *                   properties:
 *                     username:
 *                       type: string
 *                       description: User's display username
 *                       example: "john_doe"
 *                     full_name:
 *                       type: string
 *                       description: User's full name
 *                       example: "John Doe"
 *                     title:
 *                       type: string
 *                       nullable: true
 *                       description: Professional title or position
 *                       example: "Research Scientist"
 *                     organization:
 *                       type: string
 *                       nullable: true
 *                       description: Organization or company name
 *                       example: "University Research Lab"
 *                     bio:
 *                       type: string
 *                       nullable: true
 *                       description: User biography or description
 *                       example: "Cell biology researcher with 10 years experience"
 *                     location:
 *                       type: string
 *                       nullable: true
 *                       description: User's location
 *                       example: "Boston, MA"
 *                     avatar_url:
 *                       type: string
 *                       nullable: true
 *                       description: URL to user's profile picture
 *                       example: "https://example.com/avatars/user123.jpg"
 *       401:
 *         description: Unauthorized - authentication required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Authentication required"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User not found"
 *       500:
 *         description: Internal server error or database schema error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Database schema not initialized"
 */
// GET /api/users/me - Get current user's profile
router.get(
  '/me',
  authMiddleware,
  combineCacheStrategies(cacheControl.conditional, cacheControl.etag),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;

    if (!userId) {
      return sendUnauthorized(res, 'Authentication required');
    }
    // Check if users table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'users'
      )
    `);

    if (!tableCheck.rows[0].exists) {
      logger.warn('Users table does not exist, returning error');
      return sendServerError(res, 'Database schema not initialized');
    }

    // Get user from database
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);

    if (userResult.rows.length === 0) {
      logger.warn('User not found', { userId });
      return sendNotFound(res, 'User not found');
    }

    const user = userResult.rows[0];

    // Check if user_profiles table exists
    const profileTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'user_profiles'
      )
    `);

    let profile = null;
    if (profileTableCheck.rows[0].exists) {
      // Get profile from database
      const profileResult = await pool.query('SELECT * FROM user_profiles WHERE user_id = $1', [
        userId,
      ]);
      if (profileResult.rows.length > 0) {
        profile = profileResult.rows[0];
      }
    }

    // Format user data
    const userData = {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      profile: profile
        ? {
            username: profile.username,
            full_name: profile.full_name,
            title: profile.title,
            organization: profile.organization,
            bio: profile.bio,
            location: profile.location,
            avatar_url: profile.avatar_url,
          }
        : {
            username: user.name || user.email.split('@')[0],
            full_name: user.name || 'User',
            title: null,
            organization: null,
            bio: null,
            location: null,
            avatar_url: null,
          },
    };

    logger.info('User profile returned', { userId });
    return sendSuccess(res, userData);
  })
);

/**
 * @openapi
 * /users/register:
 *   post:
 *     tags: [Users]
 *     summary: Register a new user
 *     description: |
 *       Register a new user with basic information. This is a development endpoint
 *       that creates users without authentication. In production, this endpoint
 *       would include proper validation and security measures.
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
 *                 example: "newuser@example.com"
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: User password (not currently validated in this endpoint)
 *                 example: "securePassword123"
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 description: User's full name
 *                 example: "John Doe"
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User registered successfully"
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                       description: Generated user ID
 *                       example: "123e4567-e89b-12d3-a456-426614174000"
 *                     email:
 *                       type: string
 *                       format: email
 *                       example: "newuser@example.com"
 *                     name:
 *                       type: string
 *                       example: "John Doe"
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2023-12-01T10:30:00Z"
 *       409:
 *         description: Conflict - user with email already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User with this email already exists"
 *       500:
 *         description: Internal server error or database schema error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Database schema not initialized"
 */
// POST /api/users/register - Register a new user
router.post('/register', async (req: Request, res: Response) => {
  const { email, password: _password, name } = req.body;

  try {
    logger.info('User registration attempt', { email });

    // Check if users table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'users'
      )
    `);

    if (!tableCheck.rows[0].exists) {
      logger.warn('Users table does not exist, returning error');
      return res.status(500).json({ message: 'Database schema not initialized' });
    }

    // Check if user already exists
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      logger.warn('User already exists', { email });
      return res.status(409).json({ message: 'User with this email already exists' });
    }

    // Generate a UUID for the new user
    const userId = uuidv4();

    // Insert user into database
    const newUser = await pool.query(
      'INSERT INTO users (id, email, name, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
      [userId, email, name]
    );

    logger.info('User registered successfully', { userId, email });
    return res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: newUser.rows[0].id,
        email: newUser.rows[0].email,
        name: newUser.rows[0].name,
        created_at: newUser.rows[0].created_at,
      },
    });
  } catch (error) {
    logger.error('Registration error', { error });
    res.status(500).json({ message: 'Internal server error during registration' });
  }
});

/**
 * @openapi
 * /users/login:
 *   post:
 *     tags: [Users]
 *     summary: User login
 *     description: |
 *       Authenticate user with email and password. This is a development endpoint
 *       that provides lenient authentication - creates users if they don't exist
 *       and doesn't validate passwords. Returns JWT tokens for authentication.
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
 *                 description: User's email address
 *                 example: "user@example.com"
 *               password:
 *                 type: string
 *                 description: User password (not validated in development mode)
 *                 example: "password123"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Login successful"
 *                 token:
 *                   type: string
 *                   description: JWT access token for API authentication
 *                   example: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                       example: "123e4567-e89b-12d3-a456-426614174000"
 *                     email:
 *                       type: string
 *                       format: email
 *                       example: "user@example.com"
 *                     name:
 *                       type: string
 *                       example: "Development User"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Internal server error during login"
 */
// POST /api/users/login - Login with email/password
router.post('/login', async (req: Request, res: Response) => {
  const { email, password: _password } = req.body;

  try {
    logger.info('Login attempt', { email });

    // Check if users table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'users'
      )
    `);

    if (!tableCheck.rows[0].exists) {
      logger.warn('Users table does not exist, creating development user');

      // Create users table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          password_hash VARCHAR(255),
          is_approved BOOLEAN DEFAULT TRUE,
          storage_used_bytes BIGINT DEFAULT 0,
          storage_limit_bytes BIGINT DEFAULT 10737418240
        )
      `);

      // Create a development user
      const userId = uuidv4();
      await pool.query(
        'INSERT INTO users (id, email, name, created_at, is_approved) VALUES ($1, $2, $3, NOW(), TRUE)',
        [userId, email || 'dev@example.com', 'Development User']
      );

      // Generate JWT using tokenService
      const tokenResponse = await tokenService.createTokenResponse(
        userId,
        email || 'dev@example.com'
      );

      logger.info('Development user created and logged in', { userId, email });
      return res.status(200).json({
        message: 'Login successful',
        token: tokenResponse.accessToken,
        user: {
          id: userId,
          email: email || 'dev@example.com',
          name: 'Development User',
        },
      });
    }

    // Find user by email
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      logger.warn('Login failed: User not found', { email });

      // For development, create a user if not found
      const userId = uuidv4();
      await pool.query(
        'INSERT INTO users (id, email, name, created_at, is_approved) VALUES ($1, $2, $3, NOW(), TRUE)',
        [userId, email, 'Development User']
      );

      // Generate JWT using tokenService
      const tokenResponse = await tokenService.createTokenResponse(userId, email);

      logger.info('Development user created and logged in', { userId, email });
      return res.status(200).json({
        message: 'Login successful',
        token: tokenResponse.accessToken,
        user: {
          id: userId,
          email,
          name: 'Development User',
        },
      });
    }

    const user = userResult.rows[0];

    // Generate JWT using tokenService
    const tokenResponse = await tokenService.createTokenResponse(user.id, user.email);

    logger.info('Login successful', { userId: user.id, email: user.email });
    return res.status(200).json({
      message: 'Login successful',
      token: tokenResponse.accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    logger.error('Login error', { error });
    res.status(500).json({ message: 'Internal server error during login' });
  }
});

/**
 * @openapi
 * /users/me/statistics:
 *   get:
 *     tags: [Users, Statistics]
 *     summary: Get user statistics
 *     description: |
 *       Retrieve comprehensive statistics for the authenticated user including
 *       project counts, image counts, segmentation results, storage usage,
 *       and recent activity. Returns data in both new flat format and legacy
 *       nested format for backward compatibility.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 # New flat format
 *                 totalProjects:
 *                   type: integer
 *                   description: Total number of projects owned by user
 *                   example: 5
 *                 totalImages:
 *                   type: integer
 *                   description: Total number of images across all projects
 *                   example: 150
 *                 completedSegmentations:
 *                   type: integer
 *                   description: Number of images with completed segmentation
 *                   example: 120
 *                 storageUsedBytes:
 *                   type: string
 *                   description: Storage used in bytes (as string for precision)
 *                   example: "1073741824"
 *                 storageLimitBytes:
 *                   type: string
 *                   description: Storage limit in bytes
 *                   example: "10737418240"
 *                 storageUsedMB:
 *                   type: number
 *                   description: Storage used in megabytes (rounded)
 *                   example: 1024.0
 *                 recentActivity:
 *                   type: array
 *                   description: Recent user activities (last 10)
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                         enum: [project_created, image_uploaded, segmentation_completed]
 *                         example: "image_uploaded"
 *                       item_id:
 *                         type: string
 *                         format: uuid
 *                         example: "123e4567-e89b-12d3-a456-426614174000"
 *                       item_name:
 *                         type: string
 *                         example: "cell_sample_001.jpg"
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                         example: "2023-12-01T10:30:00Z"
 *                       project_id:
 *                         type: string
 *                         format: uuid
 *                         example: "456e7890-e89b-12d3-a456-426614174000"
 *                       project_name:
 *                         type: string
 *                         example: "Cancer Cell Study"
 *                 recentProjects:
 *                   type: array
 *                   description: Recently created projects
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       name:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                 recentImages:
 *                   type: array
 *                   description: Recently uploaded images
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       name:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       project_id:
 *                         type: string
 *                         format: uuid
 *                       project_name:
 *                         type: string
 *                 comparisons:
 *                   type: object
 *                   description: Month-over-month comparison metrics
 *                   properties:
 *                     projectsThisMonth:
 *                       type: integer
 *                       description: Projects created this month (to be implemented)
 *                       example: 0
 *                     projectsLastMonth:
 *                       type: integer
 *                       example: 0
 *                     projectsChange:
 *                       type: integer
 *                       example: 0
 *                 # Legacy nested format (for backward compatibility)
 *                 projects:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 *                       example: 5
 *                     recent:
 *                       type: array
 *                       items:
 *                         type: object
 *                 images:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 *                       example: 150
 *                     recent:
 *                       type: array
 *                       items:
 *                         type: object
 *                 segmentations:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 *                       example: 120
 *                     recent:
 *                       type: array
 *                       items:
 *                         type: object
 *                 storage:
 *                   type: object
 *                   properties:
 *                     used:
 *                       type: integer
 *                       description: Storage used in bytes
 *                       example: 1073741824
 *                     limit:
 *                       type: integer
 *                       description: Storage limit in bytes
 *                       example: 10737418240
 *                     percentage:
 *                       type: integer
 *                       description: Storage usage percentage
 *                       example: 10
 *                 activity:
 *                   type: array
 *                   description: Recent activity (legacy format)
 *                   items:
 *                     type: object
 *       401:
 *         description: Unauthorized - authentication required
 *       500:
 *         description: Internal server error
 */
// GET /api/users/me/statistics - Get current user's statistics
router.get(
  '/me/statistics',
  authMiddleware,
  combineCacheStrategies(cacheControl.short, cacheControl.etag),
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    try {
      // Get projects count
      const projectsCountResult = await pool.query(
        'SELECT COUNT(*) FROM projects WHERE user_id = $1',
        [userId]
      );
      const projectsCount = parseInt(projectsCountResult.rows[0].count, 10) || 0;

      // Get images count - join with projects to get all images for this user's projects
      const imagesCountResult = await pool.query(
        'SELECT COUNT(*) FROM images i JOIN projects p ON i.project_id = p.id WHERE p.user_id = $1',
        [userId]
      );
      const imagesCount = parseInt(imagesCountResult.rows[0].count, 10) || 0;

      // Get segmentations count - count completed images as segmentations
      const segmentationsCountResult = await pool.query(
        'SELECT COUNT(*) FROM images i JOIN projects p ON i.project_id = p.id WHERE p.user_id = $1 AND i.status = $2',
        [userId, 'completed']
      );
      const segmentationsCount = parseInt(segmentationsCountResult.rows[0].count, 10) || 0;

      // Get storage used
      const storageResult = await pool.query('SELECT storage_used_bytes FROM users WHERE id = $1', [
        userId,
      ]);
      const storageUsed = parseInt(storageResult.rows[0]?.storage_used_bytes, 10) || 0;
      const storageLimit = parseInt(storageResult.rows[0]?.storage_limit_bytes, 10) || 10737418240; // 10GB default

      // Get recent activity
      const recentActivityResult = await pool.query(
        `
      SELECT
        'project_created' as type,
        p.id as item_id,
        p.title as item_name,
        p.created_at as timestamp,
        p.id as project_id,
        p.title as project_name
      FROM projects p
      WHERE p.user_id = $1
      UNION ALL
      SELECT
        'image_uploaded' as type,
        i.id as item_id,
        i.name as item_name,
        i.created_at as timestamp,
        i.project_id,
        p.title as project_name
      FROM images i
      JOIN projects p ON i.project_id = p.id
      WHERE p.user_id = $1
      UNION ALL
      SELECT
        'segmentation_completed' as type,
        i.id as item_id,
        i.name as item_name,
        i.updated_at as timestamp,
        i.project_id,
        p.title as project_name
      FROM images i
      JOIN projects p ON i.project_id = p.id
      WHERE p.user_id = $1 AND i.status = 'completed'
      ORDER BY timestamp DESC
      LIMIT 10
    `,
        [userId]
      );

      const recentActivity = recentActivityResult.rows;

      // Return statistics in both formats for compatibility
      const statistics = {
        // New format (flat structure)
        totalProjects: projectsCount,
        totalImages: imagesCount,
        completedSegmentations: segmentationsCount,
        storageUsedBytes: storageUsed.toString(),
        storageLimitBytes: storageLimit.toString(),
        storageUsedMB: Math.round((storageUsed / (1024 * 1024)) * 100) / 100,
        recentActivity: recentActivity.map((item) => ({
          type: item.type,
          item_id: item.item_id,
          item_name: item.item_name,
          timestamp: item.timestamp,
          project_id: item.project_id,
          project_name: item.project_name,
        })),
        recentProjects: recentActivity
          .filter((item) => item.type === 'project_created')
          .map((item) => ({
            id: item.item_id,
            name: item.item_name,
            created_at: item.timestamp,
          })),
        recentImages: recentActivity
          .filter((item) => item.type === 'image_uploaded')
          .map((item) => ({
            id: item.item_id,
            name: item.item_name,
            created_at: item.timestamp,
            project_id: item.project_id,
            project_name: item.project_name,
          })),
        comparisons: {
          projectsThisMonth: 0, // To be implemented
          projectsLastMonth: 0,
          projectsChange: 0,
          imagesThisMonth: 0,
          imagesLastMonth: 0,
          imagesChange: 0,
        },

        // Old format (nested structure) - for backward compatibility
        projects: {
          count: projectsCount,
          recent: recentActivity
            .filter((item) => item.type === 'project_created')
            .map((item) => ({
              id: item.item_id,
              name: item.item_name,
              created_at: item.timestamp,
            })),
        },
        images: {
          count: imagesCount,
          recent: recentActivity
            .filter((item) => item.type === 'image_uploaded')
            .map((item) => ({
              id: item.item_id,
              name: item.item_name,
              created_at: item.timestamp,
              project_id: item.project_id,
              project_name: item.project_name,
            })),
        },
        segmentations: {
          count: segmentationsCount,
          recent: recentActivity
            .filter((item) => item.type === 'segmentation_completed')
            .map((item) => ({
              id: item.item_id,
              name: item.item_name,
              created_at: item.timestamp,
              project_id: item.project_id,
              project_name: item.project_name,
            })),
        },
        storage: {
          used: storageUsed,
          limit: storageLimit,
          percentage: Math.round((storageUsed / storageLimit) * 100),
        },
        activity: recentActivity.map((item) => ({
          type: item.type,
          item_id: item.item_id,
          item_name: item.item_name,
          timestamp: item.timestamp,
          project_id: item.project_id,
          project_name: item.project_name,
        })),
      };

      logger.info('User statistics returned', { userId });
      return res.json(statistics);
    } catch (error) {
      logger.error('Error fetching user statistics:', { error });
      return res.status(500).json({ message: 'Failed to fetch user statistics' });
    }
  }
);

/**
 * @openapi
 * /users/me/stats:
 *   get:
 *     tags: [Users, Statistics]
 *     summary: Get simplified user statistics
 *     description: |
 *       Retrieve simplified statistics for the authenticated user including
 *       basic counts for projects, images, and completed segmentations.
 *       This is a lightweight alternative to the full /me/statistics endpoint.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 # New format
 *                 totalProjects:
 *                   type: integer
 *                   description: Total number of projects owned by user
 *                   example: 5
 *                 totalImages:
 *                   type: integer
 *                   description: Total number of images across all projects
 *                   example: 150
 *                 completedSegmentations:
 *                   type: integer
 *                   description: Number of images with completed segmentation
 *                   example: 120
 *                 # Legacy format (for backward compatibility)
 *                 projects_count:
 *                   type: integer
 *                   description: Total number of projects (legacy field name)
 *                   example: 5
 *                 images_count:
 *                   type: integer
 *                   description: Total number of images (legacy field name)
 *                   example: 150
 *                 segmentations_count:
 *                   type: integer
 *                   description: Number of completed segmentations (legacy field name)
 *                   example: 120
 *       401:
 *         description: Unauthorized - authentication required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Authentication required"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Failed to fetch user stats"
 */
// GET /api/users/me/stats - Alternative endpoint for statistics (simplified)
router.get(
  '/me/stats',
  authMiddleware,
  combineCacheStrategies(cacheControl.short, cacheControl.etag),
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    try {
      // Get projects count
      const projectsCountResult = await pool.query(
        'SELECT COUNT(*) FROM projects WHERE user_id = $1',
        [userId]
      );
      const projectsCount = parseInt(projectsCountResult.rows[0].count, 10) || 0;

      // Get images count - join with projects to get all images for this user's projects
      const imagesCountResult = await pool.query(
        'SELECT COUNT(*) FROM images i JOIN projects p ON i.project_id = p.id WHERE p.user_id = $1',
        [userId]
      );
      const imagesCount = parseInt(imagesCountResult.rows[0].count, 10) || 0;

      // Get segmentations count - count completed images as segmentations
      const segmentationsCountResult = await pool.query(
        'SELECT COUNT(*) FROM images i JOIN projects p ON i.project_id = p.id WHERE p.user_id = $1 AND i.status = $2',
        [userId, 'completed']
      );
      const segmentationsCount = parseInt(segmentationsCountResult.rows[0].count, 10) || 0;

      // Return simplified statistics in both formats for compatibility
      const statistics = {
        // New format
        totalProjects: projectsCount,
        totalImages: imagesCount,
        completedSegmentations: segmentationsCount,

        // Old format
        projects_count: projectsCount,
        images_count: imagesCount,
        segmentations_count: segmentationsCount,
      };

      logger.info('User stats returned', { userId });
      return res.json(statistics);
    } catch (error) {
      logger.error('Error fetching user stats:', { error });
      return res.status(500).json({ message: 'Failed to fetch user stats' });
    }
  }
);

/**
 * @openapi
 * /users/me:
 *   put:
 *     tags: [Users]
 *     summary: Update user profile
 *     description: |
 *       Update the authenticated user's profile information including basic user data
 *       and extended profile fields. Creates or updates the user_profiles record
 *       with additional profile information like title, organization, and bio.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: User's display name (updates users table)
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address (must be unique if changed)
 *                 example: "john.doe@example.com"
 *               username:
 *                 type: string
 *                 description: User's username for profile
 *                 example: "john_doe"
 *               full_name:
 *                 type: string
 *                 description: User's full name
 *                 example: "John Michael Doe"
 *               title:
 *                 type: string
 *                 nullable: true
 *                 description: Professional title or position
 *                 example: "Senior Research Scientist"
 *               organization:
 *                 type: string
 *                 nullable: true
 *                 description: Organization or company name
 *                 example: "University Research Lab"
 *               bio:
 *                 type: string
 *                 nullable: true
 *                 description: User biography or description
 *                 example: "Cell biology researcher specializing in cancer cell analysis"
 *               location:
 *                 type: string
 *                 nullable: true
 *                 description: User's location
 *                 example: "Boston, MA, USA"
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                   example: "123e4567-e89b-12d3-a456-426614174000"
 *                 email:
 *                   type: string
 *                   format: email
 *                   example: "john.doe@example.com"
 *                 name:
 *                   type: string
 *                   example: "John Doe"
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                   example: "2023-12-01T10:30:00Z"
 *                 username:
 *                   type: string
 *                   example: "john_doe"
 *                 full_name:
 *                   type: string
 *                   example: "John Michael Doe"
 *                 title:
 *                   type: string
 *                   nullable: true
 *                   example: "Senior Research Scientist"
 *                 organization:
 *                   type: string
 *                   nullable: true
 *                   example: "University Research Lab"
 *                 bio:
 *                   type: string
 *                   nullable: true
 *                   example: "Cell biology researcher specializing in cancer cell analysis"
 *                 location:
 *                   type: string
 *                   nullable: true
 *                   example: "Boston, MA, USA"
 *                 avatar_url:
 *                   type: string
 *                   nullable: true
 *                   example: "https://example.com/avatars/user123.jpg"
 *       401:
 *         description: Unauthorized - authentication required
 *       404:
 *         description: User not found
 *       409:
 *         description: Conflict - email already in use by another account
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Email already in use by another account"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Failed to update user profile"
 */
// PUT /api/users/me - Update current user's profile
router.put('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const { name, username, full_name, title, organization, bio, location } = req.body;

  try {
    // Start transaction
    await pool.query('BEGIN');

    // Check if user exists
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ message: 'User not found' });
    }

    // Update user name if provided
    if (name) {
      await pool.query('UPDATE users SET name = $1 WHERE id = $2', [name, userId]);
    }

    // Check if email is already in use (if email update is requested)
    if (req.body.email && req.body.email !== userResult.rows[0].email) {
      const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [
        req.body.email,
        userId,
      ]);
      if (emailCheck.rows.length > 0) {
        await pool.query('ROLLBACK');
        return res.status(409).json({ message: 'Email already in use by another account' });
      }
      await pool.query('UPDATE users SET email = $1 WHERE id = $2', [req.body.email, userId]);
    }

    // Check if user_profiles table exists
    const profileTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'user_profiles'
      )
    `);

    if (profileTableCheck.rows[0].exists) {
      // Check if profile exists
      const profileCheck = await pool.query('SELECT * FROM user_profiles WHERE user_id = $1', [
        userId,
      ]);

      if (profileCheck.rows.length > 0) {
        // Update existing profile
        await pool.query(
          `UPDATE user_profiles 
           SET username = COALESCE($1, username),
               full_name = COALESCE($2, full_name),
               title = $3,
               organization = $4,
               bio = $5,
               location = $6,
               updated_at = NOW()
           WHERE user_id = $7`,
          [username, full_name, title, organization, bio, location, userId]
        );
      } else {
        // Create new profile
        await pool.query(
          `INSERT INTO user_profiles (user_id, username, full_name, title, organization, bio, location)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            userId,
            username || userResult.rows[0].email.split('@')[0],
            full_name || name || 'User',
            title,
            organization,
            bio,
            location,
          ]
        );
      }
    }

    await pool.query('COMMIT');

    // Get updated user data
    const updatedUserResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const updatedUser = updatedUserResult.rows[0];

    let profile = null;
    if (profileTableCheck.rows[0].exists) {
      const profileResult = await pool.query('SELECT * FROM user_profiles WHERE user_id = $1', [
        userId,
      ]);
      if (profileResult.rows.length > 0) {
        profile = profileResult.rows[0];
      }
    }

    // Return updated user data
    const userData = {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      created_at: updatedUser.created_at,
      username: profile?.username || updatedUser.email.split('@')[0],
      full_name: profile?.full_name || updatedUser.name || 'User',
      title: profile?.title,
      organization: profile?.organization,
      bio: profile?.bio,
      location: profile?.location,
      avatar_url: profile?.avatar_url,
    };

    logger.info('User profile updated', { userId });
    return res.json(userData);
  } catch (error) {
    await pool.query('ROLLBACK');
    logger.error('Error updating user profile:', { error });
    return res.status(500).json({ message: 'Failed to update user profile' });
  }
});

/**
 * @openapi
 * /users/me/avatar:
 *   post:
 *     tags: [Users]
 *     summary: Update user avatar
 *     description: |
 *       Update the authenticated user's avatar by providing an avatar URL.
 *       This is a simplified implementation that accepts avatar URLs rather than
 *       file uploads. Creates or updates the user_profiles record with the new avatar.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [avatar_url]
 *             properties:
 *               avatar_url:
 *                 type: string
 *                 format: uri
 *                 description: URL to the user's avatar image
 *                 example: "https://example.com/avatars/user123.jpg"
 *     responses:
 *       200:
 *         description: Avatar updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Avatar uploaded successfully"
 *                 avatar_url:
 *                   type: string
 *                   format: uri
 *                   description: The updated avatar URL
 *                   example: "https://example.com/avatars/user123.jpg"
 *       400:
 *         description: Bad request - no avatar URL provided
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "No avatar URL provided"
 *       401:
 *         description: Unauthorized - authentication required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Authentication required"
 *       500:
 *         description: Internal server error or user profiles not supported
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User profiles not supported"
 */
// POST /api/users/me/avatar - Upload user avatar
router.post('/me/avatar', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    // For now, we'll implement a simple avatar URL update
    // In production, this would handle file upload with multer
    const { avatar_url } = req.body;

    if (!avatar_url) {
      return res.status(400).json({ message: 'No avatar URL provided' });
    }

    // Check if user_profiles table exists
    const profileTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'user_profiles'
      )
    `);

    if (!profileTableCheck.rows[0].exists) {
      return res.status(500).json({ message: 'User profiles not supported' });
    }

    // Check if profile exists
    const profileCheck = await pool.query('SELECT * FROM user_profiles WHERE user_id = $1', [
      userId,
    ]);

    if (profileCheck.rows.length > 0) {
      // Update existing profile
      await pool.query(
        'UPDATE user_profiles SET avatar_url = $1, updated_at = NOW() WHERE user_id = $2',
        [avatar_url, userId]
      );
    } else {
      // Create new profile with avatar
      const userResult = await pool.query('SELECT email, name FROM users WHERE id = $1', [userId]);
      const user = userResult.rows[0];

      await pool.query(
        `INSERT INTO user_profiles (user_id, username, full_name, avatar_url)
         VALUES ($1, $2, $3, $4)`,
        [userId, user.email.split('@')[0], user.name || 'User', avatar_url]
      );
    }

    logger.info('User avatar updated', { userId });
    return res.json({
      message: 'Avatar uploaded successfully',
      avatar_url: avatar_url,
    });
  } catch (error) {
    logger.error('Error updating user avatar:', { error });
    return res.status(500).json({ message: 'Failed to update avatar' });
  }
});

export default router;
