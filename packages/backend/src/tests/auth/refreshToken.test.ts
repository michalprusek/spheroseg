import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import app from '../../server';
import pool from '../../db';
import config from '../../config';

// Mock the database
jest.mock('../../db');

describe('Authentication refresh token mechanism', () => {
  // Mock response data
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockUser = {
    id: mockUserId,
    email: 'test@example.com',
    password: bcrypt.hashSync('password123', 10),
    name: 'Test User',
    role: 'user',
  };

  // Create a valid token with short expiry for testing
  const createToken = (userId, expiresIn) => {
    return jwt.sign({ id: userId, email: mockUser.email }, config.auth.jwtSecret, { expiresIn });
  };

  // Store refresh token in a variable to use across tests
  let refreshToken;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock DB query for retrieving user
    (pool.query as jest.Mock).mockImplementation((query, params) => {
      if (query.includes('SELECT * FROM users WHERE')) {
        return Promise.resolve({
          rows: [mockUser],
        });
      }

      if (query.includes('SELECT * FROM refresh_tokens')) {
        return Promise.resolve({
          rows: refreshToken ? [{ token: refreshToken, user_id: mockUserId }] : [],
        });
      }

      if (query.includes('INSERT INTO refresh_tokens')) {
        // Mock creating refresh token
        refreshToken = params[0]; // Store the token for future checks
        return Promise.resolve({
          rows: [{ token: refreshToken, user_id: mockUserId }],
        });
      }

      if (query.includes('DELETE FROM refresh_tokens')) {
        // Mock deleting refresh token
        refreshToken = null;
        return Promise.resolve({});
      }

      return Promise.resolve({ rows: [] });
    });
  });

  // Test login flow that generates refresh token
  it('should generate a refresh token on login', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: mockUser.email,
      password: 'password123',
      remember_me: true, // Important to request a refresh token
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('refreshToken');

    // Store refresh token for subsequent tests
    refreshToken = response.body.refreshToken;

    // Verify refresh token is saved to DB
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO refresh_tokens'),
      expect.arrayContaining([refreshToken, mockUserId])
    );
  });

  // Test refreshing an access token
  it('should issue a new access token when using a valid refresh token', async () => {
    // First ensure we have a refresh token
    expect(refreshToken).toBeDefined();

    const response = await request(app).post('/api/auth/refresh').send({
      refreshToken,
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
    expect(response.body.token).toBeDefined();

    // Verify the new token is valid
    const decoded = jwt.verify(response.body.token, config.auth.jwtSecret) as {
      id: string;
    };
    expect(decoded.id).toBe(mockUserId);
  });

  // Test using an expired access token with a valid refresh token
  it('should allow access with a new token when the original access token expires', async () => {
    // Create a token that expires in 1 second
    const shortLivedToken = createToken(mockUserId, '1s');

    // Wait for token to expire
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Verify the short-lived token is expired
    try {
      jwt.verify(shortLivedToken, config.auth.jwtSecret);
      fail('Token should be expired');
    } catch (error) {
      expect(error.name).toBe('TokenExpiredError');
    }

    // Now use the refresh token to get a new access token
    const refreshResponse = await request(app).post('/api/auth/refresh').send({
      refreshToken,
    });

    expect(refreshResponse.status).toBe(200);
    const newToken = refreshResponse.body.token;

    // Try accessing a protected resource with the new token
    const protectedResponse = await request(app)
      .get('/api/user/profile')
      .set('Authorization', `Bearer ${newToken}`);

    expect(protectedResponse.status).toBe(200);
  });

  // Test invalid refresh token
  it('should reject an invalid refresh token', async () => {
    const response = await request(app).post('/api/auth/refresh').send({
      refreshToken: 'invalid-token',
    });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toMatch(/invalid.*token/i);
  });

  // Test logout with refresh token invalidation
  it('should invalidate the refresh token on logout', async () => {
    // First ensure we have a refresh token
    expect(refreshToken).toBeDefined();

    // Get a valid access token
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: mockUser.email,
      password: 'password123',
      remember_me: true,
    });

    const accessToken = loginResponse.body.token;

    // Logout
    const logoutResponse = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        refreshToken,
      });

    expect(logoutResponse.status).toBe(200);

    // Verify refresh token was deleted from DB
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM refresh_tokens'),
      expect.arrayContaining([refreshToken])
    );

    // Try using the refresh token after logout
    const refreshResponse = await request(app).post('/api/auth/refresh').send({
      refreshToken,
    });

    expect(refreshResponse.status).toBe(401);
  });

  // Test token timeout/session expiration
  it('should reject refresh tokens that have expired due to inactivity', async () => {
    // First ensure we have a refresh token
    expect(refreshToken).toBeDefined();

    // Mock the refresh token as expired in the database
    (pool.query as jest.Mock).mockImplementation((query) => {
      if (query.includes('SELECT * FROM refresh_tokens')) {
        // Return a token but with an expired timestamp
        const currentTime = new Date();
        const expiredTime = new Date(currentTime.getTime() - 31 * 24 * 60 * 60 * 1000); // 31 days ago

        return Promise.resolve({
          rows: [
            {
              token: refreshToken,
              user_id: mockUserId,
              created_at: expiredTime,
              updated_at: expiredTime,
            },
          ],
        });
      }

      return Promise.resolve({ rows: [] });
    });

    // Try using the expired refresh token
    const response = await request(app).post('/api/auth/refresh').send({
      refreshToken,
    });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toMatch(/expired/i);
  });
});
