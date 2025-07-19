/**
 * Security Headers Tests
 * These tests verify that the correct security headers are applied to responses
 */

import request from 'supertest';
import { app } from '../server';

describe('Security Headers', () => {
  it('should include correct security headers in API responses', async () => {
    const response = await request(app).get('/api/status');

    // Check for security headers
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(response.headers['content-security-policy']).toBeDefined();

    // Check for permissions policy
    expect(response.headers['permissions-policy']).toBeDefined();

    // In non-prod environments, HSTS might be disabled
    if (process.env.NODE_ENV === 'production') {
      const hsts = response.headers['strict-transport-security'];
      expect(hsts).toBeDefined();
      expect(hsts).toContain('max-age=31536000');
      expect(hsts).toContain('includeSubDomains');
      expect(hsts).toContain('preload');
    }

    // Check that CSP has key directives
    const csp = response.headers['content-security-policy'];
    if (csp) {
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");

      // In production, we should have upgrade-insecure-requests and block-all-mixed-content
      if (process.env.NODE_ENV === 'production') {
        expect(csp).toContain('upgrade-insecure-requests');
        expect(csp).toContain('block-all-mixed-content');
      }
    }
  });

  it('should include CSRF cookie in response to GET requests', async () => {
    const response = await request(app).get('/api/status');

    // Check for CSRF cookie
    const cookies = response.headers['set-cookie'] || [];
    const hasCsrfCookie = Array.isArray(cookies) && cookies.some((cookie: string) => cookie.includes('XSRF-TOKEN'));

    // In development, CSRF might be disabled
    if (process.env.NODE_ENV !== 'development') {
      expect(hasCsrfCookie).toBe(true);

      // In production, CSRF cookie should have secure and strict SameSite
      if (process.env.NODE_ENV === 'production') {
        const csrfCookie = Array.isArray(cookies) ? cookies.find((cookie: string) => cookie.includes('XSRF-TOKEN')) : undefined;
        expect(csrfCookie).toContain('Secure');
        expect(csrfCookie).toContain('SameSite=Strict');
      }
    }
  });

  it('should reject API requests without CSRF token', async () => {
    // Skip in development where CSRF might be disabled
    if (process.env.NODE_ENV === 'development') {
      return;
    }

    // First make a GET request to get the CSRF cookie
    const getResponse = await request(app).get('/api/status');
    const cookies = getResponse.headers['set-cookie'] || [];

    // Try to make a POST request without CSRF token
    const postResponse = await request(app)
      .post('/api/test-endpoint')
      .set('Cookie', Array.isArray(cookies) ? cookies : []) // Set the cookies but not the CSRF header
      .send({ test: 'data' });

    // Should be rejected with 403 Forbidden
    expect(postResponse.status).toBe(403);
  });

  it('should accept API requests with valid CSRF token', async () => {
    // Skip in development where CSRF might be disabled
    if (process.env.NODE_ENV === 'development') {
      return;
    }

    // First make a GET request to get the CSRF cookie
    const agent = request.agent(app);
    await agent.get('/api/status');

    // Extract CSRF token from cookie
    const cookies = (agent as unknown).jar.getCookies('http://localhost');
    const csrfCookie = cookies.find((cookie: any) => cookie.key === 'XSRF-TOKEN');

    if (!csrfCookie) {
      throw new Error('CSRF cookie not found');
    }

    // Make a POST request with CSRF token
    const postResponse = await agent
      .post('/api/auth/logout') // Use an endpoint that should exist
      .set('X-XSRF-TOKEN', csrfCookie.value)
      .send({ test: 'data' });

    // Should not be rejected with 403 Forbidden
    expect(postResponse.status).not.toBe(403);
  });
});
