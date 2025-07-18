/**
 * SecurityManager Tests
 */

import { SecurityManager } from '../SecurityManager';
import express, { Request, Response } from 'express';
import request from 'supertest';

describe('SecurityManager', () => {
  let securityManager: SecurityManager;
  let app: express.Application;

  beforeEach(() => {
    // Reset singleton instance
    (SecurityManager as any).instance = null;

    // Create new instance with test config
    securityManager = SecurityManager.getInstance({
      enableRateLimit: true,
      enableCSRF: false,
      enableCORS: true,
      enableHSTS: false,
      enableCSP: true,
      corsOrigins: ['http://localhost:3000'],
      rateLimitWindow: 60000, // 1 minute for testing
      rateLimitRequests: 5, // Low limit for testing
      useRedisForRateLimit: false,
    });

    // Reset metrics
    securityManager.resetMetrics();

    // Create test app
    app = express();
    app.use(express.json());

    // Apply security manager
    securityManager.applyToApp(app);

    // Add test route
    app.get('/test', (req: Request, res: Response) => {
      res.json({ success: true });
    });

    // Add auth test route
    app.post('/auth/login', (req: Request, res: Response) => {
      if (req.body.password === 'wrong') {
        securityManager.recordAuthFailure('127.0.0.1');
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      res.json({ token: 'test-token' });
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      // Make 5 requests (the limit)
      for (let i = 0; i < 5; i++) {
        const response = await request(app).get('/test');
        expect(response.status).toBe(200);
      }
    });

    it('should block requests exceeding rate limit', async () => {
      // Make 5 requests to reach limit
      for (let i = 0; i < 5; i++) {
        await request(app).get('/test');
      }

      // 6th request should be blocked
      const response = await request(app).get('/test');
      expect(response.status).toBe(429);
      expect(response.body.error).toBe('Too many requests');
    });

    it('should set Retry-After header when rate limited', async () => {
      // Exceed rate limit
      for (let i = 0; i < 6; i++) {
        await request(app).get('/test');
      }

      const response = await request(app).get('/test');
      expect(response.status).toBe(429);
      expect(response.headers['retry-after']).toBeDefined();
    });
  });

  describe('Suspicious IP Detection', () => {
    it('should mark IP as suspicious after multiple auth failures', async () => {
      // Trigger 5 auth failures
      for (let i = 0; i < 5; i++) {
        await request(app).post('/auth/login').send({ password: 'wrong' });
      }

      const metrics = securityManager.getMetrics();
      expect(metrics.authenticationFailures).toBe(5);
      expect(metrics.suspiciousIPs).toContain('::ffff:127.0.0.1');
    });

    it('should block requests from suspicious IPs', async () => {
      // Mark IP as suspicious
      securityManager.markAsSuspicious('::ffff:127.0.0.1');

      // Request should be blocked
      const response = await request(app).get('/test');
      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied');
    });

    it('should detect SQL injection attempts', async () => {
      await request(app).get("/test?search=' OR 1=1--");

      const metrics = securityManager.getMetrics();
      expect(metrics.suspiciousActivities).toBeGreaterThan(0);
    });

    it('should detect XSS attempts', async () => {
      await request(app)
        .post('/test')
        .send({ data: '<script>alert("xss")</script>' });

      const metrics = securityManager.getMetrics();
      expect(metrics.suspiciousActivities).toBeGreaterThan(0);
    });
  });

  describe('IP Whitelisting', () => {
    it('should allow whitelisted IPs without rate limiting', async () => {
      // Add IP to whitelist
      securityManager.addToWhitelist('::ffff:127.0.0.1');

      // Make many requests
      for (let i = 0; i < 10; i++) {
        const response = await request(app).get('/test');
        expect(response.status).toBe(200);
      }
    });

    it('should remove IP from whitelist', () => {
      securityManager.addToWhitelist('192.168.1.1');
      securityManager.removeFromWhitelist('192.168.1.1');

      // IP should no longer be whitelisted
      // (would need to mock IP to test properly)
    });
  });

  describe('Security Metrics', () => {
    it('should track total requests', async () => {
      await request(app).get('/test');
      await request(app).get('/test');

      const metrics = securityManager.getMetrics();
      expect(metrics.totalRequests).toBe(2);
    });

    it('should track blocked requests', async () => {
      securityManager.markAsSuspicious('::ffff:127.0.0.1');

      await request(app).get('/test');

      const metrics = securityManager.getMetrics();
      expect(metrics.blockedRequests).toBe(1);
    });

    it('should reset metrics', () => {
      securityManager.recordAuthFailure('127.0.0.1');
      securityManager.recordCSRFViolation('127.0.0.1');

      securityManager.resetMetrics();

      const metrics = securityManager.getMetrics();
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.authenticationFailures).toBe(0);
      expect(metrics.csrfViolations).toBe(0);
    });
  });

  describe('Security Headers', () => {
    it('should generate proper security headers', () => {
      const mockReq = { secure: true } as Request;
      const headers = securityManager.getSecurityHeaders(mockReq);

      expect(headers['X-Frame-Options']).toBe('DENY');
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['X-XSS-Protection']).toBe('1; mode=block');
      expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    });

    it('should include HSTS header for secure requests', () => {
      const mockReq = { secure: true } as Request;
      const headers = securityManager.getSecurityHeaders(mockReq);

      expect(headers['Strict-Transport-Security']).toBeDefined();
      expect(headers['Strict-Transport-Security']).toContain('max-age=31536000');
    });

    it('should generate CSP header with nonce', () => {
      const mockReq = {} as Request;
      const headers = securityManager.getSecurityHeaders(mockReq);

      expect(headers['Content-Security-Policy']).toBeDefined();
      expect(headers['Content-Security-Policy']).toContain("script-src 'self' 'nonce-");
    });
  });

  describe('CSRF Protection', () => {
    it('should record CSRF violations', () => {
      securityManager.recordCSRFViolation('192.168.1.1');

      const metrics = securityManager.getMetrics();
      expect(metrics.csrfViolations).toBe(1);
      expect(metrics.suspiciousIPs).toContain('192.168.1.1');
    });
  });

  describe('Admin Endpoints', () => {
    it('should protect security metrics endpoint', async () => {
      const response = await request(app).get('/api/security/metrics');
      expect(response.status).toBe(403);
    });

    it('should allow admin access to metrics', async () => {
      // Would need to mock authentication middleware for proper test
      // This is a placeholder showing the expected behavior
    });
  });
});
