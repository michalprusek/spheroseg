import request from 'supertest';
import { Express } from 'express';
import { IMemoryDb, newDb } from 'pg-mem';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// --- Import Fixed Mock IDs from setup ---
const {
  MOCK_USER_ID: testUserId,
  MOCK_EMAIL: testEmail,
  MOCK_ADMIN_USER_ID: adminUserId,
} = require('../../../jest.setup.js');

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  unlinkSync: jest.fn(),
  writeFileSync: jest.fn(),
  access: jest.fn().mockImplementation((path, mode, callback) => {
    callback(null); // Always success
  }),
  constants: {
    F_OK: 0,
  },
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    chmod: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock multer
jest.mock('multer', () => {
  const multerInstance = {
    // Mock single() method for avatar uploads
    single: (fieldName: string) => {
      return (req: any, res: any, next: () => void) => {
        if (req.headers['content-type']?.includes('multipart/form-data')) {
          req.file = {
            fieldname: fieldName,
            originalname: 'test-avatar.jpg',
            encoding: '7bit',
            mimetype: 'image/jpeg',
            destination: '/tmp/uploads/avatars',
            filename: `avatar-${Date.now()}.jpg`,
            path: `/tmp/uploads/avatars/avatar-${Date.now()}.jpg`,
            size: 54321,
          };
        }
        next();
      };
    },
    diskStorage: jest.fn(() => ({})),
  };

  // Return a function that returns the multerInstance
  const multerFn = () => multerInstance;
  (multerFn as any).diskStorage = multerInstance.diskStorage;

  return multerFn;
});

describe('User Routes', () => {
  let app: Express;

  beforeAll(() => {
    // Setup Express app with only the user routes
    const express = require('express');
    const userRoutes = require('../users').default;

    app = express();
    app.use(express.json());

    // Mock authentication middleware to always set the user ID
    app.use((req: any, res: any, next: () => void) => {
      req.user = {
        userId: req.headers['x-user-id'] === 'admin' ? adminUserId : testUserId,
        email: testEmail,
        role: req.headers['x-user-id'] === 'admin' ? 'ADMIN' : 'USER',
      };
      next();
    });

    // Register routes directly
    app.use('/api/users', userRoutes);

    // Add error handling middleware
    app.use((err: any, req: any, res: any, next: () => void) => {
      res.status(err.statusCode || 500).json({
        message: err.message || 'Internal Server Error',
        errors: err.errors,
      });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/users/me', () => {
    it('should return the current user profile', async () => {
      const res = await request(app).get('/api/users/me');

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('id', testUserId);
      expect(res.body).toHaveProperty('email', testEmail);
    });
  });

  describe('PUT /api/users/me', () => {
    it('should update the user profile with valid data', async () => {
      const updateData = {
        name: 'Updated Name',
        username: 'updatedUsername',
        full_name: 'Updated Full Name',
        preferred_language: 'cs',
      };

      const res = await request(app).put('/api/users/me').send(updateData);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('name', updateData.name);
      expect(res.body).toHaveProperty('username', updateData.username);
      expect(res.body).toHaveProperty('full_name', updateData.full_name);
      expect(res.body).toHaveProperty('preferred_language', updateData.preferred_language);
    });

    it('should return 409 when email is already in use', async () => {
      const updateData = {
        email: 'existing@example.com',
      };

      const res = await request(app).put('/api/users/me').send(updateData);

      expect(res.statusCode).toEqual(409);
      expect(res.body).toHaveProperty('message', 'Email already in use by another account');
    });
  });

  describe('POST /api/users/me/avatar', () => {
    it('should upload an avatar successfully', async () => {
      const res = await request(app)
        .post('/api/users/me/avatar')
        .set('Content-Type', 'multipart/form-data')
        .attach('avatar', Buffer.from('fake image data'), 'avatar.jpg');

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('avatar_url');
      expect(res.body).toHaveProperty('message', 'Avatar uploaded successfully');
    });

    it('should return 400 if no file is provided', async () => {
      const res = await request(app).post('/api/users/me/avatar');

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('message', 'No avatar file uploaded');
    });
  });

  describe('Admin Routes', () => {
    describe('GET /api/users', () => {
      it('should return all users for admin', async () => {
        const res = await request(app).get('/api/users').set('x-user-id', 'admin');

        expect(res.statusCode).toEqual(200);
        expect(Array.isArray(res.body)).toBe(true);
      });

      it('should return 403 for non-admin users', async () => {
        const res = await request(app).get('/api/users');

        expect(res.statusCode).toEqual(403);
      });
    });

    describe('PUT /api/users/:userId/approve', () => {
      it('should approve a user as admin', async () => {
        const userId = uuidv4();

        const res = await request(app).put(`/api/users/${userId}/approve`).set('x-user-id', 'admin');

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('message', 'User approved successfully');
      });

      it('should return 403 for non-admin users', async () => {
        const userId = uuidv4();

        const res = await request(app).put(`/api/users/${userId}/approve`);

        expect(res.statusCode).toEqual(403);
      });
    });

    describe('PUT /api/users/:userId/role', () => {
      it('should change user role as admin', async () => {
        const userId = uuidv4();

        const res = await request(app)
          .put(`/api/users/${userId}/role`)
          .set('x-user-id', 'admin')
          .send({ role: 'admin' });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('message', 'User role updated successfully');
      });

      it('should return 403 for non-admin users', async () => {
        const userId = uuidv4();

        const res = await request(app).put(`/api/users/${userId}/role`).send({ role: 'admin' });

        expect(res.statusCode).toEqual(403);
      });
    });
  });

  describe('GET /api/users/me/statistics', () => {
    it('should return user statistics', async () => {
      const res = await request(app).get('/api/users/me/statistics');

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('totalProjects');
      expect(res.body).toHaveProperty('totalImages');
      expect(res.body).toHaveProperty('completedSegmentations');
      expect(res.body).toHaveProperty('storageLimitBytes');
      expect(res.body).toHaveProperty('storageUsedBytes');
      expect(res.body).toHaveProperty('comparisons');
    });
  });
});
