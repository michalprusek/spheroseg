import express, { Request, Response, Router, NextFunction } from 'express';
import db from '../db';
import { AuthenticatedRequest } from '../security/middleware/auth'; // Optional: To link logged-in user
import { createLogger } from '../utils/logger';
import emailService from '../services/emailService';

const logger = createLogger('accessRequests');
const router: Router = express.Router();

// POST /api/access-requests - Submit a new access request
router.post('/', async (req: Request, res: Response) => {
  try {
    const { email, name, organization, reason } = req.body;

    if (!email || !name || !reason) {
      return res.status(400).json({
        message: 'Missing required fields: email, name, and reason are required',
      });
    }

    logger.info('Creating access request', { email, name, organization, reason });

    // Check if the request comes from an authenticated user (optional)
    let userId: string | null = null;
    if ((req as AuthenticatedRequest).user) {
      userId = (req as AuthenticatedRequest).user!.userId;
    }

    // Optional: Check if a user with this email already exists
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0 && !userId) {
      // If user exists but wasn't logged in, link the request to them
      userId = existingUser.rows[0].id;
    }

    // Insert the access request
    const insertQuery = `
      INSERT INTO access_requests (email, name, organization, reason, status)
      VALUES ($1, $2, $3, $4, 'pending')
      RETURNING id, email, status, created_at;
    `;
    const values = [email, name, organization, reason];

    const result = await db.query(insertQuery, values);

    logger.info('Access request created successfully', {
      id: result.rows[0].id,
      email: result.rows[0].email,
    });

    // Send email notification
    try {
      logger.info('Sending access request email notification', {
        email,
        name,
      });
      await emailService.sendAccessRequest({
        email,
        name,
        organization,
        reason,
      });
      logger.info('Access request email notification sent successfully');
    } catch (emailError) {
      // Log the error but don't fail the request
      logger.error('Failed to send access request email notification', {
        error: emailError,
        email,
        name,
      });
      // Continue with the response as the DB entry was successful
    }

    res.status(201).json({
      message: 'Access request submitted successfully.',
      request: result.rows[0],
    });
  } catch (error) {
    logger.error('Error submitting access request:', {
      error:
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name,
            }
          : error,
      body: req.body,
    });

    // Check for specific errors, e.g., duplicate email if you add a constraint
    if (error instanceof Error) {
      if (error.message.includes('duplicate key')) {
        return res.status(409).json({
          message: 'An access request for this email is already pending.',
        });
      }

      // Log more specific database errors
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        logger.error('Database schema error:', {
          message: error.message,
          table: 'access_requests',
        });
      }
    }

    res.status(500).json({ message: 'Internal server error' });
  }
});

// Optional: Add endpoints for admins to GET/PUT requests (requires admin role check)
// GET /api/access-requests - Get all requests (Admin only)
// PUT /api/access-requests/:id - Update request status (Admin only)

export default router;
