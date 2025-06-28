import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import logger from '../utils/logger';

const router = express.Router();

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
router.post('/generate', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
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
      format: fileExtension 
    });

    // Convert to PNG for preview
    if (fileExtension === '.bmp') {
      // Use Python PIL for BMP
      const { exec } = require('child_process');
      const util = require('util');
      const execAsync = util.promisify(exec);
      
      const pythonScript = `
import sys
from PIL import Image
img = Image.open('${tempPath}')
# Resize for preview if too large
if img.width > 800 or img.height > 800:
    img.thumbnail((800, 800), Image.Resampling.LANCZOS)
img.save('${outputPath}', 'PNG', optimize=True)
`;
      
      await execAsync(`python3 -c "${pythonScript}"`);
    } else {
      // Use Sharp for TIFF
      await sharp(tempPath)
        .resize(800, 800, { 
          fit: 'inside',
          withoutEnlargement: true 
        })
        .png({ 
          compressionLevel: 6, // Faster compression for preview
          adaptiveFiltering: true 
        })
        .toFile(outputPath);
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
});

export default router;