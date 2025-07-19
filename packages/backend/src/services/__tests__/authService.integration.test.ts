/**
 * Integration tests for AuthService
 *
 * Tests authentication flow with real database and token generation
 * Enhanced with advanced test utilities for better performance monitoring
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { AuthService } from '../authService';
import { TokenService } from '../tokenService';
import { EmailService } from '../emailService';
import pool from '../../config/database';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

// Import enhanced test utilities
import {
  createTestUser,
  createMockServiceRegistry,
  withPerformanceMonitoring,
  cleanupTestData,
  TestDataFactory,
} from '../__tests__/helpers/integrationTestUtils';

describe('AuthService Integration Tests', () => {
  let authService: AuthService;
  let tokenService: TokenService;
  let emailService: EmailService;
  let testUserId: string;

  beforeAll(async () => {
    // Initialize services
    tokenService = new TokenService();
    emailService = new EmailService();
    authService = new AuthService(tokenService, emailService);

    // Clean up test data using enhanced utility
    await cleanupTestData();
  });

  afterAll(async () => {
    // Clean up test data using enhanced utility
    await cleanupTestData();
  });

  beforeEach(async () => {
    // Clean up any existing test data using enhanced utility
    await cleanupTestData();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      return withPerformanceMonitoring('api-integration', async () => {
        const userData = TestDataFactory.createUserData({
          email: 'newuser@test.integration.com',
          password: 'TestPassword123!',
          name: 'Test User',
        });

        const result = await authService.register(
          userData.email,
          userData.password,
          userData.name
        );

        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('email', userData.email);
        expect(result).toHaveProperty('name', userData.name);
        expect(result).toHaveProperty('accessToken');
        expect(result).toHaveProperty('refreshToken');

        // Verify user exists in database
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [userData.email]);
        expect(userResult.rows).toHaveLength(1);
        expect(userResult.rows[0].email).toBe(userData.email);

        testUserId = result.id;
      });
    });

    it('should not register duplicate email', async () => {
      const email = 'duplicate@test.integration.com';
      const password = 'TestPassword123!';
      const name = 'Test User';

      // Register first user
      await authService.register(email, password, name);

      // Try to register duplicate
      await expect(authService.register(email, password, name)).rejects.toThrow();
    });

    it('should hash password correctly', async () => {
      const email = 'hashtest@test.integration.com';
      const password = 'TestPassword123!';
      const name = 'Test User';

      await authService.register(email, password, name);

      // Check password is hashed
      const result = await pool.query('SELECT password FROM users WHERE email = $1', [email]);
      expect(result.rows[0].password).not.toBe(password);
      expect(await bcrypt.compare(password, result.rows[0].password)).toBe(true);
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      // Create test user
      const hashedPassword = await bcrypt.hash('TestPassword123!', 10);
      const result = await pool.query(
        'INSERT INTO users (id, email, password, name) VALUES ($1, $2, $3, $4) RETURNING id',
        [uuidv4(), 'login@test.integration.com', hashedPassword, 'Test User']
      );
      testUserId = result.rows[0].id;
    });

    it('should login with correct credentials', async () => {
      const result = await authService.login('login@test.integration.com', 'TestPassword123!');

      expect(result).toHaveProperty('id', testUserId);
      expect(result).toHaveProperty('email', 'login@test.integration.com');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should reject invalid password', async () => {
      await expect(
        authService.login('login@test.integration.com', 'WrongPassword')
      ).rejects.toThrow('Invalid credentials');
    });

    it('should reject non-existent user', async () => {
      await expect(
        authService.login('nonexistent@test.integration.com', 'TestPassword123!')
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('verifyToken', () => {
    let accessToken: string;

    beforeEach(async () => {
      // Create test user and get token
      const hashedPassword = await bcrypt.hash('TestPassword123!', 10);
      const result = await pool.query(
        'INSERT INTO users (id, email, password, name) VALUES ($1, $2, $3, $4) RETURNING id',
        [uuidv4(), 'verify@test.integration.com', hashedPassword, 'Test User']
      );
      testUserId = result.rows[0].id;

      const loginResult = await authService.login(
        'verify@test.integration.com',
        'TestPassword123!'
      );
      accessToken = loginResult.accessToken;
    });

    it('should verify valid token', async () => {
      const result = await authService.verifyToken(accessToken);
      expect(result).toHaveProperty('userId', testUserId);
    });

    it('should reject invalid token', async () => {
      await expect(authService.verifyToken('invalid-token')).rejects.toThrow();
    });

    it('should reject expired token', async () => {
      // Create an expired token
      const expiredToken = tokenService.generateAccessToken({
        userId: testUserId,
        email: 'test@test.integration.com',
      });

      // Mock time to make token expired
      const originalVerify = tokenService.verifyAccessToken;
      tokenService.verifyAccessToken = () => {
        throw new Error('Token expired');
      };

      await expect(authService.verifyToken(expiredToken)).rejects.toThrow();

      // Restore original method
      tokenService.verifyAccessToken = originalVerify;
    });
  });

  describe('refreshToken', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Create test user and get tokens
      const hashedPassword = await bcrypt.hash('TestPassword123!', 10);
      const result = await pool.query(
        'INSERT INTO users (id, email, password, name) VALUES ($1, $2, $3, $4) RETURNING id',
        [uuidv4(), 'refresh@test.integration.com', hashedPassword, 'Test User']
      );
      testUserId = result.rows[0].id;

      const loginResult = await authService.login(
        'refresh@test.integration.com',
        'TestPassword123!'
      );
      refreshToken = loginResult.refreshToken;
    });

    it('should refresh tokens with valid refresh token', async () => {
      const result = await authService.refreshAccessToken(refreshToken);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
    });

    it('should reject invalid refresh token', async () => {
      await expect(authService.refreshAccessToken('invalid-token')).rejects.toThrow();
    });
  });

  describe('resetPassword', () => {
    beforeEach(async () => {
      // Create test user
      const hashedPassword = await bcrypt.hash('OldPassword123!', 10);
      const result = await pool.query(
        'INSERT INTO users (id, email, password, name) VALUES ($1, $2, $3, $4) RETURNING id',
        [uuidv4(), 'reset@test.integration.com', hashedPassword, 'Test User']
      );
      testUserId = result.rows[0].id;
    });

    it('should initiate password reset', async () => {
      const result = await authService.initiatePasswordReset('reset@test.integration.com');

      expect(result).toHaveProperty('message');
      expect(result.message).toContain('reset link');

      // Verify reset token is stored
      const tokenResult = await pool.query('SELECT reset_token FROM users WHERE id = $1', [
        testUserId,
      ]);
      expect(tokenResult.rows[0].reset_token).toBeTruthy();
    });

    it('should reset password with valid token', async () => {
      // Initiate reset first
      await authService.initiatePasswordReset('reset@test.integration.com');

      // Get reset token from database
      const tokenResult = await pool.query('SELECT reset_token FROM users WHERE id = $1', [
        testUserId,
      ]);
      const resetToken = tokenResult.rows[0].reset_token;

      // Reset password
      const newPassword = 'NewPassword123!';
      await authService.resetPassword(resetToken, newPassword);

      // Verify can login with new password
      const loginResult = await authService.login('reset@test.integration.com', newPassword);
      expect(loginResult).toHaveProperty('accessToken');
    });
  });

  describe('updateProfile', () => {
    beforeEach(async () => {
      // Create test user
      const hashedPassword = await bcrypt.hash('TestPassword123!', 10);
      const result = await pool.query(
        'INSERT INTO users (id, email, password, name) VALUES ($1, $2, $3, $4) RETURNING id',
        [uuidv4(), 'update@test.integration.com', hashedPassword, 'Test User']
      );
      testUserId = result.rows[0].id;
    });

    it('should update user profile', async () => {
      const updates = {
        name: 'Updated Name',
        bio: 'Updated bio',
        organization: 'Test Org',
      };

      const result = await authService.updateProfile(testUserId, updates);

      expect(result).toHaveProperty('name', updates.name);
      expect(result).toHaveProperty('bio', updates.bio);
      expect(result).toHaveProperty('organization', updates.organization);

      // Verify in database
      const dbResult = await pool.query('SELECT name, bio, organization FROM users WHERE id = $1', [
        testUserId,
      ]);
      expect(dbResult.rows[0]).toMatchObject(updates);
    });
  });

  describe('deleteAccount', () => {
    beforeEach(async () => {
      // Create test user
      const hashedPassword = await bcrypt.hash('TestPassword123!', 10);
      const result = await pool.query(
        'INSERT INTO users (id, email, password, name) VALUES ($1, $2, $3, $4) RETURNING id',
        [uuidv4(), 'delete@test.integration.com', hashedPassword, 'Test User']
      );
      testUserId = result.rows[0].id;
    });

    it('should soft delete user account', async () => {
      await authService.deleteAccount(testUserId);

      // Verify user is marked as deleted
      const result = await pool.query('SELECT deleted_at FROM users WHERE id = $1', [testUserId]);
      expect(result.rows[0].deleted_at).toBeTruthy();

      // Verify cannot login
      await expect(
        authService.login('delete@test.integration.com', 'TestPassword123!')
      ).rejects.toThrow();
    });
  });
});
