import { Request, Response } from 'express';
import { getCDNUrl, getCacheControl, shouldUseCDN } from '../config/cdn.config';
import { createCDNService } from '../services/cdnService';
import { cdnMiddleware } from '../middleware/cdn';

// Mock environment variables
const originalEnv = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = originalEnv;
});

describe('CDN Configuration', () => {
  describe('shouldUseCDN', () => {
    it('should return false when CDN is disabled', () => {
      process.env.CDN_ENABLED = 'false';
      expect(shouldUseCDN()).toBe(false);
    });

    it('should return false when provider is none', () => {
      process.env.CDN_ENABLED = 'true';
      process.env.CDN_PROVIDER = 'none';
      expect(shouldUseCDN()).toBe(false);
    });

    it('should return false when base URL is missing', () => {
      process.env.CDN_ENABLED = 'true';
      process.env.CDN_PROVIDER = 'cloudfront';
      process.env.CDN_BASE_URL = '';
      expect(shouldUseCDN()).toBe(false);
    });

    it('should return true when properly configured', () => {
      process.env.CDN_ENABLED = 'true';
      process.env.CDN_PROVIDER = 'cloudfront';
      process.env.CDN_BASE_URL = 'https://cdn.example.com';
      process.env.NODE_ENV = 'production';
      expect(shouldUseCDN()).toBe(true);
    });
  });

  describe('getCDNUrl', () => {
    beforeEach(() => {
      process.env.CDN_ENABLED = 'true';
      process.env.CDN_PROVIDER = 'cloudfront';
      process.env.CDN_BASE_URL = 'https://cdn.example.com';
      process.env.CDN_ASSET_PREFIX = '/assets';
      process.env.CDN_IMAGE_PREFIX = '/uploads';
      process.env.NODE_ENV = 'production';
    });

    it('should return original path when CDN is disabled', () => {
      process.env.CDN_ENABLED = 'false';
      expect(getCDNUrl('/assets/logo.png')).toBe('/assets/logo.png');
    });

    it('should transform asset URLs correctly', () => {
      expect(getCDNUrl('/assets/logo.png')).toBe('https://cdn.example.com/assets/assets/logo.png');
      expect(getCDNUrl('assets/logo.png')).toBe('https://cdn.example.com/assets/assets/logo.png');
    });

    it('should transform upload URLs correctly', () => {
      expect(getCDNUrl('/uploads/image.jpg')).toBe(
        'https://cdn.example.com/uploads/uploads/image.jpg'
      );
      expect(getCDNUrl('uploads/image.jpg')).toBe(
        'https://cdn.example.com/uploads/uploads/image.jpg'
      );
    });

    it('should handle trailing slashes in base URL', () => {
      process.env.CDN_BASE_URL = 'https://cdn.example.com/';
      expect(getCDNUrl('/assets/logo.png')).toBe('https://cdn.example.com/assets/assets/logo.png');
    });
  });

  describe('getCacheControl', () => {
    it('should return correct cache control for images', () => {
      expect(getCacheControl('image.jpg')).toBe('public, max-age=31536000, immutable');
      expect(getCacheControl('photo.png')).toBe('public, max-age=31536000, immutable');
      expect(getCacheControl('icon.svg')).toBe('public, max-age=31536000, immutable');
    });

    it('should return correct cache control for CSS', () => {
      expect(getCacheControl('styles.css')).toBe('public, max-age=31536000, immutable');
    });

    it('should return correct cache control for JavaScript', () => {
      expect(getCacheControl('app.js')).toBe('public, max-age=31536000, immutable');
      expect(getCacheControl('module.mjs')).toBe('public, max-age=31536000, immutable');
    });

    it('should return correct cache control for fonts', () => {
      expect(getCacheControl('font.woff')).toBe('public, max-age=31536000, immutable');
      expect(getCacheControl('font.woff2')).toBe('public, max-age=31536000, immutable');
    });

    it('should return default cache control for unknown types', () => {
      expect(getCacheControl('document.pdf')).toBe('public, max-age=3600');
      expect(getCacheControl('data.json')).toBe('public, max-age=3600');
    });
  });
});

describe('CDN Service', () => {
  describe('createCDNService', () => {
    it('should create CloudFront service', () => {
      process.env.CDN_PROVIDER = 'cloudfront';
      const service = createCDNService();
      expect(service).toBeDefined();
      expect(service.getUrl).toBeDefined();
    });

    it('should create Cloudflare service', () => {
      process.env.CDN_PROVIDER = 'cloudflare';
      const service = createCDNService();
      expect(service).toBeDefined();
      expect(service.getUrl).toBeDefined();
    });

    it('should create NoOp service for none provider', () => {
      process.env.CDN_PROVIDER = 'none';
      const service = createCDNService();
      expect(service).toBeDefined();
      expect(service.getUrl('/test.jpg')).toBe('/test.jpg');
    });

    it('should throw error for unimplemented providers', () => {
      process.env.CDN_PROVIDER = 'fastly';
      expect(() => createCDNService()).toThrow('Fastly CDN not implemented yet');
    });
  });

  describe('CDN Service Methods', () => {
    let service: any;

    beforeEach(() => {
      process.env.CDN_PROVIDER = 'none';
      service = createCDNService();
    });

    it('should handle getUrl', () => {
      const url = service.getUrl('/assets/image.jpg', {
        transform: { width: 300, height: 200, quality: 80 },
      });
      expect(url).toBe('/assets/image.jpg');
    });

    it('should handle getSignedUrl', async () => {
      const url = await service.getSignedUrl('/private/doc.pdf', 3600);
      expect(url).toBe('/private/doc.pdf');
    });

    it('should handle invalidate', async () => {
      const result = await service.invalidate(['/assets/old.css']);
      expect(result).toBe(true);
    });

    it('should handle uploadFile', async () => {
      const url = await service.uploadFile('/local/file.jpg', '/cdn/file.jpg');
      expect(url).toBe('/cdn/file.jpg');
    });

    it('should handle deleteFile', async () => {
      const result = await service.deleteFile('/cdn/old-file.jpg');
      expect(result).toBe(true);
    });

    it('should handle purgeCache', async () => {
      const result = await service.purgeCache(['/*']);
      expect(result).toBe(true);
    });
  });
});

describe('CDN Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;

  beforeEach(() => {
    req = {
      path: '/test',
      method: 'GET',
      headers: {},
      user: { id: '123', isAdmin: true },
    };
    res = {
      locals: {},
      setHeader: jest.fn(),
      getHeader: jest.fn(),
      headersSent: false,
      send: jest.fn(),
      json: jest.fn(),
      sendFile: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe('cdnUrlMiddleware', () => {
    it('should add CDN URL helper to response locals', () => {
      cdnMiddleware.url(req as Request, res as Response, next);

      expect(res.locals?.getCDNUrl).toBeDefined();
      expect(res.locals?.cdnEnabled).toBeDefined();
      expect(next).toHaveBeenCalled();
    });

    it('should return correct CDN URLs from helper', () => {
      process.env.CDN_ENABLED = 'true';
      process.env.CDN_PROVIDER = 'cloudfront';
      process.env.CDN_BASE_URL = 'https://cdn.example.com';
      process.env.NODE_ENV = 'production';

      cdnMiddleware.url(req as Request, res as Response, next);

      const cdnUrl = res.locals?.getCDNUrl('/assets/test.jpg');
      expect(cdnUrl).toContain('cdn.example.com');
    });
  });

  describe('cdnCacheHeaders', () => {
    it('should add CDN headers when sending response', () => {
      process.env.CDN_ENABLED = 'true';
      process.env.CDN_PROVIDER = 'cloudfront';
      process.env.CDN_BASE_URL = 'https://cdn.example.com';
      process.env.NODE_ENV = 'production';

      cdnMiddleware.cache(req as Request, res as Response, next);

      // Trigger send
      (res.send as jest.Mock).call(res, 'test');

      expect(res.setHeader).toHaveBeenCalledWith(
        expect.stringContaining('X-CDN'),
        expect.any(String)
      );
    });

    it('should not add headers when CDN is disabled', () => {
      process.env.CDN_ENABLED = 'false';

      cdnMiddleware.cache(req as Request, res as Response, next);

      // Trigger send
      (res.send as jest.Mock).call(res, 'test');

      expect(res.setHeader).not.toHaveBeenCalled();
    });
  });

  describe('cdnPurgeMiddleware', () => {
    beforeEach(() => {
      req.method = 'POST';
      (req as any).path = '/api/cdn/purge';
      req.body = {};
    });

    it('should require admin permission', async () => {
      req.user = { id: '123', isAdmin: false };

      await cdnMiddleware.purge(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should handle purge with paths', async () => {
      req.body = { paths: ['/assets/old.css', '/uploads/old.jpg'] };

      await cdnMiddleware.purge(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'CDN cache purged successfully',
      });
    });

    it('should handle purge with patterns', async () => {
      req.body = { patterns: ['/assets/*', '/uploads/*'] };

      await cdnMiddleware.purge(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'CDN cache purged successfully',
      });
    });

    it('should handle purge all', async () => {
      req.body = {};

      await cdnMiddleware.purge(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'CDN cache purged successfully',
      });
    });

    it('should pass through non-purge requests', async () => {
      (req as any).path = '/api/other';

      await cdnMiddleware.purge(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe('cdnRewriteMiddleware', () => {
    beforeEach(() => {
      process.env.CDN_ENABLED = 'true';
      process.env.CDN_PROVIDER = 'cloudfront';
      process.env.CDN_BASE_URL = 'https://cdn.example.com';
      process.env.NODE_ENV = 'production';
    });

    it('should rewrite URLs in JSON responses', () => {
      cdnMiddleware.rewrite(req as Request, res as Response, next);

      const data = {
        imageUrl: '/assets/photo.jpg',
        thumbnailUrl: '/uploads/thumb.jpg',
        other: 'not-a-url',
      };

      (res.json as jest.Mock).call(res, data);

      const calledData = (res.json as jest.Mock).mock.calls[0][0];
      expect(calledData.imageUrl).toContain('cdn.example.com');
      expect(calledData.thumbnailUrl).toContain('cdn.example.com');
      expect(calledData.other).toBe('not-a-url');
    });

    it('should handle nested objects', () => {
      cdnMiddleware.rewrite(req as Request, res as Response, next);

      const data = {
        user: {
          avatar: '/uploads/avatar.jpg',
          profile: {
            backgroundImage: '/assets/bg.png',
          },
        },
      };

      (res.json as jest.Mock).call(res, data);

      const calledData = (res.json as jest.Mock).mock.calls[0][0];
      expect(calledData.user.avatar).toContain('cdn.example.com');
      expect(calledData.user.profile.backgroundImage).toContain('cdn.example.com');
    });

    it('should handle arrays', () => {
      cdnMiddleware.rewrite(req as Request, res as Response, next);

      const data = {
        images: [{ url: '/assets/1.jpg' }, { url: '/assets/2.jpg' }, { url: '/assets/3.jpg' }],
      };

      (res.json as jest.Mock).call(res, data);

      const calledData = (res.json as jest.Mock).mock.calls[0][0];
      calledData.images.forEach((img: any) => {
        expect(img.url).toContain('cdn.example.com');
      });
    });

    it('should not rewrite when CDN is disabled', () => {
      process.env.CDN_ENABLED = 'false';

      cdnMiddleware.rewrite(req as Request, res as Response, next);

      const data = { imageUrl: '/assets/photo.jpg' };

      (res.json as jest.Mock).call(res, data);

      expect(next).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(data);
    });
  });
});
