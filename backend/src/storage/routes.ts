import { Router, RequestHandler } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { config } from '../config/app';
import { authenticateJWT } from '../auth/middleware';
import { errorHandler } from '../middlewares/errorHandler';
import { validateFileUpload } from '../middlewares/fileValidator';
import { apiResponse } from '../utils/apiResponse';
import { createHandler, wrapMiddleware } from '../utils/expressHelpers';
import { FileData } from './types';
import { query } from '../db/connection';
import {
  createFileRecord,
  getFileRecord,
  getFileRecordByFilename,
  deleteFileRecordByFilename
} from './storageService';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    // Ensure upload directory exists
    if (!fs.existsSync(config.storage.uploadDir)) {
      fs.mkdirSync(config.storage.uploadDir, { recursive: true });
    }
    cb(null, config.storage.uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    // Sanitize filename
    const sanitizedExt = ext.replace(/[^a-zA-Z0-9.]/g, '');
    cb(null, `${file.fieldname}-${uniqueSuffix}${sanitizedExt}`);
  }
});

// Configure multer with file size limits
const upload = multer({
  storage,
  limits: {
    fileSize: parseFileSize(config.storage.maxFileSize)
  }
});

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
const router = Router();

const uploadHandler = createHandler<FileData>(async (req, res) => {
  if (!req.file || !req.user) {
    apiResponse(res, !req.file ? 'No file uploaded' : 'Unauthorized', 400);
    return;
  }

  const projectId = (req.body as any).project_id || null;

  const fileRecord = await createFileRecord({
    filename: req.file.filename,
    original_name: req.file.originalname,
    path: req.file.path,
    size: req.file.size,
    mimetype: req.file.mimetype,
    project_id: projectId
  }, req.user.id);

  apiResponse(res, fileRecord, 201);
});

const getFileHandler = createHandler<FileData>(async (req, res) => {
  if (!req.user) {
    apiResponse(res, 'Unauthorized', 401);
    return;
  }

  const fileRecord = await getFileRecordByFilename(req.params.filename, req.user.id);

  if (!fileRecord) {
    apiResponse(res, 'File not found', 404);
    return;
  }

  apiResponse(res, fileRecord);
});

const deleteFileHandler = createHandler(async (req, res) => {
  if (!req.user) {
    apiResponse(res, 'Unauthorized', 401);
    return;
  }

  const fileRecord = await getFileRecordByFilename(req.params.filename, req.user.id);

  if (!fileRecord) {
    apiResponse(res, 'File not found', 404);
    return;
  }

  const filePath = fileRecord.storage_path || fileRecord.path || path.join(config.storage.uploadDir, req.params.filename);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  await deleteFileRecordByFilename(req.params.filename, req.user.id);

  apiResponse(res, { message: 'File deleted' });
});

router.post(
  '/upload',
  wrapMiddleware(authenticateJWT as RequestHandler),
  upload.single('file'),
  wrapMiddleware(validateFileUpload as RequestHandler),
  uploadHandler
);
router.get(
  '/:filename',
  wrapMiddleware(authenticateJWT as RequestHandler),
  getFileHandler
);
router.delete(
  '/:filename',
  wrapMiddleware(authenticateJWT as RequestHandler),
  deleteFileHandler
);
router.use(errorHandler);

// Export handlers for testing
const uploadFile = async (req: any, res: any, next: any): Promise<void> => {
  if (!req.file || !req.user) {
    res.status(400).json({ message: 'No file uploaded' });
    return;
  }

  try {
    const fileRecord = await createFileRecord({
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype
    }, req.user.id);

    res.status(201).json(fileRecord);
  } catch (error) {
    next(error);
  }
};

const getFile = async (req: any, res: any, next: any): Promise<void> => {
  try {
    const fileRecord = await getFileRecord(req.params.id, req.user.id);

    if (!fileRecord) {
      res.status(404).json({ message: 'File not found' });
      return;
    }

    res.json(fileRecord);
  } catch (error) {
    next(error);
  }
};

const downloadFile = async (req: any, res: any, next: any): Promise<void> => {
  try {
    const fileRecord = await getFileRecord(req.params.id, req.user.id);

    if (!fileRecord) {
      res.status(404).json({ message: 'File not found' });
      return;
    }

    const filePath = path.join(config.storage.uploadDir, fileRecord.filename);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ message: 'File not found on disk' });
      return;
    }

    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
};

const listFiles = async (req: any, res: any, next: any): Promise<void> => {
  try {
    const files = await query('SELECT * FROM files WHERE user_id = $1', [req.user.id]);
    res.json(files);
  } catch (error) {
    next(error);
  }
};

const deleteFile = async (req: any, res: any, next: any): Promise<void> => {
  try {
    const fileRecord = await getFileRecord(req.params.id, req.user.id);

    if (!fileRecord) {
      res.status(404).json({ message: 'File not found' });
      return;
    }

    // Delete file from disk
    const filePath = path.join(config.storage.uploadDir, fileRecord.path);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }

    // Delete file from database
    await query('DELETE FROM files WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);

    res.status(200).json({ message: 'File deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export { router as storageRouter, uploadFile, getFile, downloadFile, listFiles, deleteFile };
