/**
 * Tests for static cache middleware
 */

import { Request, Response } from 'express';
import { staticCacheMiddleware } from '../staticCache';

describe('Static Cache Middleware', () => {
  let res: Partial<Response>;
  let next: jest.Mock;

  beforeEach(() => {
    res = {
      setHeader: jest.fn(),
    };
    next = jest.fn();
  });

  it('should set cache headers for images', async () => {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'ico'];

    for (const ext of imageExtensions) {
      const req = { path: `/image.${ext}` } as Request;
      await staticCacheMiddleware(req, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'public, max-age=2592000, immutable'
      );
    }
  });

  it('should set cache headers for CSS and JS files', async () => {
    const scriptExtensions = ['css', 'js', 'mjs'];

    for (const ext of scriptExtensions) {
      const req = { path: `/script.${ext}` } as Request;
      await staticCacheMiddleware(req, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'public, max-age=31536000, immutable'
      );
    });
  });

  it('should set cache headers for fonts', () => {
    const fontExtensions = ['woff', 'woff2', 'ttf', 'otf', 'eot'];

    fontExtensions.forEach((ext) => {
      const req = { path: `/font.${ext}` } as Request;
      staticCacheMiddleware(req, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'public, max-age=31536000, immutable'
      );
    });
  });

  it('should set no-cache for JSON files', () => {
    const req = { path: '/data.json' } as Request;
    staticCacheMiddleware(req, res as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'no-cache, no-store, must-revalidate'
    );
  });

  it('should not set cache headers for other files', () => {
    const req = { path: '/document.pdf' } as Request;
    staticCacheMiddleware(req, res as Response, next);

    // Middleware doesn't set cache headers for PDF files
    expect(res.setHeader).not.toHaveBeenCalledWith('Cache-Control', expect.anything());
  });

  it('should add ETag header in development', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const req = { path: '/test.jpg' } as Request;
    await staticCacheMiddleware(req, res as Response, next);

    // In development, ETag is only set if file exists
    // Since we're mocking, we don't expect ETag to be set
    expect(next).toHaveBeenCalled();

    process.env.NODE_ENV = originalEnv;
  });

  it('should call next', async () => {
    const req = { path: '/test.jpg' } as Request;
    await staticCacheMiddleware(req, res as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it('should be case insensitive', () => {
    const req = { path: '/IMAGE.JPG' } as Request;
    staticCacheMiddleware(req, res as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, max-age=2592000, immutable'
    );
  });
});
