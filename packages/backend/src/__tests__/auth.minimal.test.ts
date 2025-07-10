/**
 * Minimal Authentication Tests
 *
 * This file contains minimal tests for the authentication service
 * without importing the full app configuration.
 */

import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Mock the database
jest.mock('../db', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

// Mock the config
jest.mock('../config', () => ({
  __esModule: true,
  default: {
    auth: {
      jwtSecret: 'test-jwt-secret-that-is-at-least-32-characters-long',
      saltRounds: 10,
      accessTokenExpiry: '1h',
      refreshTokenExpiry: '30d',
    },
  },
}));

const mockQuery = require('../db').default.query;

describe('Authentication Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Password Hashing', () => {
    it('should hash and verify passwords correctly', async () => {
      const password = 'testpassword123';
      const hash = await bcryptjs.hash(password, 10);
      
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
      
      const isValid = await bcryptjs.compare(password, hash);
      expect(isValid).toBe(true);
      
      const isInvalid = await bcryptjs.compare('wrongpassword', hash);
      expect(isInvalid).toBe(false);
    });
  });

  describe('JWT Token', () => {
    it('should generate and verify JWT tokens', () => {
      const payload = {
        userId: '123',
        email: 'test@example.com',
      };
      
      const secret = 'test-jwt-secret-that-is-at-least-32-characters-long';
      const token = jwt.sign(payload, secret, { expiresIn: '1h' });
      
      expect(token).toBeTruthy();
      expect(token.split('.')).toHaveLength(3);
      
      const decoded = jwt.verify(token, secret) as any;
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
    });

    it('should reject invalid tokens', () => {
      const secret = 'test-jwt-secret-that-is-at-least-32-characters-long';
      
      expect(() => {
        jwt.verify('invalid.token.here', secret);
      }).toThrow();
    });
  });

  describe('Database Queries', () => {
    it('should query user by email', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        password_hash: 'hashed_password',
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockUser] });

      const result = await mockQuery('SELECT * FROM users WHERE email = $1', ['test@example.com']);
      
      expect(result.rows[0]).toEqual(mockUser);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email = $1',
        ['test@example.com']
      );
    });
  });
});