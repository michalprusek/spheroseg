/**
 * Session Management Integration Tests
 * 
 * Comprehensive tests for session-based authentication and management
 */

import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../../app';
import { pool } from '../../db';
import { getRedis } from '../../config/redis';
import sessionService from '../../services/sessionService';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

describe('Session Management Integration Tests', () => {
  let app: Express;
  let testUserId: number;
  let testUserEmail: string;
  let testUserPassword: string;
  let sessionCookie: string;
  
  beforeAll(async () => {
    app = createApp();
    
    // Create a test user
    testUserEmail = `test-${Date.now()}@example.com`;
    testUserPassword = 'TestPassword123!';
    const hashedPassword = await bcrypt.hash(testUserPassword, 10);
    
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, role) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      [testUserEmail, hashedPassword, 'Test User', 'user']
    );
    testUserId = result.rows[0].id;
  });
  
  afterAll(async () => {
    // Clean up test user
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    
    // Clean up Redis sessions
    const redis = getRedis();
    if (redis) {
      const sessionKeys = await redis.keys('spheroseg:sess:*');
      if (sessionKeys.length > 0) {
        await redis.del(...sessionKeys);
      }
      const userSessionKeys = await redis.keys(`spheroseg:user:sessions:${testUserId}`);
      if (userSessionKeys.length > 0) {
        await redis.del(...userSessionKeys);
      }
    }
  });
  
  describe('Session Authentication', () => {
    describe('POST /api/auth/login', () => {
      it('should create a session on successful login', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUserEmail,
            password: testUserPassword,
          })
          .expect(200);
        
        expect(response.body.success).toBe(true);
        expect(response.body.user).toBeDefined();
        expect(response.body.token).toBeDefined();
        
        // Check for session cookie
        const cookies = response.headers['set-cookie'];
        expect(cookies).toBeDefined();
        const sessionCookieHeader = cookies.find((cookie: string) => 
          cookie.startsWith('connect.sid=') || cookie.startsWith('spheroseg.sid=')
        );
        expect(sessionCookieHeader).toBeDefined();
        
        // Store session cookie for subsequent tests
        sessionCookie = sessionCookieHeader;
      });
      
      it('should reject invalid credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUserEmail,
            password: 'wrongpassword',
          })
          .expect(401);
        
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Invalid credentials');
      });
      
      it('should handle remember_me option', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUserEmail,
            password: testUserPassword,
            remember_me: true,
          })
          .expect(200);
        
        const cookies = response.headers['set-cookie'];
        const sessionCookieHeader = cookies.find((cookie: string) => 
          cookie.startsWith('connect.sid=') || cookie.startsWith('spheroseg.sid=')
        );
        
        // Check for extended expiry
        expect(sessionCookieHeader).toContain('Max-Age=');
      });
    });
    
    describe('GET /api/auth/me', () => {
      it('should return user data with valid session', async () => {
        // First login to get session
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUserEmail,
            password: testUserPassword,
          });
        
        const cookies = loginResponse.headers['set-cookie'];
        
        // Use session to access protected endpoint
        const response = await request(app)
          .get('/api/auth/me')
          .set('Cookie', cookies)
          .expect(200);
        
        expect(response.body.success).toBe(true);
        expect(response.body.user.email).toBe(testUserEmail);
      });
      
      it('should reject requests without session', async () => {
        await request(app)
          .get('/api/auth/me')
          .expect(401);
      });
    });
    
    describe('POST /api/auth/logout', () => {
      it('should destroy session on logout', async () => {
        // First login
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUserEmail,
            password: testUserPassword,
          });
        
        const cookies = loginResponse.headers['set-cookie'];
        
        // Logout
        await request(app)
          .post('/api/auth/logout')
          .set('Cookie', cookies)
          .expect(200);
        
        // Try to access protected endpoint with old session
        await request(app)
          .get('/api/auth/me')
          .set('Cookie', cookies)
          .expect(401);
      });
      
      it('should handle logout without session gracefully', async () => {
        const response = await request(app)
          .post('/api/auth/logout')
          .expect(200);
        
        expect(response.body.success).toBe(true);
      });
    });
  });
  
  describe('Session Management', () => {
    let authCookie: string;
    
    beforeEach(async () => {
      // Login to get session
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUserEmail,
          password: testUserPassword,
        });
      
      authCookie = loginResponse.headers['set-cookie'];
    });
    
    describe('GET /api/auth/sessions', () => {
      it('should list all user sessions', async () => {
        // Create multiple sessions
        await request(app)
          .post('/api/auth/login')
          .send({
            email: testUserEmail,
            password: testUserPassword,
          });
        
        await request(app)
          .post('/api/auth/login')
          .send({
            email: testUserEmail,
            password: testUserPassword,
          });
        
        const response = await request(app)
          .get('/api/auth/sessions')
          .set('Cookie', authCookie)
          .expect(200);
        
        expect(response.body.success).toBe(true);
        expect(response.body.data.sessions).toBeInstanceOf(Array);
        expect(response.body.data.sessions.length).toBeGreaterThanOrEqual(1);
        
        const session = response.body.data.sessions[0];
        expect(session).toHaveProperty('sessionId');
        expect(session).toHaveProperty('createdAt');
        expect(session).toHaveProperty('lastActivity');
        expect(session).toHaveProperty('isActive');
      });
    });
    
    describe('DELETE /api/auth/sessions/:sessionId', () => {
      it('should invalidate a specific session', async () => {
        // Get current sessions
        const sessionsResponse = await request(app)
          .get('/api/auth/sessions')
          .set('Cookie', authCookie);
        
        const sessions = sessionsResponse.body.data.sessions;
        const sessionToDelete = sessions.find((s: any) => !authCookie.includes(s.sessionId));
        
        if (sessionToDelete) {
          await request(app)
            .delete(`/api/auth/sessions/${sessionToDelete.sessionId}`)
            .set('Cookie', authCookie)
            .expect(200);
          
          // Verify session was deleted
          const updatedSessions = await request(app)
            .get('/api/auth/sessions')
            .set('Cookie', authCookie);
          
          const deletedSession = updatedSessions.body.data.sessions
            .find((s: any) => s.sessionId === sessionToDelete.sessionId);
          expect(deletedSession).toBeUndefined();
        }
      });
      
      it('should not allow deleting current session', async () => {
        const sessionsResponse = await request(app)
          .get('/api/auth/sessions')
          .set('Cookie', authCookie);
        
        const currentSessionId = sessionsResponse.body.data.currentSessionId;
        
        const response = await request(app)
          .delete(`/api/auth/sessions/${currentSessionId}`)
          .set('Cookie', authCookie)
          .expect(400);
        
        expect(response.body.error).toContain('Cannot invalidate current session');
      });
    });
    
    describe('POST /api/auth/sessions/invalidate-all', () => {
      it('should invalidate all sessions except current', async () => {
        // Create multiple sessions
        for (let i = 0; i < 3; i++) {
          await request(app)
            .post('/api/auth/login')
            .send({
              email: testUserEmail,
              password: testUserPassword,
            });
        }
        
        await request(app)
          .post('/api/auth/sessions/invalidate-all')
          .set('Cookie', authCookie)
          .expect(200);
        
        // Check only current session remains
        const sessionsResponse = await request(app)
          .get('/api/auth/sessions')
          .set('Cookie', authCookie);
        
        expect(sessionsResponse.body.data.sessions.length).toBe(1);
      });
    });
  });
  
  describe('Session Security', () => {
    describe('Session Hijacking Prevention', () => {
      it('should invalidate session on IP change', async () => {
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUserEmail,
            password: testUserPassword,
          })
          .set('X-Forwarded-For', '192.168.1.1');
        
        const cookies = loginResponse.headers['set-cookie'];
        
        // Try to use session from different IP
        const response = await request(app)
          .get('/api/auth/me')
          .set('Cookie', cookies)
          .set('X-Forwarded-For', '192.168.1.2')
          .expect(401);
        
        expect(response.body.error).toContain('Session security violation');
      });
      
      it('should detect concurrent session limit violations', async () => {
        const maxSessions = 5; // Assuming default limit
        
        // Create max sessions
        for (let i = 0; i < maxSessions + 2; i++) {
          await request(app)
            .post('/api/auth/login')
            .send({
              email: testUserEmail,
              password: testUserPassword,
            });
        }
        
        // Check that older sessions were invalidated
        const sessions = await sessionService.getUserSessions(testUserId.toString());
        expect(sessions.length).toBeLessThanOrEqual(maxSessions);
      });
    });
    
    describe('Session Timeout', () => {
      it('should invalidate inactive sessions', async () => {
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUserEmail,
            password: testUserPassword,
          });
        
        const cookies = loginResponse.headers['set-cookie'];
        const sessionId = cookies[0].split('=')[1].split(';')[0];
        
        // Manually update session to be inactive
        const redis = getRedis();
        if (redis) {
          const sessionData = await redis.get(`spheroseg:sess:${sessionId}`);
          if (sessionData) {
            const data = JSON.parse(sessionData);
            data.lastActivity = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
            await redis.set(`spheroseg:sess:${sessionId}`, JSON.stringify(data));
          }
        }
        
        // Try to use expired session
        await request(app)
          .get('/api/auth/me')
          .set('Cookie', cookies)
          .expect(401);
      });
    });
  });
  
  describe('Session Migration', () => {
    it('should support JWT to session migration', async () => {
      // First get JWT token
      const jwtResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUserEmail,
          password: testUserPassword,
        });
      
      const jwtToken = jwtResponse.body.token;
      
      // Use JWT token to access protected endpoint
      const meResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);
      
      expect(meResponse.body.user.email).toBe(testUserEmail);
      
      // Check if session was created alongside JWT
      const cookies = jwtResponse.headers['set-cookie'];
      expect(cookies).toBeDefined();
    });
  });
  
  describe('Session Analytics', () => {
    describe('GET /api/auth/sessions/stats', () => {
      it('should return session statistics', async () => {
        // Create some sessions
        for (let i = 0; i < 3; i++) {
          await request(app)
            .post('/api/auth/login')
            .send({
              email: testUserEmail,
              password: testUserPassword,
            });
        }
        
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUserEmail,
            password: testUserPassword,
          });
        
        const response = await request(app)
          .get('/api/auth/sessions/stats')
          .set('Cookie', loginResponse.headers['set-cookie'])
          .expect(200);
        
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('totalSessions');
        expect(response.body.data).toHaveProperty('activeSessions');
        expect(response.body.data).toHaveProperty('uniqueUsers');
        expect(response.body.data).toHaveProperty('averageSessionDuration');
      });
    });
  });
  
  describe('CSRF Protection', () => {
    it('should include CSRF token in session', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUserEmail,
          password: testUserPassword,
        });
      
      const cookies = loginResponse.headers['set-cookie'];
      
      const csrfResponse = await request(app)
        .get('/api/auth/csrf-token')
        .set('Cookie', cookies)
        .expect(200);
      
      expect(csrfResponse.body.csrfToken).toBeDefined();
    });
    
    it('should validate CSRF token on state-changing requests', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUserEmail,
          password: testUserPassword,
        });
      
      const cookies = loginResponse.headers['set-cookie'];
      
      // Get CSRF token
      const csrfResponse = await request(app)
        .get('/api/auth/csrf-token')
        .set('Cookie', cookies);
      
      const csrfToken = csrfResponse.body.csrfToken;
      
      // Make request with CSRF token
      await request(app)
        .post('/api/auth/sessions/invalidate-all')
        .set('Cookie', cookies)
        .set('X-CSRF-Token', csrfToken)
        .expect(200);
      
      // Make request without CSRF token (should fail)
      await request(app)
        .post('/api/auth/sessions/invalidate-all')
        .set('Cookie', cookies)
        .expect(403);
    });
  });
});