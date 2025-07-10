/**
 * CORS Middleware Tests
 *
 * This file contains tests for the CORS middleware.
 */

import request from 'supertest';
import express from 'express';
import { applySecurityMiddleware } from '../../security/middleware/security';
import config from '../../config';

describe('CORS Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    // Create a new Express app for each test
    app = express();

    // Apply security middleware including CORS
    applySecurityMiddleware(app, { enableCORS: true });

    // Add a simple route for testing
    app.get('/test', (req, res) => {
      res.status(200).json({ message: 'Test successful' });
    });
  });

  describe('CORS functionality', () => {
    it('should handle requests from allowed origins', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', config.server.corsOrigins[0])
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('should handle preflight requests', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', config.server.corsOrigins[0])
        .set('Access-Control-Request-Method', 'POST')
        .expect(204);

      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });

    it('should reject requests from unauthorized origins', async () => {
      const response = await request(app).get('/test').set('Origin', 'https://malicious-site.com');

      // The request might still succeed, but CORS headers should not be set
      expect(response.headers['access-control-allow-origin']).not.toBe(
        'https://malicious-site.com'
      );
    });

    it('should handle requests without origin header', async () => {
      const response = await request(app).get('/test').expect(200);

      expect(response.body).toHaveProperty('message', 'Test successful');
    });
  });
});
