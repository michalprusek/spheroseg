/**
 * Token Service Test Suite
 * 
 * This suite tests the critical JWT token management functionality including
 * token creation, validation, refresh, and security features.
 */

import tokenService, { TokenType } from '../tokenService';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Mock dependencies
jest.mock('../../db');
jest.mock('../../config');
jest.mock('../../utils/logger');
jest.mock('../../auth/jwtKeyRotation');
jest.mock('jsonwebtoken');
jest.mock('crypto');

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../../utils/logger', () => ({
  default: mockLogger,
}));

// Mock config
const mockConfig = {
  jwtSecret: 'test-secret',
  jwtExpiresIn: '15m',
  refreshTokenExpiresIn: '7d',
};

jest.mock('../../config', () => ({
  default: mockConfig,
}));

// Mock JWT key rotation
const mockKeyManager = {
  getCurrentKey: jest.fn().mockReturnValue({
    id: 'key-1',
    key: 'test-key',
    algorithm: 'HS256',
  }),
  getAllKeys: jest.fn().mockReturnValue([
    { id: 'key-1', key: 'test-key', algorithm: 'HS256' },
  ]),
};

jest.mock('../../auth/jwtKeyRotation', () => ({
  getKeyManager: jest.fn().mockReturnValue(mockKeyManager),
  signJWTWithRotation: jest.fn(),
}));

// Mock database pool
const mockPool = {
  query: jest.fn(),
};

jest.mock('../../db', () => ({
  default: mockPool,
}));

describe('Token Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateAccessToken', () => {
    it('should generate valid access token with user payload', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        role: 'user',
      };

      const mockToken = 'mock.jwt.token';
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const result = await tokenService.generateAccessToken(mockUser.id, mockUser.email);

      expect(result).toBe(mockToken);
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: '1',
          email: 'test@example.com',
          role: 'user',
          type: TokenType.ACCESS,
        }),
        expect.any(String),
        expect.objectContaining({
          expiresIn: '15m',
        })
      );
    });

    it('should include token metadata in payload', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        role: 'user',
      };

      await tokenService.generateAccessToken(mockUser.id, mockUser.email);

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          type: TokenType.ACCESS,
          iat: expect.any(Number),
          jti: expect.any(String),
        }),
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should handle token generation errors', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        role: 'user',
      };

      (jwt.sign as jest.Mock).mockImplementation(() => {
        throw new Error('Token generation failed');
      });

      await expect(tokenService.generateAccessToken(mockUser.id, mockUser.email)).rejects.toThrow(
        'Token generation failed'
      );
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate valid refresh token', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        role: 'user',
      };

      const mockToken = 'mock.refresh.token';
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);
      (crypto.randomBytes as jest.Mock).mockReturnValue(Buffer.from('randomfamily'));

      mockPool.query.mockResolvedValue({
        rows: [{ token_family: 'family123' }],
      });

      const result = await tokenService.generateRefreshToken(mockUser);

      expect(result).toBe(mockToken);
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: '1',
          type: TokenType.REFRESH,
          tokenFamily: expect.any(String),
        }),
        expect.any(String),
        expect.objectContaining({
          expiresIn: '7d',
        })
      );
    });

    it('should store refresh token in database', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        role: 'user',
      };

      const mockToken = 'mock.refresh.token';
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);
      (crypto.randomBytes as jest.Mock).mockReturnValue(Buffer.from('randomfamily'));

      mockPool.query.mockResolvedValue({
        rows: [{ token_family: 'family123' }],
      });

      await tokenService.generateRefreshToken(mockUser);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO refresh_tokens'),
        expect.arrayContaining([
          expect.any(String), // jti
          '1', // user_id
          expect.any(String), // token_family
          expect.any(Date), // expires_at
        ])
      );
    });

    it('should handle database errors during token storage', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        role: 'user',
      };

      mockPool.query.mockRejectedValue(new Error('Database error'));

      await expect(tokenService.generateRefreshToken(mockUser)).rejects.toThrow(
        'Database error'
      );
    });
  });

  describe('validateToken', () => {
    it('should validate access token successfully', async () => {
      const mockToken = 'valid.jwt.token';
      const mockPayload = {
        userId: '1',
        email: 'test@example.com',
        type: TokenType.ACCESS,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900, // 15 minutes
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);

      const result = await tokenService.validateToken(mockToken, TokenType.ACCESS);

      expect(result).toEqual(mockPayload);
      expect(jwt.verify).toHaveBeenCalledWith(mockToken, expect.any(String));
    });

    it('should reject invalid token type', async () => {
      const mockToken = 'valid.jwt.token';
      const mockPayload = {
        userId: '1',
        email: 'test@example.com',
        type: TokenType.REFRESH, // Wrong type
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900,
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);

      await expect(
        tokenService.validateToken(mockToken, TokenType.ACCESS)
      ).rejects.toThrow('Invalid token type');
    });

    it('should handle expired tokens', async () => {
      const mockToken = 'expired.jwt.token';
      
      (jwt.verify as jest.Mock).mockImplementation(() => {
        const error = new Error('Token expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      await expect(
        tokenService.validateToken(mockToken, TokenType.ACCESS)
      ).rejects.toThrow('Token expired');
    });

    it('should handle malformed tokens', async () => {
      const mockToken = 'malformed.token';
      
      (jwt.verify as jest.Mock).mockImplementation(() => {
        const error = new Error('Malformed token');
        error.name = 'JsonWebTokenError';
        throw error;
      });

      await expect(
        tokenService.validateToken(mockToken, TokenType.ACCESS)
      ).rejects.toThrow('Malformed token');
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh valid refresh token', async () => {
      const mockRefreshToken = 'valid.refresh.token';
      const mockPayload = {
        userId: '1',
        email: 'test@example.com',
        type: TokenType.REFRESH,
        tokenFamily: 'family123',
        jti: 'refresh-jti',
      };

      const mockUser = {
        id: '1',
        email: 'test@example.com',
        role: 'user',
      };

      const mockNewAccessToken = 'new.access.token';
      const mockNewRefreshToken = 'new.refresh.token';

      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      
      // Mock database queries
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ is_valid: true }] }) // Check token validity
        .mockResolvedValueOnce({ rows: [mockUser] }) // Get user data
        .mockResolvedValueOnce({ rows: [] }) // Invalidate old token
        .mockResolvedValueOnce({ rows: [{ token_family: 'family123' }] }); // Store new token

      (jwt.sign as jest.Mock)
        .mockReturnValueOnce(mockNewAccessToken)
        .mockReturnValueOnce(mockNewRefreshToken);

      const result = await tokenService.refreshToken(mockRefreshToken);

      expect(result).toEqual({
        accessToken: mockNewAccessToken,
        refreshToken: mockNewRefreshToken,
        user: mockUser,
      });
    });

    it('should reject refresh token reuse attack', async () => {
      const mockRefreshToken = 'reused.refresh.token';
      const mockPayload = {
        userId: '1',
        type: TokenType.REFRESH,
        tokenFamily: 'family123',
        jti: 'refresh-jti',
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      
      // Mock token already used
      mockPool.query.mockResolvedValueOnce({ rows: [{ is_valid: false }] });

      await expect(tokenService.refreshToken(mockRefreshToken)).rejects.toThrow(
        'Token reuse detected'
      );

      // Verify token family invalidation
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE refresh_tokens SET is_valid = false'),
        expect.arrayContaining(['family123'])
      );
    });

    it('should handle non-existent user during refresh', async () => {
      const mockRefreshToken = 'valid.refresh.token';
      const mockPayload = {
        userId: '999',
        type: TokenType.REFRESH,
        tokenFamily: 'family123',
        jti: 'refresh-jti',
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ is_valid: true }] }) // Token is valid
        .mockResolvedValueOnce({ rows: [] }); // User not found

      await expect(tokenService.refreshToken(mockRefreshToken)).rejects.toThrow(
        'User not found'
      );
    });
  });

  describe('revokeToken', () => {
    it('should revoke specific refresh token', async () => {
      const tokenId = 'token-jti-123';

      mockPool.query.mockResolvedValue({ rowCount: 1 });

      await tokenService.revokeToken(tokenId);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE refresh_tokens SET is_valid = false'),
        expect.arrayContaining([tokenId])
      );
    });

    it('should revoke all tokens for user', async () => {
      const userId = '1';

      mockPool.query.mockResolvedValue({ rowCount: 3 });

      await tokenService.revokeAllUserTokens(userId);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE refresh_tokens SET is_valid = false'),
        expect.arrayContaining([userId])
      );
    });

    it('should handle revocation of non-existent token', async () => {
      const tokenId = 'non-existent-token';

      mockPool.query.mockResolvedValue({ rowCount: 0 });

      await expect(tokenService.revokeToken(tokenId)).rejects.toThrow(
        'Token not found'
      );
    });
  });

  describe('Security Features', () => {
    it('should use secure token generation', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        role: 'user',
      };

      await tokenService.generateAccessToken(mockUser.id, mockUser.email);

      // Verify secure random bytes for JTI
      expect(crypto.randomBytes).toHaveBeenCalledWith(16);
    });

    it('should properly invalidate token families on reuse', async () => {
      const mockRefreshToken = 'reused.token';
      const mockPayload = {
        userId: '1',
        type: TokenType.REFRESH,
        tokenFamily: 'family123',
        jti: 'token-jti',
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      mockPool.query.mockResolvedValueOnce({ rows: [{ is_valid: false }] }); // Token already used

      await expect(tokenService.refreshToken(mockRefreshToken)).rejects.toThrow();

      // Verify all tokens in family are invalidated
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE refresh_tokens SET is_valid = false WHERE token_family'),
        expect.arrayContaining(['family123'])
      );
    });

    it('should enforce token expiration', async () => {
      const expiredToken = 'expired.token';
      
      const expiredError = new Error('Token expired');
      expiredError.name = 'TokenExpiredError';
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw expiredError;
      });

      await expect(
        tokenService.validateToken(expiredToken, TokenType.ACCESS)
      ).rejects.toThrow('Token expired');
    });
  });

  describe('Error Handling', () => {
    it('should log security events', async () => {
      const mockRefreshToken = 'reused.token';
      const mockPayload = {
        userId: '1',
        type: TokenType.REFRESH,
        tokenFamily: 'family123',
        jti: 'token-jti',
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      mockPool.query.mockResolvedValueOnce({ rows: [{ is_valid: false }] });

      await expect(tokenService.refreshToken(mockRefreshToken)).rejects.toThrow();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Token reuse detected'),
        expect.objectContaining({
          userId: '1',
          tokenFamily: 'family123',
        })
      );
    });

    it('should handle database connection failures', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        role: 'user',
      };

      mockPool.query.mockRejectedValue(new Error('Connection failed'));

      await expect(tokenService.generateRefreshToken(mockUser)).rejects.toThrow(
        'Connection failed'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Database error'),
        expect.any(Object)
      );
    });
  });
});