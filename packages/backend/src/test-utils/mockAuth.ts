/**
 * Mock Authentication Utilities for Testing
 *
 * This module provides utilities for mocking authentication in tests.
 * It includes:
 * - Mock JWT generation and verification
 * - Mock bcrypt password hashing and verification
 * - Mock authentication middleware
 * - Mock authenticated request objects
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Types for auth mocks
export interface User {
  id: string;
  email: string;
  name?: string;
  username?: string;
  password?: string;
  role?: string;
  [key: string]: any;
}

export interface TokenPayload {
  id: string;
  email: string;
  role?: string;
  deviceId?: string;
  iat?: number;
  exp?: number;
  [key: string]: any;
}

export interface TokenData {
  token: string;
  refreshToken?: string;
  payload: TokenPayload;
  deviceId?: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface MockAuthOptions {
  jwtSecret?: string;
  tokenExpiration?: string | number;
  refreshTokenExpiration?: string | number;
  validatePasswords?: boolean;
}

/**
 * MockAuth class provides authentication mocking functions
 */
export class MockAuth {
  private users: Map<string, User> = new Map();
  private tokens: Map<string, TokenData> = new Map();
  private refreshTokens: Map<string, TokenData> = new Map();
  private options: Required<MockAuthOptions>;

  /**
   * Create a new MockAuth instance
   */
  constructor(options: MockAuthOptions = {}) {
    // Default options
    this.options = {
      jwtSecret: options.jwtSecret || 'test-jwt-secret',
      tokenExpiration: options.tokenExpiration || '1h',
      refreshTokenExpiration: options.refreshTokenExpiration || '7d',
      validatePasswords: options.validatePasswords !== undefined ? options.validatePasswords : true,
    };
  }

  /**
   * Reset the mock auth data
   */
  public reset(): void {
    this.users.clear();
    this.tokens.clear();
    this.refreshTokens.clear();
  }

  /**
   * Create a mock user
   */
  public createUser(userData: Partial<User> = {}): User {
    const id = userData.id || uuidv4();
    const email = userData.email || `user-${id.substring(0, 8)}@example.com`;

    const user: User = {
      id,
      email,
      name: userData.name || `Test User ${id.substring(0, 8)}`,
      username: userData.username || `user_${id.substring(0, 8)}`,
      password: userData.password || `hashed:password123`,
      role: userData.role || 'user',
      ...userData,
    };

    this.users.set(id, user);
    return { ...user };
  }

  /**
   * Get a user by ID
   */
  public getUserById(id: string): User | undefined {
    const user = this.users.get(id);
    if (user) {
      // Return a copy to prevent mutations
      return { ...user };
    }
    return undefined;
  }

  /**
   * Get a user by email
   */
  public getUserByEmail(email: string): User | undefined {
    for (const user of this.users.values()) {
      if (user.email === email) {
        // Return a copy to prevent mutations
        return { ...user };
      }
    }
    return undefined;
  }

  /**
   * Mock JWT token generation
   */
  public generateToken(userId: string, additionalData: Record<string, any> = {}): TokenData | null {
    const user = this.users.get(userId);
    if (!user) return null;

    // Create token payload
    const now = new Date();
    const deviceId = additionalData.deviceId || uuidv4();
    let expiresAt: Date;

    if (typeof this.options.tokenExpiration === 'number') {
      // If expiration is a number, treat it as milliseconds
      expiresAt = new Date(now.getTime() + this.options.tokenExpiration);
    } else {
      // Parse string expiration (e.g., "1h", "7d")
      const match = this.options.tokenExpiration.match(/^(\d+)([smhdwy])$/);
      if (!match) {
        expiresAt = new Date(now.getTime() + 3600000); // Default 1 hour
      } else {
        const [, valueStr, unit] = match;
        const value = parseInt(valueStr, 10);

        switch (unit) {
          case 's':
            expiresAt = new Date(now.getTime() + value * 1000);
            break;
          case 'm':
            expiresAt = new Date(now.getTime() + value * 60000);
            break;
          case 'h':
            expiresAt = new Date(now.getTime() + value * 3600000);
            break;
          case 'd':
            expiresAt = new Date(now.getTime() + value * 86400000);
            break;
          case 'w':
            expiresAt = new Date(now.getTime() + value * 604800000);
            break;
          case 'y':
            expiresAt = new Date(now.getTime() + value * 31536000000);
            break;
          default:
            expiresAt = new Date(now.getTime() + 3600000); // Default 1 hour
        }
      }
    }

    // Build payload
    const payload: TokenPayload = {
      id: user.id,
      email: user.email,
      ...additionalData,
      iat: Math.floor(now.getTime() / 1000),
      exp: Math.floor(expiresAt.getTime() / 1000),
    };

    // For role-based setups
    if (user.role) {
      payload.role = user.role;
    }

    // Create token (mock format: "jwt:payload:deviceId:secret")
    const token = `jwt:${JSON.stringify(payload)}:${deviceId}:${this.options.jwtSecret}`;

    // Create token data
    const tokenData: TokenData = {
      token,
      payload,
      deviceId,
      createdAt: now,
      expiresAt,
    };

    // Store token
    this.tokens.set(token, tokenData);

    // Generate refresh token if requested
    if (additionalData.withRefreshToken) {
      const refreshToken = this.generateRefreshToken(userId, deviceId);
      if (refreshToken) {
        tokenData.refreshToken = refreshToken.token;
      }
    }

    return tokenData;
  }

  /**
   * Generate a refresh token
   */
  private generateRefreshToken(userId: string, deviceId: string): TokenData | null {
    const user = this.users.get(userId);
    if (!user) return null;

    // Create token payload
    const now = new Date();
    let expiresAt: Date;

    if (typeof this.options.refreshTokenExpiration === 'number') {
      // If expiration is a number, treat it as milliseconds
      expiresAt = new Date(now.getTime() + this.options.refreshTokenExpiration);
    } else {
      // Parse string expiration (e.g., "1h", "7d")
      const match = this.options.refreshTokenExpiration.match(/^(\d+)([smhdwy])$/);
      if (!match) {
        expiresAt = new Date(now.getTime() + 604800000); // Default 7 days
      } else {
        const [, valueStr, unit] = match;
        const value = parseInt(valueStr, 10);

        switch (unit) {
          case 's':
            expiresAt = new Date(now.getTime() + value * 1000);
            break;
          case 'm':
            expiresAt = new Date(now.getTime() + value * 60000);
            break;
          case 'h':
            expiresAt = new Date(now.getTime() + value * 3600000);
            break;
          case 'd':
            expiresAt = new Date(now.getTime() + value * 86400000);
            break;
          case 'w':
            expiresAt = new Date(now.getTime() + value * 604800000);
            break;
          case 'y':
            expiresAt = new Date(now.getTime() + value * 31536000000);
            break;
          default:
            expiresAt = new Date(now.getTime() + 604800000); // Default 7 days
        }
      }
    }

    // Build payload
    const payload: TokenPayload = {
      id: user.id,
      email: user.email,
      deviceId,
      iat: Math.floor(now.getTime() / 1000),
      exp: Math.floor(expiresAt.getTime() / 1000),
    };

    // Create token (mock format: "refresh:payload:deviceId:secret")
    const token = `refresh:${JSON.stringify(payload)}:${deviceId}:${this.options.jwtSecret}`;

    // Create token data
    const tokenData: TokenData = {
      token,
      payload,
      deviceId,
      createdAt: now,
      expiresAt,
    };

    // Store refresh token
    this.refreshTokens.set(token, tokenData);

    return tokenData;
  }

  /**
   * Verify a token and return the decoded payload
   */
  public verifyToken(token: string): TokenPayload | null {
    // Check if token is in our storage
    const tokenData = this.tokens.get(token);
    if (tokenData) {
      // Check if token is expired
      if (new Date() > tokenData.expiresAt) {
        return null;
      }
      return { ...tokenData.payload };
    }

    // Try to parse the token manually
    // Format: "jwt:payload:deviceId:secret"
    const parts = token.split(':');
    if (parts.length !== 4 || parts[0] !== 'jwt' || parts[3] !== this.options.jwtSecret) {
      return null;
    }

    try {
      const payload = JSON.parse(parts[1]) as TokenPayload;

      // Check if token is expired
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }

      return payload;
    } catch (error) {
      return null;
    }
  }

  /**
   * Verify a refresh token and return the decoded payload
   */
  public verifyRefreshToken(token: string): TokenPayload | null {
    // Check if token is in our storage
    const tokenData = this.refreshTokens.get(token);
    if (tokenData) {
      // Check if token is expired
      if (new Date() > tokenData.expiresAt) {
        return null;
      }
      return { ...tokenData.payload };
    }

    // Try to parse the token manually
    // Format: "refresh:payload:deviceId:secret"
    const parts = token.split(':');
    if (parts.length !== 4 || parts[0] !== 'refresh' || parts[3] !== this.options.jwtSecret) {
      return null;
    }

    try {
      const payload = JSON.parse(parts[1]) as TokenPayload;

      // Check if token is expired
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }

      return payload;
    } catch (error) {
      return null;
    }
  }

  /**
   * Create a mock authentication middleware
   */
  public createAuthMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, res: Response, next: NextFunction) => {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const token = authHeader.split(' ')[1];
      const payload = this.verifyToken(token);

      if (!payload) {
        return res.status(401).json({ message: 'Invalid token' });
      }

      // Add user data to request
      (req as any).user = {
        userId: payload.id,
        email: payload.email,
        role: payload.role,
      };

      // For device-specific functionality
      if (payload.deviceId) {
        (req as any).deviceId = payload.deviceId;
      }

      next();
    };
  }

  /**
   * Create a mock request with authentication
   */
  public createAuthenticatedRequest(
    userId: string,
    additionalData: Record<string, any> = {}
  ): Request {
    const tokenData = this.generateToken(userId, additionalData);
    if (!tokenData) {
      throw new Error(`User with ID ${userId} not found`);
    }

    // Create a mock request object
    const req: Partial<Request> = {
      headers: {
        authorization: `Bearer ${tokenData.token}`,
      },
      user: {
        userId: tokenData.payload.id,
        email: tokenData.payload.email,
        role: tokenData.payload.role,
      } as any,
    };

    // Add device ID if present
    if (tokenData.deviceId) {
      (req as any).deviceId = tokenData.deviceId;
    }

    return req as Request;
  }

  /**
   * Mock password hashing
   */
  public hashPassword(password: string): string {
    // Simple mock: just prefix with "hashed:"
    return `hashed:${password}`;
  }

  /**
   * Mock password comparison
   */
  public comparePassword(plainPassword: string, hashedPassword: string): boolean {
    if (!this.options.validatePasswords) {
      return true;
    }

    // Simple mock: just check if hashedPassword is "hashed:plainPassword"
    return hashedPassword === `hashed:${plainPassword}`;
  }

  /**
   * Revoke a token
   */
  public revokeToken(token: string): boolean {
    return this.tokens.delete(token);
  }

  /**
   * Revoke a refresh token
   */
  public revokeRefreshToken(token: string): boolean {
    return this.refreshTokens.delete(token);
  }

  /**
   * Mock login functionality
   */
  public login(email: string, password: string, deviceId?: string): TokenData | null {
    // Find user by email
    const user = this.getUserByEmail(email);
    if (!user) return null;

    // Check password
    if (this.options.validatePasswords && !this.comparePassword(password, user.password || '')) {
      return null;
    }

    // Generate and return tokens
    return this.generateToken(user.id, { deviceId, withRefreshToken: true });
  }

  /**
   * Mock refresh token functionality
   */
  public refreshToken(refreshToken: string): TokenData | null {
    // Verify refresh token
    const payload = this.verifyRefreshToken(refreshToken);
    if (!payload) return null;

    // Check if user still exists
    const user = this.getUserById(payload.id);
    if (!user) return null;

    // Generate and return new tokens
    return this.generateToken(user.id, {
      deviceId: payload.deviceId,
      withRefreshToken: true,
    });
  }
}

/**
 * Create a mock JWT sign function
 */
export function createMockJwtSign(options: MockAuthOptions = {}): jest.Mock {
  const mockAuth = new MockAuth(options);

  return jest.fn((payload: any, secret: string, options: any = {}) => {
    // Get user ID from payload
    const userId = payload.id || payload.sub;
    if (!userId) {
      throw new Error('JWT payload must contain id or sub');
    }

    // Create a user if it doesn't exist (for testing purposes)
    if (!mockAuth.getUserById(userId)) {
      mockAuth.createUser({
        id: userId,
        email: payload.email || `user-${userId}@example.com`,
      });
    }

    // Generate token
    const tokenData = mockAuth.generateToken(userId, {
      ...payload,
      expiresIn: options.expiresIn,
    });

    if (!tokenData) {
      throw new Error(`Failed to generate token for user ${userId}`);
    }

    return tokenData.token;
  });
}

/**
 * Create a mock JWT verify function
 */
export function createMockJwtVerify(options: MockAuthOptions = {}): jest.Mock {
  const mockAuth = new MockAuth(options);

  return jest.fn((token: string, secret: string, options: any = {}, callback?: Function) => {
    try {
      const payload = mockAuth.verifyToken(token);

      if (!payload) {
        const error = new Error('Invalid token');
        if (callback) {
          callback(error, null);
          return;
        }
        throw error;
      }

      if (callback) {
        callback(null, payload);
        return;
      }

      return payload;
    } catch (error) {
      if (callback) {
        callback(error, null);
        return;
      }
      throw error;
    }
  });
}

/**
 * Create a mock bcrypt hash function
 */
export function createMockBcryptHash(options: MockAuthOptions = {}): jest.Mock {
  const mockAuth = new MockAuth(options);

  return jest.fn((data: string, saltOrRounds: string | number): Promise<string> => {
    return Promise.resolve(mockAuth.hashPassword(data));
  });
}

/**
 * Create a mock bcrypt compare function
 */
export function createMockBcryptCompare(options: MockAuthOptions = {}): jest.Mock {
  const mockAuth = new MockAuth(options);

  return jest.fn((data: string, encrypted: string): Promise<boolean> => {
    return Promise.resolve(mockAuth.comparePassword(data, encrypted));
  });
}

/**
 * Mock JWT module
 */
export function mockJwtModule(options: MockAuthOptions = {}): void {
  jest.mock('jsonwebtoken', () => {
    return {
      sign: createMockJwtSign(options),
      verify: createMockJwtVerify(options),
      decode: jest.fn((token) => {
        try {
          const parts = token.split(':');
          if (parts.length >= 2) {
            return JSON.parse(parts[1]);
          }
          return null;
        } catch (error) {
          return null;
        }
      }),
    };
  });
}

/**
 * Mock bcrypt module
 */
export function mockBcryptModule(options: MockAuthOptions = {}): void {
  jest.mock('bcrypt', () => {
    return {
      hash: createMockBcryptHash(options),
      compare: createMockBcryptCompare(options),
      genSalt: jest.fn((rounds?: number) => Promise.resolve('$2b$10$mockSalt')),
    };
  });
}

/**
 * Create a mock auth instance with test data
 */
export function createMockAuthWithTestData(options: MockAuthOptions = {}): MockAuth {
  const mockAuth = new MockAuth(options);

  // Create test users
  const admin = mockAuth.createUser({
    id: 'admin-id',
    email: 'admin@example.com',
    name: 'Admin User',
    username: 'admin',
    password: mockAuth.hashPassword('admin123'),
    role: 'admin',
  });

  const regularUser = mockAuth.createUser({
    id: 'user-id',
    email: 'user@example.com',
    name: 'Regular User',
    username: 'user',
    password: mockAuth.hashPassword('user123'),
    role: 'user',
  });

  // Generate tokens
  mockAuth.generateToken(admin.id, { withRefreshToken: true });
  mockAuth.generateToken(regularUser.id, { withRefreshToken: true });

  return mockAuth;
}
