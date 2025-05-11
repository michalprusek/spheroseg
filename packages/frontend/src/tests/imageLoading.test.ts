import { describe, it, expect, vi, beforeEach } from 'vitest';
import getAssetUrl from '../utils/getAssetUrl';

// Mock the import.meta.env
vi.mock('import.meta.env', () => ({
  env: {
    DEV: true,
    VITE_ASSETS_URL: 'http://assets:80',
  },
}));

describe('Image Loading Utilities', () => {
  beforeEach(() => {
    // Clear console mocks between tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('getAssetUrl', () => {
    it('should return direct path for illustration assets', () => {
      const path = 'assets/illustrations/test-image.png';
      const result = getAssetUrl(path);

      expect(result).toBe('/assets/illustrations/test-image.png');
    });

    it('should handle paths with leading slashes', () => {
      const path = '/assets/illustrations/test-image.png';
      const result = getAssetUrl(path);

      expect(result).toBe('/assets/illustrations/test-image.png');
    });

    it('should use assets URL for non-illustration assets', () => {
      const path = 'other/path/image.png';
      const result = getAssetUrl(path);

      expect(result).toBe('http://assets:80/other/path/image.png');
    });
  });
});
