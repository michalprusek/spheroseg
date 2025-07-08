import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { createThumbnail } from '../imageUtils.unified';
import logger from '../logger';

// Mock dependencies
jest.mock('fs');
jest.mock('sharp');
jest.mock('../logger', () => ({
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

// Mock child_process for BMP handling
jest.mock('child_process', () => ({
  exec: jest.fn((cmd, callback) => callback(null, { stdout: '', stderr: '' })),
}));

describe('imageUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock sharp to return a chainable object
    const sharpInstance = {
      resize: jest.fn().mockReturnThis(),
      png: jest.fn().mockReturnThis(),
      toFile: jest.fn().mockResolvedValue(undefined),
      metadata: jest.fn().mockResolvedValue({ width: 100, height: 100, format: 'png' }),
    };
    (sharp as jest.Mock).mockReturnValue(sharpInstance);
  });

  describe('createThumbnail', () => {
    it('should validate that target path has .png extension', async () => {
      const sourcePath = '/test/image.jpg';
      const invalidTargetPath = '/test/thumb.jpg';

      await expect(createThumbnail(sourcePath, invalidTargetPath)).rejects.toThrow(
        'Thumbnail target path must have .png extension, got: /test/thumb.jpg'
      );
    });

    it('should accept target path with .png extension', async () => {
      const sourcePath = '/test/image.jpg';
      const validTargetPath = '/test/thumb.png';

      await createThumbnail(sourcePath, validTargetPath);

      // Verify sharp was called correctly
      expect(sharp).toHaveBeenCalledWith(sourcePath);
      const sharpInstance = (sharp as jest.Mock).mock.results[0].value;
      expect(sharpInstance.resize).toHaveBeenCalledWith({ width: 300, height: 300, fit: 'inside' });
      expect(sharpInstance.png).toHaveBeenCalled();
      expect(sharpInstance.toFile).toHaveBeenCalledWith(validTargetPath);
    });

    it('should handle .PNG extension (uppercase)', async () => {
      const sourcePath = '/test/image.jpg';
      const validTargetPath = '/test/thumb.PNG';

      await createThumbnail(sourcePath, validTargetPath);

      // Should not throw error
      expect(sharp).toHaveBeenCalled();
    });

    it('should handle BMP files with PNG output', async () => {
      const sourcePath = '/test/image.bmp';
      const targetPath = '/test/thumb.png';
      
      // Mock util.promisify
      const util = require('util');
      util.promisify = jest.fn(() => jest.fn().mockResolvedValue({ stdout: '', stderr: '' }));

      await createThumbnail(sourcePath, targetPath);

      // Should use Python PIL for BMP files
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Created BMP thumbnail using PIL'),
        expect.any(Object)
      );
    });

    it('should handle TIFF files with PNG output', async () => {
      const sourcePath = '/test/image.tiff';
      const targetPath = '/test/thumb.png';

      await createThumbnail(sourcePath, targetPath);

      // Verify sharp was used for TIFF
      expect(sharp).toHaveBeenCalledWith(sourcePath);
      const sharpInstance = (sharp as jest.Mock).mock.results[0].value;
      expect(sharpInstance.png).toHaveBeenCalledWith({
        compressionLevel: 9,
        adaptiveFiltering: true
      });
    });

    it('should fall back to temporary conversion for TIFF on sharp error', async () => {
      const sourcePath = '/test/image.tiff';
      const targetPath = '/test/thumb.png';

      // Make sharp fail on first call (direct conversion)
      const sharpInstance = {
        resize: jest.fn().mockReturnThis(),
        png: jest.fn().mockReturnThis(),
        toFile: jest.fn()
          .mockRejectedValueOnce(new Error('TIFF not supported'))
          .mockResolvedValueOnce(undefined),
      };
      
      (sharp as jest.Mock)
        .mockReturnValueOnce(sharpInstance) // First call fails
        .mockReturnValueOnce({ // Second call for temp conversion
          png: jest.fn().mockReturnThis(),
          toFile: jest.fn().mockResolvedValue(undefined),
        })
        .mockReturnValueOnce({ // Third call for thumbnail from temp
          resize: jest.fn().mockReturnThis(),
          png: jest.fn().mockReturnThis(),
          toFile: jest.fn().mockResolvedValue(undefined),
        });

      // Mock fs.promises.unlink
      (fs.promises as any) = {
        unlink: jest.fn().mockResolvedValue(undefined),
      };

      await createThumbnail(sourcePath, targetPath);

      // Verify fallback was used
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Direct conversion of .tiff failed'),
        expect.any(Object)
      );
    });
  });
});