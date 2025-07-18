/**
 * Enhanced Authentication Routes Tests
 * Tests for enhanced validation, sanitization, and security features
 */

import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';
import authEnhancedRouter from '../auth.enhanced';
import authService from '../../services/authService';

// Mock the auth service
jest.mock('../../services/authService');
const mockAuthService = authService as jest.Mocked<typeof authService>;

// Mock the auth middleware
jest.mock('../../security/middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = { userId: 'test-user-id' };
    next();
  },
  optionalAuthenticate: (req: any, res: any, next: any) => {
    req.user = { userId: 'test-user-id' };
    next();
  },
}));

describe('Enhanced Auth Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/auth', authEnhancedRouter);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register user with valid data', async () => {
      const mockResult = {
        user: { id: '123', email: 'test@example.com', name: 'Test User' },
        token: 'mock-token',
      };

      mockAuthService.registerUser.mockResolvedValue(mockResult);

      const validData = {
        email: 'test@example.com',
        password: 'StrongPass123!',
        confirmPassword: 'StrongPass123!',
        name: 'Test User',
        terms: true,
      };

      const response = await request(app).post('/api/auth/register').send(validData).expect(201);

      expect(response.body).toEqual(mockResult);
      expect(mockAuthService.registerUser).toHaveBeenCalledWith(
        'test@example.com',
        'StrongPass123!',
        'Test User',
        undefined
      );
    });

    it('should sanitize XSS attempts in name field', async () => {
      const mockResult = {
        user: { id: '123', email: 'test@example.com', name: 'Test User' },
        token: 'mock-token',
      };

      mockAuthService.registerUser.mockResolvedValue(mockResult);

      const maliciousData = {
        email: 'test@example.com',
        password: 'StrongPass123!',
        confirmPassword: 'StrongPass123!',
        name: '<script>alert("xss")</script>Test User',
        terms: true,
      };

      await request(app)
        .post('/api/auth/register')
        .send(maliciousData)
        .expect(201);

      // Verify that the script tag was removed
      expect(mockAuthService.registerUser).toHaveBeenCalledWith(
        'test@example.com',
        'StrongPass123!',
        'Test User',
        undefined
      );
    });

    it('should reject weak passwords', async () => {
      const weakPasswordData = {
        email: 'test@example.com',
        password: 'weak',
        confirmPassword: 'weak',
        name: 'Test User',
        terms: true,
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(weakPasswordData)
        .expect(400);

      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors).toBeDefined();
    });

    it('should reject mismatched passwords', async () => {
      const mismatchedData = {
        email: 'test@example.com',
        password: 'StrongPass123!',
        confirmPassword: 'DifferentPass123!',
        name: 'Test User',
        terms: true,
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(mismatchedData)
        .expect(400);

      expect(response.body.message).toBe('Validation failed');
    });

    it('should reject registration without terms acceptance', async () => {
      const noTermsData = {
        email: 'test@example.com',
        password: 'StrongPass123!',
        confirmPassword: 'StrongPass123!',
        name: 'Test User',
        terms: false,
      };

      const response = await request(app).post('/api/auth/register').send(noTermsData).expect(400);

      expect(response.body.message).toBe('Validation failed');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const mockResult = {
        user: { id: '123', email: 'test@example.com' },
        token: 'mock-token',
      };

      mockAuthService.loginUser.mockResolvedValue(mockResult);

      const loginData = {
        email: 'test@example.com',
        password: 'StrongPass123!',
        rememberMe: true,
      };

      const response = await request(app).post('/api/auth/login').send(loginData).expect(200);

      expect(response.body).toEqual(mockResult);
      expect(mockAuthService.loginUser).toHaveBeenCalledWith(
        'test@example.com',
        'StrongPass123!',
        true
      );
    });

    it('should sanitize email input', async () => {
      const mockResult = {
        user: { id: '123', email: 'test@example.com' },
        token: 'mock-token',
      };

      mockAuthService.loginUser.mockResolvedValue(mockResult);

      const loginData = {
        email: '  TEST@EXAMPLE.COM  ',
        password: 'StrongPass123!',
      };

      await request(app).post('/api/auth/login').send(loginData).expect(200);

      // Email should be normalized to lowercase and trimmed
      expect(mockAuthService.loginUser).toHaveBeenCalledWith(
        'test@example.com',
        'StrongPass123!',
        undefined
      );
    });

    it('should reject invalid email format', async () => {
      const invalidEmailData = {
        email: 'not-an-email',
        password: 'StrongPass123!',
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(invalidEmailData)
        .expect(400);

      expect(response.body.message).toBe('Validation failed');
    });
  });

  describe('GET /api/auth/check-email', () => {
    it('should check email existence with valid email', async () => {
      const mockResult = {
        exists: true,
        hasAccessRequest: false,
      };

      mockAuthService.checkEmailExists.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/auth/check-email')
        .query({ email: 'test@example.com' })
        .expect(200);

      expect(response.body.exists).toBe(true);
      expect(mockAuthService.checkEmailExists).toHaveBeenCalledWith('test@example.com');
    });

    it('should reject invalid email in query', async () => {
      const response = await request(app)
        .get('/api/auth/check-email')
        .query({ email: 'invalid-email' })
        .expect(400);

      expect(response.body.message).toBe('Query validation failed');
    });
  });

  describe('PUT /api/auth/change-password', () => {
    it('should change password with valid data', async () => {
      mockAuthService.changePassword.mockResolvedValue(undefined);

      const changePasswordData = {
        current_password: 'OldPass123!',
        new_password: 'NewPass456!',
        confirm_password: 'NewPass456!',
      };

      const response = await request(app)
        .put('/api/auth/change-password')
        .send(changePasswordData)
        .expect(200);

      expect(response.body.message).toBe('Password changed successfully');
      expect(mockAuthService.changePassword).toHaveBeenCalledWith(
        'test-user-id',
        'OldPass123!',
        'NewPass456!'
      );
    });

    it('should reject mismatched new passwords', async () => {
      const mismatchedData = {
        current_password: 'OldPass123!',
        new_password: 'NewPass456!',
        confirm_password: 'DifferentPass789!',
      };

      const response = await request(app)
        .put('/api/auth/change-password')
        .send(mismatchedData)
        .expect(400);

      expect(response.body.message).toBe('Validation failed');
    });
  });

  describe('Security Features', () => {
    it('should reject non-JSON content type', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'text/plain')
        .send('email=test@example.com&password=test')
        .expect(400);

      expect(response.body.message).toBe('Invalid Content-Type. Allowed: application/json');
    });

    it('should sanitize request data', async () => {
      const mockResult = {
        user: { id: '123', email: 'test@example.com' },
        token: 'mock-token',
      };

      mockAuthService.loginUser.mockResolvedValue(mockResult);

      const maliciousData = {
        email: 'test@example.com',
        password: 'StrongPass123!',
        maliciousField: '<script>alert("xss")</script>',
      };

      // Should still work despite the malicious field being sanitized
      const response = await request(app).post('/api/auth/login').send(maliciousData).expect(200);

      expect(response.body).toEqual(mockResult);
    });

    describe('Rate Limiting', () => {
      it('should allow requests within rate limit', async () => {
        mockAuthService.loginUser.mockResolvedValue({
          user: { id: '123', email: 'test@example.com' },
          token: 'mock-token',
        });

        // Make multiple requests (should be within limit)
        for (let i = 0; i < 5; i++) {
          await request(app)
            .post('/api/auth/login')
            .send({
              email: 'test@example.com',
              password: 'StrongPass123!',
            })
            .expect(200);
        }
      });

      // Note: Full rate limiting test would require more complex setup
      // to simulate going over the limit within the time window
    });
  });

  describe('Error Handling', () => {
    it('should handle auth service errors properly', async () => {
      const authError = new Error('Authentication failed');
      mockAuthService.loginUser.mockRejectedValue(authError);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrong-password',
        })
        .expect(500);

      expect(response.body.message).toBe('Failed to login');
    });
  });

  describe('Enhanced Test Route', () => {
    it('should return enhanced features list', async () => {
      const response = await request(app).get('/api/auth/test').expect(200);

      expect(response.body.message).toBe('Enhanced auth routes are working');
      expect(response.body.features).toContain('Input sanitization');
      expect(response.body.features).toContain('Enhanced validation');
      expect(response.body.features).toContain('Rate limiting');
    });
  });
});
