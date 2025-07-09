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
import jwt from 'jsonwebtoken';
import config from '../config';
import tokenService, { TokenType } from '../services/tokenService';

const router: Router = express.Router();

// GET /api/users/me - Get current user's profile
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
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

    // Get user from database
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);

    if (userResult.rows.length === 0) {
      logger.warn('User not found', { userId });
      return res.status(404).json({ message: 'User not found' });
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
    return res.json(userData);
  } catch (error) {
    logger.error('Error fetching user profile:', { error });
    return res.status(500).json({ message: 'Failed to fetch user profile' });
  }
});

// POST /api/users/register - Register a new user
router.post('/register', async (req: Request, res: Response) => {
  const { email, password, name } = req.body;

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

// POST /api/users/login - Login with email/password
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

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

// GET /api/users/me/statistics - Get current user's statistics
router.get('/me/statistics', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
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
});

// GET /api/users/me/stats - Alternative endpoint for statistics (simplified)
router.get('/me/stats', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
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
});

export default router;
