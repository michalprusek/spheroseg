import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import getAssetUrl from '../utils/getAssetUrl';

// We'll set up different env values per test

describe('Image Loading Utilities', () => {
  const originalEnv = { ...import.meta.env };

  beforeEach(() => {
    // Clear console mocks between tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original env
    Object.assign(import.meta.env, originalEnv);
    vi.unstubAllGlobals();
  });

  describe('getAssetUrl', () => {
    it('should return direct path for illustration assets', () => {
      // Mock development environment
      Object.assign(import.meta.env, {
        DEV: true,
        VITE_ASSETS_URL: 'http://assets:80',
      });

      const path = 'assets/illustrations/test-image.png';
      const result = getAssetUrl(path);

      expect(result).toBe('/assets/illustrations/test-image.png');
    });

    it('should handle paths with leading slashes', () => {
      // Mock development environment
      Object.assign(import.meta.env, {
        DEV: true,
        VITE_ASSETS_URL: 'http://assets:80',
      });

      const path = '/assets/illustrations/test-image.png';
      const result = getAssetUrl(path);

      expect(result).toBe('/assets/illustrations/test-image.png');
    });

    it('should use assets URL for non-illustration assets in production', () => {
      // Mock production environment
      Object.assign(import.meta.env, {
        DEV: false,
        VITE_ASSETS_URL: 'http://assets:80',
      });

      const path = 'other/path/image.png';
      const result = getAssetUrl(path);

      expect(result).toBe('http://assets:80/other/path/image.png');
    });

    it('should use direct path for non-illustration assets in development', () => {
      // Mock development environment
      Object.assign(import.meta.env, {
        DEV: true,
        VITE_ASSETS_URL: 'http://assets:80',
      });

      const path = 'other/path/image.png';
      const result = getAssetUrl(path);

      expect(result).toBe('/other/path/image.png');
    });
  });
});
