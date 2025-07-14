import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as authService from '../authService';
import pool from '../../db';
import config from '../../config';
import { ApiError } from '../../utils/ApiError';
import * as emailService from '../emailService';

// Mock dependencies
jest.mock('../../db');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');
jest.mock('../emailService');
jest.mock('../../config', () => ({
  auth: {
    jwtSecret: 'test-secret',
    jwtExpiresIn: '1d',
    saltRounds: 10,
  },
  appUrl: 'http://test.com',
}));

describe('AuthService', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    password_hash: 'hashed_password',
    created_at: new Date(),
    updated_at: new Date(),
    role: 'user',
    is_active: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      // Arrange
      const userData = {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        name: 'New User',
      };
      const hashedPassword = 'hashed_password_123';
      const newUserId = 'new-user-123';

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // Check existing user
        .mockResolvedValueOnce({ // Insert new user
          rows: [{
            id: newUserId,
            email: userData.email,
            name: userData.name,
            created_at: new Date(),
            updated_at: new Date(),
            role: 'user',
            is_active: true,
          }],
        });
      
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      (jwt.sign as jest.Mock).mockReturnValue('test-token');

      // Act
      const result = await authService.register(userData);

      // Assert
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(result.user.email).toBe(userData.email);
      expect(result.user.password_hash).toBeUndefined(); // Password should not be returned
      expect(bcrypt.hash).toHaveBeenCalledWith(userData.password, config.auth.saltRounds);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    it('should throw error if user already exists', async () => {
      // Arrange
      const userData = {
        email: 'existing@example.com',
        password: 'SecurePass123!',
        name: 'Existing User',
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockUser] });

      // Act & Assert
      await expect(authService.register(userData)).rejects.toThrow(ApiError);
      await expect(authService.register(userData)).rejects.toThrow('User with this email already exists');
    });

    it('should validate password requirements', async () => {
      // Arrange
      const userData = {
        email: 'test@example.com',
        password: 'weak',
        name: 'Test User',
      };

      // Act & Assert
      await expect(authService.register(userData)).rejects.toThrow(ApiError);
      await expect(authService.register(userData)).rejects.toThrow('Password must be at least 8 characters');
    });
  });

  describe('login', () => {
    it('should login user successfully with correct credentials', async () => {
      // Arrange
      const credentials = {
        email: 'test@example.com',
        password: 'CorrectPassword123!',
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockUser] });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValue('test-token');

      // Act
      const result = await authService.login(credentials);

      // Assert
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(result.user.email).toBe(credentials.email);
      expect(bcrypt.compare).toHaveBeenCalledWith(credentials.password, mockUser.password_hash);
    });

    it('should throw error for non-existent user', async () => {
      // Arrange
      const credentials = {
        email: 'nonexistent@example.com',
        password: 'Password123!',
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      // Act & Assert
      await expect(authService.login(credentials)).rejects.toThrow(ApiError);
      await expect(authService.login(credentials)).rejects.toThrow('Invalid email or password');
    });

    it('should throw error for incorrect password', async () => {
      // Arrange
      const credentials = {
        email: 'test@example.com',
        password: 'WrongPassword123!',
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockUser] });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(authService.login(credentials)).rejects.toThrow(ApiError);
      await expect(authService.login(credentials)).rejects.toThrow('Invalid email or password');
    });

    it('should throw error for inactive user', async () => {
      // Arrange
      const credentials = {
        email: 'test@example.com',
        password: 'CorrectPassword123!',
      };
      const inactiveUser = { ...mockUser, is_active: false };

      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [inactiveUser] });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Act & Assert
      await expect(authService.login(credentials)).rejects.toThrow(ApiError);
      await expect(authService.login(credentials)).rejects.toThrow('Account is deactivated');
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', async () => {
      // Arrange
      const token = 'valid-token';
      const payload = { id: 'user-123', email: 'test@example.com' };

      (jwt.verify as jest.Mock).mockReturnValue(payload);

      // Act
      const result = await authService.verifyToken(token);

      // Assert
      expect(result).toEqual(payload);
      expect(jwt.verify).toHaveBeenCalledWith(token, config.auth.jwtSecret);
    });

    it('should throw error for invalid token', async () => {
      // Arrange
      const token = 'invalid-token';

      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act & Assert
      await expect(authService.verifyToken(token)).rejects.toThrow('Invalid token');
    });
  });

  describe('getUserById', () => {
    it('should return user by id', async () => {
      // Arrange
      const userId = 'user-123';

      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockUser] });

      // Act
      const result = await authService.getUserById(userId);

      // Assert
      expect(result).toEqual(mockUser);
      expect(result.password_hash).toBeUndefined();
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [userId]
      );
    });

    it('should return null for non-existent user', async () => {
      // Arrange
      const userId = 'non-existent';

      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      // Act
      const result = await authService.getUserById(userId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('updatePassword', () => {
    it('should update password successfully', async () => {
      // Arrange
      const userId = 'user-123';
      const oldPassword = 'OldPassword123!';
      const newPassword = 'NewPassword123!';
      const hashedNewPassword = 'hashed_new_password';

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockUser] }) // Get user
        .mockResolvedValueOnce({ rows: [{ ...mockUser, password_hash: hashedNewPassword }] }); // Update password
      
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedNewPassword);

      // Act
      const result = await authService.updatePassword(userId, oldPassword, newPassword);

      // Assert
      expect(result).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith(oldPassword, mockUser.password_hash);
      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, config.auth.saltRounds);
    });

    it('should throw error for incorrect old password', async () => {
      // Arrange
      const userId = 'user-123';
      const oldPassword = 'WrongOldPassword123!';
      const newPassword = 'NewPassword123!';

      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockUser] });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(authService.updatePassword(userId, oldPassword, newPassword)).rejects.toThrow('Incorrect password');
    });
  });

  describe('forgotPassword', () => {
    it('should send password reset email for existing user', async () => {
      // Arrange
      const email = 'test@example.com';
      const resetToken = 'reset-token-123';

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockUser] }) // Find user
        .mockResolvedValueOnce({ rows: [] }); // Update reset token
      
      (jwt.sign as jest.Mock).mockReturnValue(resetToken);
      (emailService.sendPasswordResetEmail as jest.Mock).mockResolvedValue(undefined);

      // Act
      const result = await authService.forgotPassword(email);

      // Assert
      expect(result).toBe(true);
      expect(jwt.sign).toHaveBeenCalledWith(
        { id: mockUser.id, email: mockUser.email },
        config.auth.jwtSecret,
        { expiresIn: '1h' }
      );
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(email, resetToken);
    });

    it('should return true even for non-existent user (security)', async () => {
      // Arrange
      const email = 'nonexistent@example.com';

      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      // Act
      const result = await authService.forgotPassword(email);

      // Assert
      expect(result).toBe(true);
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      // Arrange
      const token = 'valid-reset-token';
      const newPassword = 'NewPassword123!';
      const hashedPassword = 'hashed_new_password';
      const tokenPayload = { id: 'user-123', email: 'test@example.com' };

      (jwt.verify as jest.Mock).mockReturnValue(tokenPayload);
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ reset_token: token }] }) // Verify token in DB
        .mockResolvedValueOnce({ rows: [mockUser] }); // Update password
      
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

      // Act
      const result = await authService.resetPassword(token, newPassword);

      // Assert
      expect(result).toBe(true);
      expect(jwt.verify).toHaveBeenCalledWith(token, config.auth.jwtSecret);
      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, config.auth.saltRounds);
    });

    it('should throw error for invalid token', async () => {
      // Arrange
      const token = 'invalid-token';
      const newPassword = 'NewPassword123!';

      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act & Assert
      await expect(authService.resetPassword(token, newPassword)).rejects.toThrow('Invalid or expired reset token');
    });
  });

  describe('refreshToken', () => {
    it('should refresh token for valid user', async () => {
      // Arrange
      const oldToken = 'old-token';
      const payload = { id: 'user-123', email: 'test@example.com' };
      const newToken = 'new-token';

      (jwt.verify as jest.Mock).mockReturnValue(payload);
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockUser] });
      (jwt.sign as jest.Mock).mockReturnValue(newToken);

      // Act
      const result = await authService.refreshToken(oldToken);

      // Assert
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token', newToken);
      expect(jwt.verify).toHaveBeenCalledWith(oldToken, config.auth.jwtSecret);
    });

    it('should throw error for invalid token', async () => {
      // Arrange
      const oldToken = 'invalid-token';

      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act & Assert
      await expect(authService.refreshToken(oldToken)).rejects.toThrow('Invalid token');
    });
  });
});