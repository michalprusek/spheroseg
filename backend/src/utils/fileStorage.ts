import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import sharp from 'sharp';
import config from '../config/config';
import { AppError } from '../middleware/errorHandler';

// Create necessary directories for file uploads
export const createUploadDirsIfNotExist = () => {
  const dirs = [
    config.storage.uploadsFolder,
    path.join(config.storage.uploadsFolder, 'images'),
    path.join(config.storage.uploadsFolder, 'thumbnails'),
    path.join(config.storage.uploadsFolder, 'temp')
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
};

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(config.storage.uploadsFolder, 'temp'));
  },
  filename: (req, file, cb) => {
    const fileExtension = path.extname(file.originalname);
    const fileName = `${uuidv4()}${fileExtension}`;
    cb(null, fileName);
  }
});

// Configure file filter for images
const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new AppError('Only image files are allowed', 400) as any);
  }
};

// Create multer upload configuration
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.storage.maxFileSize
  }
});

// Function to generate a thumbnail from an image
export const generateThumbnail = async (
  filePath: string,
  width: number = 200,
  height: number = 200
): Promise<string> => {
  const fileDir = path.dirname(filePath);
  const fileName = path.basename(filePath);
  const thumbnailDir = path.join(config.storage.uploadsFolder, 'thumbnails');
  const thumbnailPath = path.join(thumbnailDir, fileName);

  try {
    await sharp(filePath)
      .resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .toFile(thumbnailPath);

    return thumbnailPath;
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    throw new AppError('Failed to generate thumbnail', 500);
  }
};

// Function to move file from temp to permanent storage
export const moveFile = (
  tempFilePath: string,
  userId: string,
  projectId: string
): string => {
  const fileName = path.basename(tempFilePath);
  const targetDir = path.join(config.storage.uploadsFolder, 'images', userId, projectId);
  
  // Create target directory if it doesn't exist
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  const targetPath = path.join(targetDir, fileName);
  
  fs.renameSync(tempFilePath, targetPath);
  return targetPath;
};

// Function to delete a file
export const deleteFile = (filePath: string): void => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

// Function to get file URL (for local storage)
export const getFileUrl = (filePath: string): string => {
  // For local storage, convert filesystem path to URL path
  const relativePath = path.relative(config.storage.uploadsFolder, filePath);
  return `/uploads/${relativePath.replace(/\\/g, '/')}`;
}; 