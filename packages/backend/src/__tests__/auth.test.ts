/**
 * Authentication Tests
 *
 * This file contains tests for the authentication endpoints and middleware.
 */

import request from 'supertest';
import app from '../app';
import jwt from 'jsonwebtoken';
import config from '../config';
import db from '../db';

// Mock database queries
jest.mock('../db', () => {
  const mockQuery = jest.fn();
  return {
    __esModule: true,
    default: {
      query: mockQuery,
    },
    query: mockQuery,
  };
});

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

// Get the mocked functions
const mockQuery = require('../db').default.query;
const mockBcrypt = require('bcryptjs');

describe('Authentication Endpoints', () => {
  // Clear mock calls before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should return 400 if email is missing', async () => {
      const response = await request(app).post('/api/auth/login').send({ password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 if password is missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 401 if user not found', async () => {
      // Mock query to return empty result
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'password123' });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message');
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should return 401 if password is incorrect', async () => {
      // Mock user found but password check fails
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: '123',
            email: 'test@example.com',
            password_hash: 'hashedPasswordInvalid',
          },
        ],
      });

      // Mock bcrypt.compare to return false (password doesn't match)
      mockBcrypt.compare.mockResolvedValueOnce(false);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrongpassword' });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message');
    });

    it('should return 200 with token if login successful', async () => {
      // Mock user found
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        password_hash: 'hashedPassword',
      };

      // Mock successful user query
      mockQuery.mockResolvedValueOnce({
        rows: [mockUser],
      });

      // Mock bcrypt.compare to return true (password matches)
      mockBcrypt.compare.mockResolvedValueOnce(true);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('refreshToken');
      expect(mockQuery).toHaveBeenCalled();
      expect(mockBcrypt.compare).toHaveBeenCalledWith('password123', 'hashedPassword');
    });
  });

  describe('POST /api/auth/register', () => {
    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com' }); // Missing password

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 409 if email already exists', async () => {
      // Mock query to check if email exists - returns user found
      mockQuery.mockResolvedValueOnce({
        rows: [{ email: 'existing@example.com' }],
      });

      const response = await request(app).post('/api/auth/register').send({
        email: 'existing@example.com',
        password: 'password123',
        name: 'Test User',
      });

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('message');
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should return 201 if registration successful', async () => {
      // Mock queries for registration
      mockQuery
        // First query: check if email exists (return empty result)
        .mockResolvedValueOnce({ rows: [] })
        // Second query: start transaction
        .mockResolvedValueOnce({})
        // Third query: insert user (return user ID)
        .mockResolvedValueOnce({ rows: [{ id: '123' }] })
        // Fourth query: insert profile
        .mockResolvedValueOnce({ rows: [{ user_id: '123' }] })
        // Fifth query: commit transaction
        .mockResolvedValueOnce({});

      // Mock bcrypt.hash for password
      mockBcrypt.hash.mockResolvedValueOnce('hashedPassword');

      const response = await request(app).post('/api/auth/register').send({
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
      });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('refreshToken');
      expect(mockBcrypt.hash).toHaveBeenCalledWith('password123', expect.any(Number));
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return 401 if no token provided', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 401 if token is invalid', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid_token');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should return user data if token is valid', async () => {
      // Create a valid token
      const user = { userId: '123', email: 'test@example.com' };
      const token = jwt.sign(user, config.auth.jwtSecret, { expiresIn: '1h' });

      // Mock user query
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: '123',
            email: 'test@example.com',
            name: 'Test User',
          },
        ],
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', '123');
      expect(response.body).toHaveProperty('email', 'test@example.com');
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });
});

describe('Authentication Middleware', () => {
  it('should protect routes that require authentication', async () => {
    const response = await request(app).get('/api/projects'); // Protected route

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error');
  });

  it('should allow access to protected routes with valid token', async () => {
    // Create a valid token
    const user = { userId: '123', email: 'test@example.com' };
    const token = jwt.sign(user, config.auth.jwtSecret, { expiresIn: '1h' });

    // Mock project query
    mockQuery.mockResolvedValueOnce({
      rows: [],
    });

    const response = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
  });
});
