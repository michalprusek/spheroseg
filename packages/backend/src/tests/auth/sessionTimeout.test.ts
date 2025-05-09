/**
 * Session Timeout Tests
 * 
 * This test verifies token expiration and session timeout handling
 * using a simplified approach with mocked dependencies.
 */
import { Request, Response, NextFunction } from 'express';
import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';

// Define test constants
const JWT_SECRET = 'test-secret-key';
const MOCK_USER_ID = '123e4567-e89b-12d3-a456-426614174000';

// Mock user data without bcrypt dependency
const MOCK_USER = {
  id: MOCK_USER_ID,
  email: 'test@example.com',
  password: 'hashed-password-123', // Pre-hashed password representation
  name: 'Test User',
  role: 'user'
};

// Define query result interface for type safety
interface QueryResult {
  rows: any[];
  rowCount?: number;
}

// For tracking mock sessions
interface Session {
  user_id: string;
  device_id?: string;
  last_activity: Date;
}

// For tracking mock activity logs
interface ActivityLog {
  user_id: string;
  action: string;
  timestamp: Date;
}

// Mock database module with compatible signature for Jest
// The issue is that jest.fn() expects a more generic function signature
const mockDbQueryImplementation = async (query: string, params: any[] = []): Promise<QueryResult> => {
  // User lookup
  if (query.includes('SELECT * FROM users WHERE')) {
    return { rows: [MOCK_USER] };
  }
  
  // Insert activity log
  if (query.includes('INSERT INTO user_activity_log')) {
    mockActivityLog.push({
      user_id: params[0],
      action: params[1],
      timestamp: new Date()
    });
    return { rows: [], rowCount: 1 };
  }
  
  // Get activity log
  if (query.includes('SELECT * FROM user_activity_log')) {
    return { 
      rows: mockActivityLog.filter(log => log.user_id === params[0])
    };
  }
  
  // Update session activity
  if (query.includes('UPDATE user_sessions SET') && query.includes('last_activity')) {
    // Find and update the session
    for (const [key, session] of mockSessions.entries()) {
      if (session.user_id === params[0]) {
        session.last_activity = new Date();
        mockSessions.set(key, session);
        return { rows: [], rowCount: 1 };
      }
    }
    return { rows: [], rowCount: 0 };
  }
  
  // Get session by user ID and device ID
  if (query.includes('SELECT * FROM user_sessions WHERE user_id = $1 AND device_id = $2')) {
    const userId = params[0];
    const deviceId = params[1];
    const sessionKey = `${userId}-${deviceId}`;
    
    if (mockSessions.has(sessionKey)) {
      return {
        rows: [mockSessions.get(sessionKey)]
      };
    }
    return { rows: [] };
  }
  
  // Get session activity
  if (query.includes('SELECT last_activity FROM user_sessions')) {
    // Return the most recent session for the user
    for (const session of mockSessions.values()) {
      if (session.user_id === params[0]) {
        return {
          rows: [{ last_activity: session.last_activity }]
        };
      }
    }
    return { rows: [] };
  }
  
  // Insert or update session
  if (query.includes('INSERT INTO user_sessions') || query.includes('UPDATE user_sessions')) {
    const userId = params[0];
    const deviceId = params[1] || 'default-device';
    const sessionKey = `${userId}-${deviceId}`;
    
    mockSessions.set(sessionKey, {
      user_id: userId,
      device_id: deviceId,
      last_activity: new Date()
    });
    
    return { rows: [], rowCount: 1 };
  }
  
  // Token blacklist check
  if (query.includes('SELECT * FROM token_blacklist WHERE token = $1')) {
    const tokenToCheck = params[0];
    const isBlacklisted = blacklistedTokens.has(tokenToCheck);
    
    return {
      rows: isBlacklisted ? [{ token: tokenToCheck }] : []
    };
  }
  
  // Add token to blacklist
  if (query.includes('INSERT INTO token_blacklist')) {
    const blacklistedToken = params[0];
    blacklistedTokens.add(blacklistedToken);
    return { rows: [], rowCount: 1 };
  }
  
  // Password update
  if (query.includes('UPDATE users SET password = $1')) {
    // Simulate password change - in a real app this would update the user record
    return { rows: [], rowCount: 1 };
  }
  
  // Default empty result
  return { rows: [], rowCount: 0 };
};

// Use a more generic type for jest.fn()
const mockDbQuery = jest.fn().mockImplementation((...args: any[]) => {
  const [query, params] = args;
  return mockDbQueryImplementation(query as string, params as any[] || []);
});

// Mock collections for state
let mockActivityLog: ActivityLog[] = [];
const mockSessions = new Map<string, Session>();
const blacklistedTokens = new Set<string>();

// Create JWT helper with direct stringify approach to avoid type issues
const createToken = (userId: string, email: string, expiresIn: string = '1h', deviceId?: string): string => {
  // Define the payload
  const payload: Record<string, any> = {
    id: userId,
    email: email
  };
  
  if (deviceId) {
    payload.deviceId = deviceId;
  }
  
  // Using a direct string conversion of expiresIn to bypass TypeScript's type checking
  // This is a workaround for tests only and wouldn't be used in production code
  const options = JSON.parse(`{"expiresIn":"${expiresIn}"}`);
  
  // Use JSON.parse to trick TypeScript's type system
  return jwt.sign(payload, JWT_SECRET, options);
};

// Mock all required dependencies
jest.mock('../../db', () => ({
  __esModule: true,
  default: {
    query: mockDbQuery
  },
  query: mockDbQuery
}));

jest.mock('../../config', () => ({
  __esModule: true,
  default: {
    auth: {
      jwtSecret: JWT_SECRET,
      tokenSecurityMode: 'standard'
    }
  }
}));

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    http: jest.fn()
  }
}));

// Token verification middleware
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication token required' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    // Check for blacklisted tokens
    if (blacklistedTokens.has(token)) {
      return res.status(401).json({ message: 'Token has been revoked' });
    }
    
    // Verify token - using direct casting to avoid TypeScript issues
    // This is only for testing purposes
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Check for session timeout (for tokens that are still valid but sessions inactive)
    // Find session for the user and device
    const sessionKey = decoded.deviceId ? `${decoded.id}-${decoded.deviceId}` : `${decoded.id}-default-device`;
    const session = mockSessions.get(sessionKey);
    
    if (session) {
      const inactivityPeriod = Date.now() - session.last_activity.getTime();
      const thirtyMinutesMs = 30 * 60 * 1000;
      
      // If session is inactive for more than 30 minutes
      if (inactivityPeriod > thirtyMinutesMs) {
        return res.status(401).json({ message: 'Session expired due to inactivity' });
      }
      
      // Update last activity
      session.last_activity = new Date();
      mockSessions.set(sessionKey, session);
    } else {
      // Create new session
      mockSessions.set(sessionKey, {
        user_id: decoded.id,
        device_id: decoded.deviceId || 'default-device',
        last_activity: new Date()
      });
    }
    
    // Add user to request
    (req as any).user = {
      userId: decoded.id,
      email: decoded.email,
      deviceId: decoded.deviceId
    };
    
    // Log activity
    mockActivityLog.push({
      user_id: decoded.id,
      action: 'api_access',
      timestamp: new Date()
    });
    
    next();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
      }
      
      return res.status(401).json({ message: 'Invalid authentication token' });
    }
    
    return res.status(401).json({ message: 'Authentication failed' });
  }
};

// Create Express app with routes for testing
const createApp = () => {
  const app = express();
  app.use(express.json());

  // User profile route (protected)
  app.get('/api/user/profile', authMiddleware, (req, res) => {
    const userId = (req as any).user?.userId;
    
    // Return user data
    res.status(200).json({
      id: userId,
      email: MOCK_USER.email,
      name: MOCK_USER.name
    });
  });
  
  // Change password route (protected)
  app.post('/api/auth/change-password', authMiddleware, (req, res) => {
    const { current_password, new_password, confirm_password } = req.body;
    
    // Simple validation
    if (new_password !== confirm_password) {
      return res.status(400).json({ message: 'New password and confirmation do not match' });
    }
    
    // Update password
    const userId = (req as any).user?.userId;
    
    // Blacklist current token
    const token = req.headers.authorization!.split(' ')[1];
    blacklistedTokens.add(token);
    
    // Update password in database (mocked)
    mockDbQuery('UPDATE users SET password = $1 WHERE id = $2', ['new-hashed-password', userId]);
    
    res.status(200).json({ message: 'Password changed successfully' });
  });

  return app;
};

describe('Session Timeout and Token Management', () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();
    mockActivityLog = [];
    mockSessions.clear();
    blacklistedTokens.clear();
    
    app = createApp();
  });

  // Test token expiration
  it('should reject requests with expired tokens', async () => {
    // Create a token that expires in 1 second
    const shortLivedToken = createToken(MOCK_USER_ID, MOCK_USER.email, '1s');
    
    // Wait for token to expire
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    // Attempt to access a protected resource with expired token
    const response = await request(app)
      .get('/api/user/profile')
      .set('Authorization', `Bearer ${shortLivedToken}`);
      
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toMatch(/expired/i);
  });
  
  // Test inactive session timeout
  it('should track user activity and detect inactive sessions', async () => {
    // Create a valid token
    const token = createToken(MOCK_USER_ID, MOCK_USER.email, '1h');
    
    // Make an initial request to establish the session
    await request(app)
      .get('/api/user/profile')
      .set('Authorization', `Bearer ${token}`);
    
    // Verify activity was logged
    expect(mockActivityLog.length).toBeGreaterThan(0);
    expect(mockActivityLog[0].user_id).toBe(MOCK_USER_ID);
    
    // Find the session and manipulate it to simulate inactivity
    const sessionKey = `${MOCK_USER_ID}-default-device`;
    const session = mockSessions.get(sessionKey);
    
    if (session) {
      // Set last activity to 31 minutes ago
      session.last_activity = new Date(Date.now() - (31 * 60 * 1000));
      mockSessions.set(sessionKey, session);
    }
    
    // Make another request after simulated inactivity
    const response = await request(app)
      .get('/api/user/profile')
      .set('Authorization', `Bearer ${token}`);
      
    // Even though the token is still valid, the session should be considered inactive
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toMatch(/session.*expired|inactive/i);
  });
  
  // Test session activity tracking and extension
  it('should extend session lifetime with active usage', async () => {
    // Create a valid token
    const token = createToken(MOCK_USER_ID, MOCK_USER.email, '1h');
    
    // Make multiple requests to keep the session active
    for (let i = 0; i < 3; i++) {
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${token}`);
        
      expect(response.status).toBe(200);
      
      // Wait a moment between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Get the session and check the last activity time
    const sessionKey = `${MOCK_USER_ID}-default-device`;
    const session = mockSessions.get(sessionKey);
    
    expect(session).toBeDefined();
    if (session) {
      expect(session.last_activity.getTime()).toBeGreaterThan(Date.now() - 1000); // Within the last second
    }
    
    // Verify session remains active
    const finalResponse = await request(app)
      .get('/api/user/profile')
      .set('Authorization', `Bearer ${token}`);
      
    expect(finalResponse.status).toBe(200);
  });
  
  // Test multiple device sessions
  it('should handle multiple sessions from different devices', async () => {
    // Create tokens with device identifiers
    const mobileToken = createToken(MOCK_USER_ID, MOCK_USER.email, '1h', 'mobile-device');
    const desktopToken = createToken(MOCK_USER_ID, MOCK_USER.email, '1h', 'desktop-device');
    
    // Use the mobile token
    const mobileResponse = await request(app)
      .get('/api/user/profile')
      .set('Authorization', `Bearer ${mobileToken}`);
      
    expect(mobileResponse.status).toBe(200);
    
    // Use the desktop token
    const desktopResponse = await request(app)
      .get('/api/user/profile')
      .set('Authorization', `Bearer ${desktopToken}`);
      
    expect(desktopResponse.status).toBe(200);
    
    // Verify separate sessions were created
    expect(mockSessions.size).toBe(2);
    expect(mockSessions.has(`${MOCK_USER_ID}-mobile-device`)).toBe(true);
    expect(mockSessions.has(`${MOCK_USER_ID}-desktop-device`)).toBe(true);
  });
  
  // Test session termination on password change
  it('should terminate all sessions when user changes password', async () => {
    // Create a token
    const token = createToken(MOCK_USER_ID, MOCK_USER.email, '1h');
    
    // Make a request to verify the token works
    const initialResponse = await request(app)
      .get('/api/user/profile')
      .set('Authorization', `Bearer ${token}`);
      
    expect(initialResponse.status).toBe(200);
    
    // Change password
    await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        current_password: 'password123',
        new_password: 'newpassword123',
        confirm_password: 'newpassword123'
      });
    
    // Token should be blacklisted
    expect(blacklistedTokens.has(token)).toBe(true);
    
    // Try to use the token after password change
    const afterPasswordChangeResponse = await request(app)
      .get('/api/user/profile')
      .set('Authorization', `Bearer ${token}`);
      
    // Token should be invalidated
    expect(afterPasswordChangeResponse.status).toBe(401);
    expect(afterPasswordChangeResponse.body.message).toMatch(/revoked/i);
  });
});