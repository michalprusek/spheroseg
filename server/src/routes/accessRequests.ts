import express, { Request, Response, Router } from 'express';
import pool from '../db';
import authMiddleware, { AuthenticatedRequest } from '../middleware/authMiddleware'; // Optional: To link logged-in user
import { validate } from '../middleware/validationMiddleware';
import { createAccessRequestSchema } from '../validators/accessRequestValidators';
import { NextFunction } from 'express';

const router: Router = express.Router();

// POST /api/access-requests - Submit a new access request
// @ts-ignore // Bypass TS2769 temporarily
router.post('/', validate(createAccessRequestSchema), async (req: Request, res: Response, next: NextFunction) => {
    // Note: Using standard Request here initially, as this might be an unauthenticated endpoint.
    // If we want to link a logged-in user, we need to make authMiddleware optional or handle it differently.
    const { email, name, organization, reason } = req.body;

    // Check if the request comes from an authenticated user (optional)
    // The authMiddleware might need adjustment to be optional for this route
    // For now, we assume it might not be present, or we handle anonymous requests.
    let userId: string | null = null;
    if ((req as AuthenticatedRequest).user) {
        userId = (req as AuthenticatedRequest).user!.userId;
    }

    try {
        // Optional: Check if a user with this email already exists
        const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
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

        const result = await pool.query(insertQuery, values);

        res.status(201).json({
            message: 'Access request submitted successfully.',
            request: result.rows[0]
        });

    } catch (error) {
        console.error('Error submitting access request:', error);
        // Check for specific errors, e.g., duplicate email if you add a constraint
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Optional: Add endpoints for admins to GET/PUT requests (requires admin role check)
// GET /api/access-requests - Get all requests (Admin only)
// PUT /api/access-requests/:id - Update request status (Admin only)

export default router;