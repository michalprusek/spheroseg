import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authMiddleware'; // Import interface with user payload
import pool from '../db'; // Needed to query user details if not on JWT

/**
 * Middleware to check if the authenticated user has the 'admin' role.
 * Assumes authMiddleware has already run and attached req.user.
 *
 * Note: For enhanced security, role information might be better fetched
 * directly from the database based on req.user.userId instead of relying
 * solely on the JWT payload, which could be stale.
 */
export const isAdmin = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  try {
    // Option 1: Check role directly from JWT payload (if included)
    // if (req.user.role !== 'admin') {
    //     return res.status(403).json({ message: 'Forbidden: Admin access required' });
    // }

    // Option 2: Fetch current role from DB for accuracy
    const userRoleResult = await pool.query('SELECT role FROM users WHERE id = $1', [req.user.userId]);
    if (userRoleResult.rows.length === 0 || userRoleResult.rows[0].role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }

    next(); // User is admin, proceed
  } catch (error) {
    console.error('Admin check error:', error);
    next(error); // Pass error to error handler
  }
};

/**
 * Middleware to check if the authenticated user's account is approved.
 * Assumes authMiddleware has already run and attached req.user.
 */
export const isUserApproved = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  try {
    // Fetch current approval status from DB
    const userApprovalResult = await pool.query('SELECT is_approved FROM users WHERE id = $1', [req.user.userId]);
    if (userApprovalResult.rows.length === 0 || !userApprovalResult.rows[0].is_approved) {
      return res.status(403).json({ message: 'Forbidden: Account not approved' });
    }

    next(); // User is approved, proceed
  } catch (error) {
    console.error('Approval check error:', error);
    next(error); // Pass error to error handler
  }
};

// Example: Middleware to check for specific roles (can be extended)
export const authorizeRole = (allowedRoles: string[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    try {
      const userRoleResult = await pool.query('SELECT role FROM users WHERE id = $1', [req.user.userId]);
      if (userRoleResult.rows.length === 0 || !allowedRoles.includes(userRoleResult.rows[0].role)) {
        return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};
