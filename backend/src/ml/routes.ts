import express, { Request, Response, NextFunction } from 'express';
import { authenticateJWT } from '../auth/middleware';
import { validateSegmentationParams } from './middleware';
import { addSegmentationJob } from './queue';
import { config } from '../config/app';
import axios from 'axios';
import path from 'path';
import { query } from '../db/connection';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { validateMLCallbackToken } from './middleware';
import { mlCallbackHandler } from './controllers/ml.controller';
import { getSignedUrl } from '../storage/service';
export function createMlRouter(mocks: { mlService?: typeof import('./services/ml.service') } = {}) {
  const mlServiceModule = mocks.mlService || require('./services/ml.service');
  const router = express.Router();

  // Example: wrap one route to demonstrate mock usage
  router.post('/projects/:projectId/images/:imageId/segmentation', async (req, res) => {
    try {
      const { projectId, imageId } = req.params;
      const params = req.body.parameters || {};
      const result = await mlServiceModule.initiateSegmentationJob({}, projectId, imageId, params);
      res.status(202).json({ jobId: result.jobId });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to initiate segmentation' });
    }
  });

  // TODO: replicate other routes similarly if needed

  return router;
}


const mlRouter = express.Router();
// Project-specific segmentation endpoints for ML integration
import * as mlService from './services/ml.service';

// Project-specific segmentation endpoints for ML integration
mlRouter.post('/projects/:projectId/images/:imageId/segmentation', async (req, res) => {
  try {
    const { projectId, imageId } = req.params;
    const params = req.body.parameters || {};
    const result = await mlService.initiateSegmentationJob({}, projectId, imageId, params);
    res.status(202).json({ jobId: result.jobId });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to initiate segmentation' });
  }
});

mlRouter.get('/projects/:projectId/segmentation/:jobId/status', async (req, res) => {
  try {
    const { jobId } = req.params;
    const status = await mlService.getSegmentationStatus({}, jobId);
    res.status(200).json({ status });
  } catch (err: any) {
    if (err.message.includes('not found')) {
      res.status(404).json({ error: 'Job not found' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

mlRouter.get('/projects/:projectId/segmentation/:jobId/result', async (req, res) => {
  try {
    const { jobId } = req.params;
    const result = await mlService.getSegmentationResult({}, jobId);
    res.status(200).json(result);
  } catch (err: any) {
    if (err.message.includes('not found') || err.message.includes('not ready')) {
      res.status(404).json({ error: err.message });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});



// ML worker callback endpoint
mlRouter.post('/ml/jobs/:jobId/callback', validateMLCallbackToken, mlCallbackHandler);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.storage.uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(config.storage.maxFileSize.replace('MB', '')) * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (config.storage.allowedFileTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Allowed types: ${config.storage.allowedFileTypes.join(', ')}`));
    }
  }
});

// Health check endpoint
mlRouter.get('/health', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const mlServiceUrl = config.ml?.serviceUrl || 'http://ml-service:8000';
    const response = await axios.get(`${mlServiceUrl}/health`, {
      headers: {
        'x-api-key': config.ml.apiKey
      }
    });
    res.json(response.data);
  } catch (error) {
    next(error);
  }
});

// Segment image endpoint
mlRouter.post('/segment',
  authenticateJWT as any,
  validateSegmentationParams,
  upload.single('image'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const { projectId } = req.body;
      if (!projectId) {
        res.status(400).json({ error: 'Project ID is required' });
        return;
      }

      // Save file to database
      const fileId = uuidv4();
      const userId = req.user?.id;

      await query(
        `INSERT INTO files (id, name, path, size, mime_type, project_id, user_id, original_name, segmentation_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          fileId,
          req.file.filename,
          req.file.path,
          req.file.size,
          req.file.mimetype,
          projectId,
          userId,
          req.file.originalname,
          'processing'
        ]
      );

      // Generate a signed URL for the file
      let signedUrl = '';
      try {
        // Make sure userId is defined before calling getSignedUrl
        if (userId) {
          signedUrl = await getSignedUrl(fileId, userId);
        } else {
          throw new Error('User ID is undefined');
        }
      } catch (urlError) {
        console.error('Error generating signed URL:', urlError);
        res.status(500).json({ error: 'Failed to generate signed URL for file' });
        return;
      }

      // Generate a job ID
      const jobId = uuidv4();

      // Enqueue segmentation job
      try {
        const job = await addSegmentationJob({
          jobId,
          fileId,
          signedUrl,
          filePath: req.file.path,
          userId,
          projectId,
          params: {
            threshold: req.body.threshold || '0.5',
            saveContours: req.body.save_contours || 'true'
          }
        });

        res.status(202).json({ jobId: job.id, status: 'queued' });
      } catch (queueError) {
        console.error('Error enqueuing segmentation job:', queueError);
        res.status(500).json({ error: 'Failed to enqueue segmentation job' });
      }
      return;
    } catch (error) {
      // Update file status to failed if it exists
      if (req.file) {
        try {
          await query(
            `UPDATE files SET segmentation_status = $1 WHERE name = $2`,
            ['failed', req.file.filename]
          );
        } catch (dbError) {
          console.error('Failed to update file status:', dbError);
        }
      }
      next(error);
    }
  }
);

// Get segmentation results
mlRouter.get('/results/:fileId',
  authenticateJWT as any,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { fileId } = req.params;

      // Get segmentation results from database
      const results = await query(
        `SELECT sr.*
         FROM segmentation_results sr
         JOIN files f ON sr.file_id = f.id
         WHERE f.id = $1 AND f.user_id = $2`,
        [fileId, req.user?.id]
      );

      if (results.length === 0) {
        res.status(404).json({ error: 'Segmentation results not found' });
        return;
      }

      res.json(results[0]);
    } catch (error) {
      next(error);
    }
  }
);

// Get all segmentation results for a project
mlRouter.get('/project/:projectId',
  authenticateJWT as any,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId } = req.params;

      // Get all segmentation results for a project
      const results = await query(
        `SELECT f.id as file_id, f.name, f.original_name, f.segmentation_status,
                sr.id as segmentation_id, sr.mask_path, sr.contour_path, sr.metadata
         FROM files f
         LEFT JOIN segmentation_results sr ON f.id = sr.file_id
         WHERE f.project_id = $1 AND f.user_id = $2
         ORDER BY f.created_at DESC`,
        [projectId, req.user?.id]
      );

      res.json(results);
    } catch (error) {
      next(error);
    }
  }
);

// Export handlers for testing
/**
 * Get segmentation status for a file
 */
mlRouter.get('/results/:fileId/status',
  authenticateJWT as any,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileId } = req.params;
      const result = await query(
        'SELECT segmentation_status FROM files WHERE id = $1 AND user_id = $2',
        [fileId, req.user?.id]
      );
      if (result.length === 0) {
        res.status(404).json({ error: 'File not found' });
        return;
      }
      res.json({ fileId, status: result[0].segmentation_status });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Internal endpoint for ML worker to report completion
 */
mlRouter.post('/internal/segmentation/complete',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const apiKey = req.headers['x-api-key'];
      if (apiKey !== config.security.internalApiKey) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const {
        fileId,
        success,
        maskPath,
        contourPath,
        metrics,
        errorMessage
      } = req.body;

      if (!fileId) {
        res.status(400).json({ error: 'Missing fileId' });
        return;
      }

      if (success) {
        const segmentationId = uuidv4();
        await query(
          `INSERT INTO segmentation_results (id, file_id, mask_path, contour_path, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            segmentationId,
            fileId,
            maskPath,
            contourPath,
            JSON.stringify(metrics || {})
          ]
        );

        await query(
          `UPDATE files SET segmentation_status = 'completed' WHERE id = $1`,
          [fileId]
        );
      } else {
        await query(
          `UPDATE files SET segmentation_status = 'failed' WHERE id = $1`,
          [fileId]
        );
      }

// ML worker callback endpoint
mlRouter.post('/ml/jobs/:jobId/callback', validateMLCallbackToken, mlCallbackHandler);

      res.json({ status: 'updated' });
    } catch (error) {
      next(error);
    }
  }
);

export { mlRouter };
