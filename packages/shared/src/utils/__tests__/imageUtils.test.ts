/**
 * Tests for shared image utilities
 */

import { describe, it, expect } from 'vitest';
import { 
  validateImageFile,
  getImageDimensions,
  generateThumbnailPath,
  getSupportedImageFormats,
  isValidImageFormat,
} from '../imageUtils';

describe('Image Utils', () => {
  describe('validateImageFile', () => {
    it('should validate valid image files', () => {
      const validFiles = [
        { name: 'test.jpg', size: 1024000, type: 'image/jpeg' },
        { name: 'test.png', size: 512000, type: 'image/png' },
        { name: 'test.tiff', size: 2048000, type: 'image/tiff' },
        { name: 'test.bmp', size: 1024000, type: 'image/bmp' },
      ];

      validFiles.forEach(file => {
        expect(() => validateImageFile(file as File)).not.toThrow();
      });
    });

    it('should reject invalid file types', () => {
      const invalidFiles = [
        { name: 'test.txt', size: 1024, type: 'text/plain' },
        { name: 'test.pdf', size: 1024, type: 'application/pdf' },
        { name: 'test.gif', size: 1024, type: 'image/gif' },
      ];

      invalidFiles.forEach(file => {
        expect(() => validateImageFile(file as File)).toThrow();
      });
    });

    it('should reject files that are too large', () => {
      const largeFile = { 
        name: 'large.jpg', 
        size: 100 * 1024 * 1024, // 100MB
        type: 'image/jpeg' 
      };

      expect(() => validateImageFile(largeFile as File)).toThrow();
    });

    it('should reject files that are too small', () => {
      const smallFile = { 
        name: 'small.jpg', 
        size: 100, // 100 bytes
        type: 'image/jpeg' 
      };

      expect(() => validateImageFile(smallFile as File)).toThrow();
    });
  });

  describe('getImageDimensions', () => {
    it('should return valid dimensions object', () => {
      const dimensions = getImageDimensions(800, 600);
      
      expect(dimensions).toEqual({
        width: 800,
        height: 600,
      });
    });

    it('should handle zero dimensions', () => {
      const dimensions = getImageDimensions(0, 0);
      
      expect(dimensions).toEqual({
        width: 0,
        height: 0,
      });
    });

    it('should handle negative dimensions', () => {
      expect(() => getImageDimensions(-1, 100)).toThrow();
      expect(() => getImageDimensions(100, -1)).toThrow();
    });
  });

  describe('generateThumbnailPath', () => {
    it('should generate correct thumbnail path', () => {
      const originalPath = '/uploads/images/test.jpg';
      const thumbnailPath = generateThumbnailPath(originalPath);
      
      expect(thumbnailPath).toBe('/uploads/thumbnails/test_thumb.jpg');
    });

    it('should handle different file extensions', () => {
      const testCases = [
        { input: '/path/image.png', expected: '/path/thumbnails/image_thumb.png' },
        { input: '/path/image.tiff', expected: '/path/thumbnails/image_thumb.tiff' },
        { input: '/path/image.bmp', expected: '/path/thumbnails/image_thumb.bmp' },
      ];

      testCases.forEach(({ input, expected }) => {
        expect(generateThumbnailPath(input)).toBe(expected);
      });
    });

    it('should handle paths without extension', () => {
      const path = '/path/image';
      expect(() => generateThumbnailPath(path)).toThrow();
    });
  });

  describe('getSupportedImageFormats', () => {
    it('should return array of supported formats', () => {
      const formats = getSupportedImageFormats();
      
      expect(Array.isArray(formats)).toBe(true);
      expect(formats.length).toBeGreaterThan(0);
      expect(formats).toContain('image/jpeg');
      expect(formats).toContain('image/png');
      expect(formats).toContain('image/tiff');
      expect(formats).toContain('image/bmp');
    });

    it('should not include unsupported formats', () => {
      const formats = getSupportedImageFormats();
      
      expect(formats).not.toContain('image/gif');
      expect(formats).not.toContain('image/webp');
      expect(formats).not.toContain('application/pdf');
    });
  });

  describe('isValidImageFormat', () => {
    it('should validate supported formats', () => {
      const supportedFormats = ['image/jpeg', 'image/png', 'image/tiff', 'image/bmp'];
      
      supportedFormats.forEach(format => {
        expect(isValidImageFormat(format)).toBe(true);
      });
    });

    it('should reject unsupported formats', () => {
      const unsupportedFormats = ['image/gif', 'image/webp', 'text/plain', 'application/pdf'];
      
      unsupportedFormats.forEach(format => {
        expect(isValidImageFormat(format)).toBe(false);
      });
    });

    it('should handle case insensitivity', () => {
      expect(isValidImageFormat('IMAGE/JPEG')).toBe(true);
      expect(isValidImageFormat('Image/Png')).toBe(true);
    });

    it('should handle empty and invalid inputs', () => {
      expect(isValidImageFormat('')).toBe(false);
      expect(isValidImageFormat(null as any)).toBe(false);
      expect(isValidImageFormat(undefined as any)).toBe(false);
    });
  });

  describe('Image utility integration', () => {
    it('should work together for complete image validation', () => {
      const validFile = {
        name: 'test.jpg',
        size: 1024000,
        type: 'image/jpeg'
      } as File;

      // Should not throw
      expect(() => validateImageFile(validFile)).not.toThrow();
      
      // Should be valid format
      expect(isValidImageFormat(validFile.type)).toBe(true);
      
      // Should be in supported formats
      expect(getSupportedImageFormats()).toContain(validFile.type);
    });

    it('should provide consistent validation', () => {
      const invalidFile = {
        name: 'test.gif',
        size: 1024000,
        type: 'image/gif'
      } as File;

      // Should throw in validation
      expect(() => validateImageFile(invalidFile)).toThrow();
      
      // Should not be valid format
      expect(isValidImageFormat(invalidFile.type)).toBe(false);
      
      // Should not be in supported formats
      expect(getSupportedImageFormats()).not.toContain(invalidFile.type);
    });
  });
});