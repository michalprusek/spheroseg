/**
 * Tests for static cache middleware
 */

import { Request, Response } from 'express';
import { staticCacheMiddleware } from '../staticCache';

describe('Static Cache Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;

  beforeEach(() => {
    req = {
      path: '/test.txt',
    };
    res = {
      setHeader: jest.fn(),
    };
    next = jest.fn();
  });

  it('should set cache headers for images', () => {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'ico'];

    imageExtensions.forEach(ext => {
      req.path = `/image.${ext}`;
      staticCacheMiddleware(req as Request, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'public, max-age=2592000, immutable'
      );
    });
  });

  it('should set cache headers for CSS and JS files', () => {
    const scriptExtensions = ['css', 'js', 'mjs'];

    scriptExtensions.forEach(ext => {
      req.path = `/script.${ext}`;
      staticCacheMiddleware(req as Request, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'public, max-age=31536000, immutable'
      );
    });
  });

  it('should set cache headers for fonts', () => {
    const fontExtensions = ['woff', 'woff2', 'ttf', 'otf', 'eot'];

    fontExtensions.forEach(ext => {
      req.path = `/font.${ext}`;
      staticCacheMiddleware(req as Request, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'public, max-age=31536000, immutable'
      );
    });
  });

  it('should set no-cache for JSON files', () => {
    req.path = '/data.json';
    staticCacheMiddleware(req as Request, res as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'no-cache, no-store, must-revalidate'
    );
  });

  it('should not set cache headers for other files', () => {
    req.path = '/document.pdf';
    staticCacheMiddleware(req as Request, res as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      expect.anything()
    );
  });

  it('should add ETag header', () => {
    req.path = '/test.jpg';
    staticCacheMiddleware(req as Request, res as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'ETag',
      expect.stringMatching(/^"\/test\.jpg-\d+"$/)
    );
  });

  it('should call next', () => {
    req.path = '/test.jpg';
    staticCacheMiddleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it('should be case insensitive', () => {
    req.path = '/IMAGE.JPG';
    staticCacheMiddleware(req as Request, res as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, max-age=2592000, immutable'
    );
  });
});