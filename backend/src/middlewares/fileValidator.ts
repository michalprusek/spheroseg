import { Request, Response, NextFunction } from 'express';
import { config } from '../config/app';
import path from 'path';

/**
 * Middleware to validate file uploads
 */
export const validateFileUpload = (req: Request, res: Response, next: NextFunction): void => {
  // Check if file exists
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const file = req.file;
  
  // Check file size
  const maxSizeInBytes = parseFileSize(config.storage.maxFileSize);
  if (file.size > maxSizeInBytes) {
    res.status(400).json({ 
      error: `File size exceeds the maximum allowed size of ${config.storage.maxFileSize}` 
    });
    return;
  }

  // Check file type
  if (!config.storage.allowedFileTypes.includes(file.mimetype)) {
    res.status(400).json({ 
      error: `File type ${file.mimetype} is not allowed. Allowed types: ${config.storage.allowedFileTypes.join(', ')}` 
    });
    return;
  }

  // Check file extension
  const fileExtension = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.tiff', '.tif'];
  if (!allowedExtensions.includes(fileExtension)) {
    res.status(400).json({ 
      error: `File extension ${fileExtension} is not allowed. Allowed extensions: ${allowedExtensions.join(', ')}` 
    });
    return;
  }

  // Check filename for security
  const filenameRegex = /^[a-zA-Z0-9_.-]+$/;
  const sanitizedFilename = path.basename(file.originalname);
  if (!filenameRegex.test(sanitizedFilename)) {
    res.status(400).json({ 
      error: 'Filename contains invalid characters. Use only letters, numbers, underscores, hyphens, and periods.' 
    });
    return;
  }

  // If all checks pass, continue
  next();
};

/**
 * Parse file size string (e.g., "50MB") to bytes
 */
function parseFileSize(sizeStr: string): number {
  const units: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024
  };

  const matches = sizeStr.match(/^(\d+)([A-Z]+)$/i);
  if (!matches) {
    return 50 * 1024 * 1024; // Default to 50MB if format is invalid
  }

  const size = parseInt(matches[1], 10);
  const unit = matches[2].toUpperCase();

  if (!units[unit]) {
    return 50 * 1024 * 1024; // Default to 50MB if unit is invalid
  }

  return size * units[unit];
}