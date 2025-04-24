import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';
import authRouter from '../routes/auth';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('hashed-password')
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('test-token')
}));

jest.mock('../db', () => ({
  query: jest.fn()
}));

describe('Authentication API', () => {
  let app: express.Application;
  const db = require('../db');

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      // Mock db.query to return a new user
      db.query.mockResolvedValueOnce({ rows: [] }); // No existing user with the same email
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'test-user-id',
            email: 'test@example.com',
            name: 'Test User',
            username: 'testuser'
          }
        ]
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
          username: 'testuser'
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
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'existing-user-id',
            email: 'test@example.com'
          }
        ]
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
          username: 'testuser'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'User with this email already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login a user with valid credentials', async () => {
      // Mock db.query to return a user
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'test-user-id',
            email: 'test@example.com',
            password: 'hashed-password',
            name: 'Test User',
            username: 'testuser'
          }
        ]
      });

      // Mock bcrypt.compare to return true
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
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
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'Invalid credentials');
    });

    it('should return 401 if password is incorrect', async () => {
      // Mock db.query to return a user
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'test-user-id',
            email: 'test@example.com',
            password: 'hashed-password',
            name: 'Test User',
            username: 'testuser'
          }
        ]
      });

      // Mock bcrypt.compare to return false
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrong-password'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'Invalid credentials');
    });
  });
});
