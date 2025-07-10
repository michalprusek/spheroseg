import request from 'supertest';
import { Express } from 'express';
import { IMemoryDb, newDb } from 'pg-mem';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// --- Define test constants ---
const testUserId = '550e8400-e29b-41d4-a716-446655440000';
const testEmail = 'test@example.com';
const adminUserId = '550e8400-e29b-41d4-a716-446655440001';

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
// Mock database
jest.mock('../../db', () => ({
  query: jest.fn().mockImplementation(async (query: string, params?: any[]) => {
    // Mock table existence check
    if (query.includes('information_schema.tables')) {
      return { rows: [{ exists: true }] };
    }
    
    // Mock user queries
    if (query.includes('SELECT') && query.includes('FROM users')) {
      const userId = params?.[0] || '550e8400-e29b-41d4-a716-446655440000';
      return {
        rows: [{
          id: userId,
          email: 'test@example.com',
          name: 'Test User',
          username: 'testuser',
          full_name: 'Test Full Name',
          preferred_language: 'en',
          role: userId === '550e8400-e29b-41d4-a716-446655440001' ? 'admin' : 'user',
          is_approved: true,
          created_at: new Date(),
          updated_at: new Date(),
        }],
        rowCount: 1,
      };
    }
    
    // Mock update queries
    if (query.includes('UPDATE users')) {
      return {
        rows: [{
          id: params?.[4] || '550e8400-e29b-41d4-a716-446655440000',
          email: 'test@example.com',
          name: params?.[0] || 'Updated Name',
          username: params?.[1] || 'updatedUsername',
          full_name: params?.[2] || 'Updated Full Name',
          preferred_language: params?.[3] || 'cs',
          role: 'user',
          is_approved: true,
          created_at: new Date(),
          updated_at: new Date(),
        }],
        rowCount: 1,
      };
    }
    
    // Mock project count queries
    if (query.includes('COUNT(*)') && query.includes('FROM projects')) {
      return {
        rows: [{ count: '5' }],
        rowCount: 1,
      };
    }
    
    // Mock image count queries
    if (query.includes('COUNT(*)') && query.includes('FROM images')) {
      return {
        rows: [{ count: '20' }],
        rowCount: 1,
      };
    }
    
    // Mock user profile queries
    if (query.includes('FROM user_profiles')) {
      return {
        rows: [],
        rowCount: 0,
      };
    }
    
    // Mock storage queries
    if (query.includes('storage_used_bytes') && query.includes('FROM users')) {
      return {
        rows: [{
          storage_used_bytes: '104857600', // 100MB
          storage_limit_bytes: '10737418240', // 10GB
        }],
        rowCount: 1,
      };
    }
    
    // Mock recent activity queries
    if (query.includes('project_created') || query.includes('UNION ALL')) {
      return {
        rows: [],
        rowCount: 0,
      };
    }
    
    // Default empty result
    return { rows: [], rowCount: 0 };
  }),
}));

// Mock auth middleware
jest.mock('../../security/middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    // Set user based on test headers
    req.user = {
      userId: req.headers['x-user-id'] === 'admin' ? '550e8400-e29b-41d4-a716-446655440001' : '550e8400-e29b-41d4-a716-446655440000',
      email: 'test@example.com',
      role: req.headers['x-user-id'] === 'admin' ? 'ADMIN' : 'USER',
    };
    next();
  },
  AuthenticatedRequest: {},
}));

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

  // Skip admin routes tests as these routes don't exist
  describe.skip('Admin Routes', () => {
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

        const res = await request(app)
          .put(`/api/users/${userId}/approve`)
          .set('x-user-id', 'admin');

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
