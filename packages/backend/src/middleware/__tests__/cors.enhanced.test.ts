/**
 * Tests for Enhanced CORS Middleware
 */

import { Request, Response } from 'express';
import { createEnhancedCorsMiddleware, validateCorsConfiguration, getCorsConfiguration } from '../cors.enhanced';

// Mock modules
jest.mock('../../utils/logger');
jest.mock('../../config', () => ({
  env: 'test',
  isDevelopment: false,
}));

describe('Enhanced CORS Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;
  let corsMiddleware: any;

  beforeEach(() => {
    // Clear environment variables
    delete process.env['PRODUCTION_DOMAIN'];
    delete process.env['STAGING_DOMAIN'];
    delete process.env['CORS_ALLOWED_ORIGINS'];

    // Setup mocks
    mockReq = {
      header: jest.fn(),
      method: 'GET',
      path: '/api/test',
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('Mozilla/5.0'),
    };

    mockRes = {
      vary: jest.fn(),
      setHeader: jest.fn(),
    };

    mockNext = jest.fn();

    // Create middleware instance
    corsMiddleware = createEnhancedCorsMiddleware();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Origin Validation', () => {
    it('should allow localhost origins in development', (done) => {
      mockReq.header = jest.fn().mockReturnValue('http://localhost:3000');

      // Call the middleware
      corsMiddleware(mockReq as Request, mockRes as Response, (err: any) => {
        expect(err).toBeUndefined();
        expect(mockNext).not.toHaveBeenCalled();
        done();
      });
    });

    it('should allow 127.0.0.1 origins', (done) => {
      mockReq.header = jest.fn().mockReturnValue('http://127.0.0.1:3000');

      corsMiddleware(mockReq as Request, mockRes as Response, (err: any) => {
        expect(err).toBeUndefined();
        done();
      });
    });

    it('should reject invalid origin structure', (done) => {
      mockReq.header = jest.fn().mockReturnValue('ftp://localhost:3000');

      corsMiddleware(mockReq as Request, mockRes as Response, (err: any) => {
        expect(err).toBeDefined();
        expect(err.message).toContain('Invalid origin format');
        done();
      });
    });

    it('should reject origins with paths', (done) => {
      mockReq.header = jest.fn().mockReturnValue('http://localhost:3000/path');

      corsMiddleware(mockReq as Request, mockRes as Response, (err: any) => {
        expect(err).toBeDefined();
        expect(err.message).toContain('Invalid origin format');
        done();
      });
    });

    it('should reject origins with credentials', (done) => {
      mockReq.header = jest.fn().mockReturnValue('http://user:pass@localhost:3000');

      corsMiddleware(mockReq as Request, mockRes as Response, (err: any) => {
        expect(err).toBeDefined();
        expect(err.message).toContain('Invalid origin format');
        done();
      });
    });

    it('should allow production domain when configured', (done) => {
      process.env['PRODUCTION_DOMAIN'] = 'example.com';
      mockReq.header = jest.fn().mockReturnValue('https://example.com');

      // Recreate middleware with new env
      corsMiddleware = createEnhancedCorsMiddleware();

      corsMiddleware(mockReq as Request, mockRes as Response, (err: any) => {
        expect(err).toBeUndefined();
        done();
      });
    });

    it('should allow www subdomain for production', (done) => {
      process.env['PRODUCTION_DOMAIN'] = 'example.com';
      mockReq.header = jest.fn().mockReturnValue('https://www.example.com');

      corsMiddleware = createEnhancedCorsMiddleware();

      corsMiddleware(mockReq as Request, mockRes as Response, (err: any) => {
        expect(err).toBeUndefined();
        done();
      });
    });

    it('should allow additional origins from environment', (done) => {
      process.env['CORS_ALLOWED_ORIGINS'] = 'https://trusted.com,https://partner.com';
      mockReq.header = jest.fn().mockReturnValue('https://trusted.com');

      corsMiddleware = createEnhancedCorsMiddleware();

      corsMiddleware(mockReq as Request, mockRes as Response, (err: any) => {
        expect(err).toBeUndefined();
        done();
      });
    });

    it('should reject non-whitelisted origins', (done) => {
      mockReq.header = jest.fn().mockReturnValue('https://evil.com');

      corsMiddleware(mockReq as Request, mockRes as Response, (err: any) => {
        expect(err).toBeDefined();
        expect(err.message).toContain('Origin not allowed');
        done();
      });
    });

    it('should handle requests without origin header', (done) => {
      mockReq.header = jest.fn().mockReturnValue(undefined);

      corsMiddleware(mockReq as Request, mockRes as Response, (err: any) => {
        expect(err).toBeUndefined();
        done();
      });
    });
  });

  describe('validateOriginStructure', () => {
    // Import the function (you'll need to export it from the module)
    const { validateOriginStructure } = require('../cors.enhanced');

    it('should accept valid HTTP origins', () => {
      expect(validateOriginStructure('http://localhost')).toBe(true);
      expect(validateOriginStructure('http://localhost:3000')).toBe(true);
      expect(validateOriginStructure('https://example.com')).toBe(true);
    });

    it('should reject invalid protocols', () => {
      expect(validateOriginStructure('ftp://localhost')).toBe(false);
      expect(validateOriginStructure('ws://localhost')).toBe(false);
      expect(validateOriginStructure('file:///path')).toBe(false);
    });

    it('should reject origins with paths', () => {
      expect(validateOriginStructure('http://localhost/path')).toBe(false);
      expect(validateOriginStructure('https://example.com/api')).toBe(false);
    });

    it('should reject origins with credentials', () => {
      expect(validateOriginStructure('http://user:pass@localhost')).toBe(false);
      expect(validateOriginStructure('https://token@example.com')).toBe(false);
    });

    it('should reject malformed URLs', () => {
      expect(validateOriginStructure('not-a-url')).toBe(false);
      expect(validateOriginStructure('http://')).toBe(false);
      expect(validateOriginStructure('')).toBe(false);
    });
  });

  describe('validateCorsConfiguration', () => {
    const originalEnv = process.env['NODE_ENV'];

    afterEach(() => {
      process.env['NODE_ENV'] = originalEnv;
    });

    it('should pass validation with valid configuration', () => {
      process.env['PRODUCTION_DOMAIN'] = 'example.com';
      process.env['CORS_ALLOWED_ORIGINS'] = 'https://trusted.com';

      expect(() => validateCorsConfiguration()).not.toThrow();
    });

    it('should fail in production without PRODUCTION_DOMAIN', () => {
      const config = require('../../config');
      config.env = 'production';

      expect(() => validateCorsConfiguration()).toThrow('Invalid CORS configuration');
    });

    it('should warn about localhost in production additional origins', () => {
      const config = require('../../config');
      config.env = 'production';
      process.env['PRODUCTION_DOMAIN'] = 'example.com';
      process.env['CORS_ALLOWED_ORIGINS'] = 'http://localhost:3000';

      expect(() => validateCorsConfiguration()).toThrow('Invalid CORS configuration');
    });

    it('should validate additional origins format', () => {
      process.env['CORS_ALLOWED_ORIGINS'] = 'https://valid.com,invalid-url,https://another.com';

      const config = require('../../config');
      config.env = 'development';

      // Should not throw in development, just log warnings
      expect(() => validateCorsConfiguration()).not.toThrow();
    });
  });

  describe('getCorsConfiguration', () => {
    it('should return current CORS configuration', () => {
      process.env['PRODUCTION_DOMAIN'] = 'example.com';
      process.env['CORS_ALLOWED_ORIGINS'] = 'https://trusted.com,https://partner.com';

      const config = getCorsConfiguration();

      expect(config).toHaveProperty('whitelist');
      expect(config).toHaveProperty('additionalOrigins');
      expect(config).toHaveProperty('environment');
      expect(config).toHaveProperty('settings');

      expect(config.additionalOrigins).toEqual(['https://trusted.com', 'https://partner.com']);
      expect(config.settings.credentials).toBe(true);
      expect(config.settings.methods).toContain('GET');
      expect(config.settings.methods).toContain('POST');
    });
  });

  describe('CORS Headers', () => {
    it('should set appropriate headers for allowed origins', (done) => {
      mockReq.header = jest.fn().mockReturnValue('http://localhost:3000');

      const callback = (err: any, options: any) => {
        expect(err).toBeUndefined();
        expect(options.origin).toBe(true);
        expect(options.credentials).toBe(true);
        expect(options.methods).toContain('GET');
        expect(options.methods).toContain('POST');
        expect(options.allowedHeaders).toContain('Authorization');
        expect(options.exposedHeaders).toContain('X-Request-ID');
        expect(options.maxAge).toBeDefined();
        done();
      };

      // Access the delegate function directly
      const cors = require('cors');
      const lastCall = cors.mock.calls[cors.mock.calls.length - 1];
      const delegate = lastCall[0];
      delegate(mockReq, callback);
    });

    it('should handle preflight requests', () => {
      mockReq.method = 'OPTIONS';
      mockReq.header = jest.fn().mockReturnValue('http://localhost:3000');

      // The CORS middleware handles this internally
      // Just verify it doesn't throw
      expect(() => {
        corsMiddleware(mockReq as Request, mockRes as Response, mockNext);
      }).not.toThrow();
    });
  });
});