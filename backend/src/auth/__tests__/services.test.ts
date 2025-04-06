jest.mock('../../db/connection', () => {
  const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
  return {
    __esModule: true,
    default: { query: mockQuery },
    query: mockQuery,
  };
});

import { AuthService } from '../services/auth.service';
import * as db from '../../db/connection';

beforeEach(() => {
  (db.query as jest.Mock).mockReset();
  (db.query as jest.Mock).mockImplementation(() => Promise.resolve({ rows: [] }));
});

describe('AuthService', () => {
  describe('registerUser', () => {
    it('should create a new user and return user data', async () => {
      (db.query as jest.Mock).mockImplementation(async (sql, params) => {
        if (sql.includes('SELECT id FROM users')) {
          return { rows: [] }; // no existing user
        }
        if (sql.includes('INSERT INTO users')) {
          return {
            rows: [{
              id: 'user123',
              email: 'test@example.com',
              name: 'Test User',
              bio: null,
              avatar_url: null,
              website: null
            }]
          };
        }
        // Fallback: always return an object with rows array
        return { rows: [] };
      });

      const result = await AuthService.registerUser({ email: 'test@example.com', password: 'password123', name: 'Test User' });

      expect(result).toEqual({
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        bio: null,
        avatar_url: null,
        website: null
      });
    });

    it('should throw error if email already exists', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 'existing' }] });

      await expect(AuthService.registerUser({ email: 'test@example.com', password: 'password123' }))
        .rejects.toThrow('User already exists');
    });
  });

  describe('loginUser', () => {
    it('should return JWT token and user for valid credentials', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: 'user123',
          email: 'test@example.com',
          password_hash: await require('bcrypt').hash('password123', 10),
          name: 'Test User',
          bio: null,
          avatar_url: null,
          website: null
        }]
      });

      const result = await AuthService.loginUser('test@example.com', 'password123');

      expect(result).toHaveProperty('token');
      expect(result.user).toMatchObject({
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        bio: null,
        avatar_url: null,
        website: null
      });
    });

    it('should throw error for invalid credentials', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: 'user123',
          email: 'test@example.com',
          password_hash: await require('bcrypt').hash('password123', 10)
        }]
      });

      await expect(AuthService.loginUser('test@example.com', 'wrongpassword'))
        .rejects.toThrow('Invalid credentials');
    });

    it('should throw error if user not found', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(AuthService.loginUser('nouser@example.com', 'password123'))
        .rejects.toThrow('User not found');
    });
  });

  describe('verifyToken', () => {
    it('should return decoded payload for valid token', () => {
      const token = 'valid.token';
      jest.spyOn(require('jsonwebtoken'), 'verify').mockReturnValue({ userId: 'user123' });

      const payload = AuthService.verifyToken(token);
      expect(payload).toEqual({ userId: 'user123' });
    });

    it('should throw error for invalid token', () => {
      jest.spyOn(require('jsonwebtoken'), 'verify').mockImplementation(() => { throw new Error('invalid token'); });

      expect(() => AuthService.verifyToken('bad.token')).toThrow('invalid token');
    });
  });

  describe('requestPasswordReset', () => {
    it('should throw error if user not found', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(AuthService.requestPasswordReset('nouser@example.com')).rejects.toThrow('User not found');
    });

    it('should insert reset token if user exists', async () => {
      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'user123' }] }) // user lookup
        .mockResolvedValueOnce({}); // insert token

      await expect(AuthService.requestPasswordReset('test@example.com')).resolves.toBeUndefined();
    });
  });

  describe('resetPassword', () => {
    it('should throw error if token not found', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(AuthService.resetPassword('badtoken', 'newpass')).rejects.toThrow('Invalid token');
    });

    it('should throw error if token expired or used', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ user_id: 'user123', expires_at: new Date(Date.now() - 1000), used: false }]
      });

      await expect(AuthService.resetPassword('expiredtoken', 'newpass')).rejects.toThrow('Token expired or used');

      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ user_id: 'user123', expires_at: new Date(Date.now() + 10000), used: true }]
      });

      await expect(AuthService.resetPassword('usedtoken', 'newpass')).rejects.toThrow('Token expired or used');
    });

    it('should update password and mark token as used if valid', async () => {
      (db.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{ user_id: 'user123', expires_at: new Date(Date.now() + 10000), used: false }]
        })
        .mockResolvedValueOnce({}) // update password
        .mockResolvedValueOnce({}); // mark token used

      jest.spyOn(require('bcrypt'), 'hash').mockResolvedValue('hashedpass');

      await expect(AuthService.resetPassword('validtoken', 'newpass')).resolves.toBeUndefined();
    });
  });
});