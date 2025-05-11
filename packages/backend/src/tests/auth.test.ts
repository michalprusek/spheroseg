/**
 * Authentication Tests
 *
 * Tests for authentication routes with mocked dependencies.
 */

import request from 'supertest';
import express, { Router, Request, Response } from 'express';
import { jest } from '@jest/globals';

// Mock dependencies
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
}));

jest.mock('../db', () => ({
  query: jest.fn(),
}));

// Import mocked modules after they've been mocked
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db';

// Create a mock auth router
const createMockAuthRouter = () => {
  const router = Router();

  // Register endpoint
  router.post('/register', async (req: Request, res: Response) => {
    try {
      const { email, password, name, username } = req.body;

      // Validate input
      if (!email || !password || !name || !username) {
        return res.status(400).json({ message: 'All fields are required' });
      }

      // Check if user exists
      const userCheck = await db.query('SELECT * FROM users WHERE email = $1', [email]);

      if (userCheck.rows.length > 0) {
        return res.status(400).json({ message: 'User with this email already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const result = await db.query(
        'INSERT INTO users (email, password, name, username) VALUES ($1, $2, $3, $4) RETURNING id, email, name, username',
        [email, hashedPassword, name, username],
      );

      const user = result.rows[0];

      // Generate token
      const token = jwt.sign({ id: user.id, email: user.email }, 'test-secret-key', { expiresIn: '1h' });

      res.status(201).json({ user, token });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Login endpoint
  router.post('/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      // Validate input
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      // Find user
      const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);

      if (result.rows.length === 0) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const user = result.rows[0];

      // Compare password
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Generate token
      const token = jwt.sign({ id: user.id, email: user.email }, 'test-secret-key', { expiresIn: '1h' });

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;

      res.status(200).json({ user: userWithoutPassword, token });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  return router;
};

describe('Authentication API', () => {
  let app: express.Application;
  const authRouter = createMockAuthRouter();

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);

    // Reset mock return values
    jest.clearAllMocks();

    // Default mock implementations
    (jwt.sign as jest.Mock).mockReturnValue('test-token');
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      // Mock db.query to return a new user
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] }); // No existing user with the same email
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 'test-user-id',
            email: 'test@example.com',
            name: 'Test User',
            username: 'testuser',
          },
        ],
      });

      const response = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        username: 'testuser',
      });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id', 'test-user-id');
      expect(response.body.user).toHaveProperty('email', 'test@example.com');
      expect(response.body.user).not.toHaveProperty('password');
      expect(response.body).toHaveProperty('token', 'test-token');
    });

    it('should return 400 if email already exists', async () => {
      // Mock db.query to return an existing user
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 'existing-user-id',
            email: 'test@example.com',
          },
        ],
      });

      const response = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        username: 'testuser',
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'User with this email already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login a user with valid credentials', async () => {
      // Mock db.query to return a user
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 'test-user-id',
            email: 'test@example.com',
            password: 'hashed-password',
            name: 'Test User',
            username: 'testuser',
          },
        ],
      });

      // Mock bcrypt.compare to return true
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

      const response = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id', 'test-user-id');
      expect(response.body.user).toHaveProperty('email', 'test@example.com');
      expect(response.body.user).not.toHaveProperty('password');
      expect(response.body).toHaveProperty('token', 'test-token');
    });

    it('should return 401 if user does not exist', async () => {
      // Mock db.query to return no user
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const response = await request(app).post('/api/auth/login').send({
        email: 'nonexistent@example.com',
        password: 'password123',
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'Invalid credentials');
    });

    it('should return 401 if password is incorrect', async () => {
      // Mock db.query to return a user
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 'test-user-id',
            email: 'test@example.com',
            password: 'hashed-password',
            name: 'Test User',
            username: 'testuser',
          },
        ],
      });

      // Mock bcrypt.compare to return false
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      const response = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'wrong-password',
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'Invalid credentials');
    });
  });
});
