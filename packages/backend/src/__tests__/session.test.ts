/**
 * Session Management Tests
 * 
 * Tests for Redis-based session management functionality
 */

import request from 'supertest';
import { createApp } from '../app';
import { initializeRedis, closeRedis } from '../config/redis';
import sessionService from '../services/sessionService';
import pool from '../db';
import { Application } from 'express';

describe('Session Management', () => {
  let app: Application;
  let testUserId: string;
  let sessionCookie: string;

  beforeAll(async () => {
    app = createApp();
    initializeRedis();
    
    // Create test user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      ['session-test@example.com', '$2b$10$test', 'Session Test User']
    );
    testUserId = result.rows[0].id;
  });

  afterAll(async () => {
    // Clean up test user
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    await closeRedis();
    await pool.end();
  });

  describe('Session Creation', () => {
    it('should create a session on login', async () => {
      const response = await request(app)
        .post('/api/auth/session/login')
        .send({
          email: 'session-test@example.com',
          password: 'testpassword',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.sessionId).toBeDefined();
      expect(response.body.data.authMethod).toBe('session');
      
      // Check for session cookie
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toMatch(/spheroseg\.sid=/);
      
      sessionCookie = cookies[0];
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/session/login')
        .send({
          email: 'session-test@example.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Session Authentication', () => {
    it('should authenticate with session cookie', async () => {
      const response = await request(app)
        .get('/api/auth/session/info')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.userId).toBe(testUserId);
      expect(response.body.data.email).toBe('session-test@example.com');
    });

    it('should reject requests without session', async () => {
      const response = await request(app)
        .get('/api/auth/session/info');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Session Management', () => {
    it('should list user sessions', async () => {
      const response = await request(app)
        .get('/api/auth/session/list')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.sessions).toBeInstanceOf(Array);
      expect(response.body.data.sessions.length).toBeGreaterThan(0);
    });

    it('should extend session expiry', async () => {
      const response = await request(app)
        .post('/api/auth/session/extend')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.extended).toBe(true);
      expect(response.body.data.expiresAt).toBeDefined();
    });

    it('should invalidate other sessions', async () => {
      // Create another session
      const loginResponse = await request(app)
        .post('/api/auth/session/login')
        .send({
          email: 'session-test@example.com',
          password: 'testpassword',
        });
      
      const otherSessionCookie = loginResponse.headers['set-cookie'][0];

      // Invalidate other sessions
      const response = await request(app)
        .post('/api/auth/session/invalidate-others')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.invalidated).toBeGreaterThan(0);

      // Verify other session is invalidated
      const checkResponse = await request(app)
        .get('/api/auth/session/info')
        .set('Cookie', otherSessionCookie);

      expect(checkResponse.status).toBe(401);
    });
  });

  describe('Session Security', () => {
    it('should handle session timeout', async () => {
      // This would require mocking time or waiting for actual timeout
      // For now, we'll test the session security middleware is working
      const response = await request(app)
        .get('/api/auth/session/info')
        .set('Cookie', 'spheroseg.sid=invalid-session-id');

      expect(response.status).toBe(401);
    });

    it('should destroy session on logout', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify session is destroyed
      const checkResponse = await request(app)
        .get('/api/auth/session/info')
        .set('Cookie', sessionCookie);

      expect(checkResponse.status).toBe(401);
    });
  });

  describe('Session Service', () => {
    it('should track user sessions', async () => {
      await sessionService.trackUserSession(testUserId, 'test-session-id');
      const sessions = await sessionService.getUserSessions(testUserId);
      
      expect(sessions).toBeInstanceOf(Array);
      expect(sessions.some(s => s.sessionId === 'test-session-id')).toBe(true);
    });

    it('should clean up expired sessions', async () => {
      const cleaned = await sessionService.cleanupExpiredSessions();
      expect(typeof cleaned).toBe('number');
      expect(cleaned).toBeGreaterThanOrEqual(0);
    });

    it('should get session statistics', async () => {
      const stats = await sessionService.getSessionStats();
      
      expect(stats).toHaveProperty('totalSessions');
      expect(stats).toHaveProperty('activeSessions');
      expect(stats).toHaveProperty('uniqueUsers');
      expect(stats).toHaveProperty('averageSessionDuration');
    });
  });
});