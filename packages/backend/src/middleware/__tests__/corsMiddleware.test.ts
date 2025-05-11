/**
 * CORS Middleware Tests
 *
 * This file contains tests for the CORS middleware.
 */

import request from 'supertest';
import express from 'express';
import { corsOptions, applyCors } from '../corsMiddleware';
import config from '../../config';

describe('CORS Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    // Create a new Express app for each test
    app = express();

    // Apply CORS middleware
    applyCors(app);

    // Add a simple route for testing
    app.get('/test', (req, res) => {
      res.status(200).json({ message: 'Test successful' });
    });
  });

  describe('corsOptions', () => {
    it('should have the correct properties', () => {
      expect(corsOptions).toHaveProperty('origin');
      expect(corsOptions).toHaveProperty('credentials', true);
      expect(corsOptions).toHaveProperty('optionsSuccessStatus', 200);
      expect(corsOptions).toHaveProperty('methods');
      expect(corsOptions).toHaveProperty('allowedHeaders');
    });

    it('should include all required HTTP methods', () => {
      expect(corsOptions.methods).toContain('GET');
      expect(corsOptions.methods).toContain('POST');
      expect(corsOptions.methods).toContain('PUT');
      expect(corsOptions.methods).toContain('DELETE');
      expect(corsOptions.methods).toContain('OPTIONS');
    });

    it('should include all required headers', () => {
      expect(corsOptions.allowedHeaders).toContain('Content-Type');
      expect(corsOptions.allowedHeaders).toContain('Authorization');
    });
  });

  describe('origin validation', () => {
    it('should allow requests from localhost', () => {
      const originCallback = corsOptions.origin as Function;
      const mockCallback = jest.fn();

      originCallback('http://localhost:3000', mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, true);
    });

    it('should allow requests from configured origins', () => {
      const originCallback = corsOptions.origin as Function;
      const mockCallback = jest.fn();

      // Test with the first configured origin
      if (config.server.corsOrigins.length > 0) {
        originCallback(config.server.corsOrigins[0], mockCallback);
        expect(mockCallback).toHaveBeenCalledWith(null, true);
      }
    });

    it('should reject requests from unauthorized origins', () => {
      const originCallback = corsOptions.origin as Function;
      const mockCallback = jest.fn();

      originCallback('https://malicious-site.com', mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should allow requests with no origin (like curl)', () => {
      const originCallback = corsOptions.origin as Function;
      const mockCallback = jest.fn();

      originCallback(undefined, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, true);
    });
  });

  describe('CORS headers', () => {
    it('should set Access-Control-Allow-Origin header for allowed origins', async () => {
      const response = await request(app).get('/test').set('Origin', 'http://localhost:3000');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('should set Access-Control-Allow-Credentials header', async () => {
      const response = await request(app).get('/test').set('Origin', 'http://localhost:3000');

      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should handle preflight requests', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');

      expect(response.status).toBe(200); // Express CORS middleware returns 200 for preflight by default
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });
  });
});
