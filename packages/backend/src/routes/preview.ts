import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import logger from '../utils/logger';

const router = express.Router();

// Preview configuration
const PREVIEW_MAX_SIZE = parseInt(process.env.PREVIEW_MAX_SIZE || '800', 10);
const PREVIEW_QUALITY = parseInt(process.env.PREVIEW_QUALITY || '6', 10);

// Configure multer for temporary file uploads
const upload = multer({
  dest: '/tmp/preview-uploads/',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for preview
  },
});

/**
 * Generate a preview for TIFF/BMP files
 * This endpoint converts TIFF/BMP to PNG and returns it immediately
 */
router.post(
  '/generate',
  upload.single('file'),
  async (req: Request, res: Response, _next: NextFunction) => {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const tempPath = file.path;
    const outputPath = `${tempPath}.png`;

    try {
      const fileExtension = path.extname(file.originalname).toLowerCase();

      // Check if it's a TIFF or BMP file
      if (!['.tiff', '.tif', '.bmp'].includes(fileExtension)) {
        // For other formats, just return the original
        return res.sendFile(tempPath, () => {
          fs.unlinkSync(tempPath);
        });
      }

      logger.debug('Generating preview for', {
        originalName: file.originalname,
        format: fileExtension,
      });

      // Convert to PNG for preview using Sharp for both TIFF and BMP
      try {
        await sharp(tempPath)
          .resize(PREVIEW_MAX_SIZE, PREVIEW_MAX_SIZE, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .png({
            compressionLevel: PREVIEW_QUALITY, // Configurable compression for preview
            adaptiveFiltering: true,
          })
          .toFile(outputPath);

        logger.debug('Preview generated successfully', {
          originalName: file.originalname,
          format: fileExtension,
          outputPath,
        });
      } catch (sharpError) {
        logger.error('Sharp conversion failed', {
          error: sharpError,
          format: fileExtension,
        });

        // If Sharp fails for BMP, return error as Sharp should handle it
        throw new Error(`Failed to convert ${fileExtension} to PNG: ${sharpError.message}`);
      }

      // Send the PNG file
      res.contentType('image/png');
      const stream = fs.createReadStream(outputPath);

      stream.on('end', () => {
        // Clean up temporary files
        try {
          fs.unlinkSync(tempPath);
          fs.unlinkSync(outputPath);
        } catch (error) {
          logger.warn('Failed to clean up preview files', { error });
        }
      });

      stream.pipe(res);
    } catch (error) {
      logger.error('Error generating preview', { error, file: file.originalname });

      // Clean up on error
      try {
        fs.unlinkSync(tempPath);
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
      } catch (cleanupError) {
        logger.warn('Failed to clean up after error', { cleanupError });
      }

      res.status(500).json({ error: 'Failed to generate preview' });
    }
  }
);

export default router;
