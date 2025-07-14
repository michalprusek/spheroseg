import express from 'express';
import { authenticate as authMiddleware, requireAdmin } from '../security/middleware/auth';
import stuckImageCleanupService from '../services/stuckImageCleanup';
import logger from '../utils/logger';
import pool from '../db';

const router = express.Router();

/**
 * POST /api/admin/cleanup-stuck-images
 * Manually trigger cleanup of stuck images
 *
 * Requires authentication
 */
router.post('/cleanup-stuck-images', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    logger.info('Manual stuck image cleanup triggered', { userId: req.user?.userId });

    const count = await stuckImageCleanupService.forceCleanup();

    res.json({
      success: true,
      message: `Cleanup completed. Found and fixed ${count} stuck images.`,
      fixedCount: count,
    });
  } catch (error) {
    logger.error('Error during manual stuck image cleanup:', error);
    next(error);
  }
});

/**
 * GET /api/admin/users
 * Get list of all users (admin only)
 */
router.get('/users', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = '', role = '' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT
        u.id,
        u.email,
        u.name,
        u.role,
        u.is_approved,
        u.created_at,
        u.updated_at,
        u.last_login,
        u.storage_used_bytes,
        u.storage_limit_bytes,
        p.username,
        p.organization,
        p.preferred_language
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (role) {
      query += ` AND u.role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    // Add pagination
    query += ` ORDER BY u.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limit), offset);

    const result = await pool.query(query, params);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) FROM users u WHERE 1=1';
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (search) {
      countQuery += ` AND (u.name ILIKE $${countParamIndex} OR u.email ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }

    if (role) {
      countQuery += ` AND u.role = $${countParamIndex}`;
      countParams.push(role);
    }

    const countResult = await pool.query(countQuery, countParams);
    const totalUsers = parseInt(countResult.rows[0].count);

    logger.info('Admin users list requested', {
      userId: req.user?.userId,
      page,
      limit,
      search,
      role,
      totalUsers
    });

    res.json({
      success: true,
      users: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalUsers,
        totalPages: Math.ceil(totalUsers / Number(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching users list:', error);
    next(error);
  }
});

/**
 * PUT /api/admin/users/:id/role
 * Update user role (admin only)
 */
router.put('/users/:id/role', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be "user" or "admin"'
      });
    }

    const result = await pool.query(
      'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, name, role',
      [role, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    logger.info('User role updated', {
      adminUserId: req.user?.userId,
      targetUserId: id,
      newRole: role
    });

    res.json({
      success: true,
      message: 'User role updated successfully',
      user: result.rows[0]
    });
  } catch (error) {
    logger.error('Error updating user role:', error);
    next(error);
  }
});

/**
 * PUT /api/admin/users/:id/approval
 * Update user approval status (admin only)
 */
router.put('/users/:id/approval', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { is_approved } = req.body;

    const result = await pool.query(
      'UPDATE users SET is_approved = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, name, is_approved',
      [is_approved, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    logger.info('User approval status updated', {
      adminUserId: req.user?.userId,
      targetUserId: id,
      isApproved: is_approved
    });

    res.json({
      success: true,
      message: 'User approval status updated successfully',
      user: result.rows[0]
    });
  } catch (error) {
    logger.error('Error updating user approval:', error);
    next(error);
  }
});

export default router;
