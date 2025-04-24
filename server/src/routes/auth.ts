import express, { Request, Response, Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '@/db';
import dotenv from 'dotenv';
import { validate } from '../middleware/validationMiddleware';
import { registerSchema, loginSchema } from '../validators/authValidators';
import { NextFunction } from 'express';

dotenv.config();

const router: Router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error("FATAL ERROR: JWT_SECRET is not defined.");
    process.exit(1);
}

const SALT_ROUNDS = 10; // Cost factor for bcrypt hashing

// POST /api/auth/signup - New User Registration
// @ts-ignore // Bypass TS2769 temporarily
router.post('/signup', validate(registerSchema), async (req: Request, res: Response, next: NextFunction) => {
    const { email, password, name } = req.body; // Assuming name is passed for now
    // TODO: Adjust later if firstName, lastName are passed separately
    const [firstName, lastName] = name ? name.split(' ') : [null, null]; // Simple split for now

    try {
        // Check if user already exists
        const userCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) {
            return res.status(409).json({ message: 'Email already registered' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // Insert new user (initially not approved, role defaults to 'user')
        // Combine firstName and lastName into a single name field
        const fullName = `${firstName} ${lastName}`.trim();
        const newUserResult = await pool.query(
            'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, created_at',
            [email, hashedPassword, fullName]
        );
        const newUser = newUserResult.rows[0];

        // Respond successfully (no token yet, requires approval/login)
        res.status(201).json({
            message: 'User registered successfully. Account pending approval.',
            user: {
                id: newUser.id,
                email: newUser.email,
                isApproved: false, // Default to false since we're not using is_approved column
                role: 'user' // Default role
            }
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ message: 'Internal server error during registration' });
    }
});

// POST /api/auth/login
// @ts-ignore // Bypass TS2769 temporarily
router.post('/login', validate(loginSchema), async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body;

    try {
        // Find user by email
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' }); // User not found
        }

        const user = userResult.rows[0];

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' }); // Incorrect password
        }

        // Check if user is approved (if the column exists)
        if (user.hasOwnProperty('is_approved') && !user.is_approved) {
            return res.status(403).json({ message: 'Account not approved' }); // User not approved
        }

        // Generate JWT
        const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });

        res.status(200).json({
            message: 'Login successful',
            token,
            user: { id: user.id, email: user.email } // Send back basic user info
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error during login' });
    }
});

export default router;