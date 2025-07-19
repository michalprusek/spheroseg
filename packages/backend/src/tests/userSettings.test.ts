import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';
import usersRouter from '../routes/users';
import bcrypt from 'bcryptjs';

// Mock dependencies
jest.mock('../security/middleware/auth', () => {
  return jest.fn((req: any, res: any, next: any) => {
    req.user = { userId: 'test-user-id' };
    next();
  });
});

jest.mock('bcryptjs', () => ({
  hash: jest.fn(() => Promise.resolve('hashed-password')),
  compare: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('../db', () => ({
  query: jest.fn().mockImplementation((query: string, _params?: any[]) => {
    if (query.includes('SELECT * FROM users WHERE id')) {
      return {
        rows: [
          {
            id: 'test-user-id',
            email: 'test@example.com',
            name: 'Test User',
            username: 'testuser',
            password: 'hashed-password',
            title: 'Researcher',
            organization: 'Test Organization',
            bio: 'This is a test user bio.',
            location: 'Test Location',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      };
    }
    if (query.includes('UPDATE users SET')) {
      return {
        rows: [
          {
            id: 'test-user-id',
            email: 'test@example.com',
            name: 'Updated Test User',
            username: 'updatedtestuser',
            password: 'hashed-password',
            title: 'Senior Researcher',
            organization: 'Updated Test Organization',
            bio: 'This is an updated test user bio.',
            location: 'Updated Test Location',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      };
    }
    return { rows: [] };
  }),
}));

describe('User Settings API', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', usersRouter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/users/me', () => {
    it('should return the current user', async () => {
      const response = await request(app).get('/api/users/me');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 'test-user-id');
      expect(response.body).toHaveProperty('email', 'test@example.com');
      expect(response.body).toHaveProperty('name', 'Test User');
      expect(response.body).toHaveProperty('username', 'testuser');
      expect(response.body).not.toHaveProperty('password');
    });
  });

  describe('PATCH /api/users/me', () => {
    it('should update the current user profile', async () => {
      const response = await request(app).patch('/api/users/me').send({
        name: 'Updated Test User',
        username: 'updatedtestuser',
        title: 'Senior Researcher',
        organization: 'Updated Test Organization',
        bio: 'This is an updated test user bio.',
        location: 'Updated Test Location',
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 'test-user-id');
      expect(response.body).toHaveProperty('name', 'Updated Test User');
      expect(response.body).toHaveProperty('username', 'updatedtestuser');
      expect(response.body).toHaveProperty('title', 'Senior Researcher');
      expect(response.body).toHaveProperty('organization', 'Updated Test Organization');
      expect(response.body).toHaveProperty('bio', 'This is an updated test user bio.');
      expect(response.body).toHaveProperty('location', 'Updated Test Location');
    });

    it('should update the current user password', async () => {
      const response = await request(app).patch('/api/users/me').send({
        currentPassword: 'current-password',
        newPassword: 'new-password',
      });

      expect(response.status).toBe(200);
      expect(bcrypt.compare).toHaveBeenCalledWith('current-password', 'hashed-password');
      expect(bcrypt.hash).toHaveBeenCalledWith('new-password', 10);
    });

    it('should return 400 if current password is incorrect', async () => {
      // Mock bcrypt.compare to return false
      (bcrypt.compare as unknown).mockResolvedValueOnce(false);

      const response = await request(app).patch('/api/users/me').send({
        currentPassword: 'wrong-password',
        newPassword: 'new-password',
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Current password is incorrect');
    });
  });

  describe('DELETE /api/users/me', () => {
    it('should delete the current user', async () => {
      const response = await request(app).delete('/api/users/me');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'User deleted successfully');
    });
  });
});
