import express, { Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { AuthenticatedRequest, authenticate as authMiddleware } from '../security/middleware/auth';
import { getPool } from '../db';
import logger from '../utils/logger';
import { ApiError } from '../utils/ApiError';
import { pipeline } from 'stream';
import { promisify } from 'util';
import archiver from 'archiver';

const router = express.Router();
const pipelineAsync = promisify(pipeline);

/**
 * GET /api/download/image/:imageId - Stream download of image file
 *
 * This endpoint provides streaming download for large image files,
 * reducing memory usage compared to loading entire file into memory.
 */
router.get(
  '/image/:imageId',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const { imageId } = req.params;

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    try {
      // First get the image to find its project
      const imageQuery = await getPool().query(
        'SELECT i.*, i.project_id FROM images i WHERE i.id = $1',
        [imageId]
      );

      if (imageQuery.rows.length === 0) {
        throw new ApiError('Image not found', 404);
      }

      const image = imageQuery.rows[0];
      const projectId = image.project_id;

      // Use projectService to check access (ownership or sharing)
      const projectService = await import('../services/projectService');
      const project = await projectService.getProjectById(getPool(), projectId, userId);
      
      if (!project) {
        throw new ApiError('Image not found or access denied', 404);
      }

      const filePath = image.storage_path;

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        logger.error('Image file not found on disk', { imageId, filePath });
        throw new ApiError('Image file not found', 404);
      }

      // Get file stats for size
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;

      // Set appropriate headers
      res.setHeader('Content-Type', image.mime_type || 'application/octet-stream');
      res.setHeader('Content-Length', fileSize.toString());
      res.setHeader('Content-Disposition', `attachment; filename="${image.filename}"`);

      // Enable partial content support for large files
      res.setHeader('Accept-Ranges', 'bytes');

      // Handle range requests for partial downloads
      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = end - start + 1;

        res.status(206); // Partial Content
        res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        res.setHeader('Content-Length', chunksize.toString());

        // Create read stream with range
        const stream = fs.createReadStream(filePath, { start, end });

        // Stream the file
        stream.on('error', (error) => {
          logger.error('Error streaming file', { imageId, error });
          if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to stream file' });
          }
        });

        stream.pipe(res);
      } else {
        // Stream entire file
        const stream = fs.createReadStream(filePath, {
          highWaterMark: 64 * 1024, // 64KB chunks
        });

        // Handle stream errors
        stream.on('error', (error) => {
          logger.error('Error streaming file', { imageId, error });
          if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to stream file' });
          }
        });

        // Stream the file
        stream.pipe(res);
      }

      // Log successful download
      stream.on('end', () => {
        logger.info('Image streamed successfully', {
          imageId,
          fileSize,
          userId,
        });
      });
    } catch (error) {
      logger.error('Error in download endpoint', { imageId, error });
      next(error);
    }
  }
);

/**
 * GET /api/download/project/:projectId/export - Stream download of project export
 *
 * This endpoint streams a ZIP file containing all project data
 */
router.get(
  '/project/:projectId/export',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const { projectId } = req.params;

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    try {
      // Use projectService to check access (ownership or sharing)
      const projectService = await import('../services/projectService');
      const project = await projectService.getProjectById(getPool(), projectId, userId);
      
      if (!project) {
        throw new ApiError('Project not found or access denied', 404);
      }

      // Use archiver for zip creation

      // Set headers for ZIP download
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${project.title}-export.zip"`);

      // Create archive
      const archive = archiver('zip', {
        zlib: { level: 6 }, // Compression level (0-9)
      });

      // Handle archive errors
      archive.on('error', (err: Error) => {
        logger.error('Archive creation error', { projectId, error: err });
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to create archive' });
        }
      });

      // Pipe archive data to response
      archive.pipe(res);

      // Get all images for the project
      const imagesResult = await getPool().query(
        'SELECT * FROM images WHERE project_id = $1 ORDER BY created_at',
        [projectId]
      );

      // Add project metadata
      const metadata = {
        project: project,
        exportDate: new Date().toISOString(),
        imageCount: imagesResult.rows.length,
      };

      archive.append(JSON.stringify(metadata, null, 2), { name: 'project-metadata.json' });

      // Stream each image file to the archive
      for (const image of imagesResult.rows) {
        if (fs.existsSync(image.storage_path)) {
          const stream = fs.createReadStream(image.storage_path);
          archive.append(stream, {
            name: `images/${image.filename}`,
            date: new Date(image.created_at),
          });
        }

        // Add image metadata
        archive.append(JSON.stringify(image, null, 2), {
          name: `metadata/${image.id}.json`,
        });
      }

      // Get segmentation results
      const segmentationResult = await getPool().query(
        `SELECT sr.*, i.filename 
         FROM segmentation_results sr
         JOIN images i ON sr.image_id = i.id
         WHERE i.project_id = $1`,
        [projectId]
      );

      // Add segmentation results
      if (segmentationResult.rows.length > 0) {
        archive.append(JSON.stringify(segmentationResult.rows, null, 2), {
          name: 'segmentation-results.json',
        });
      }

      // Finalize the archive
      await archive.finalize();

      logger.info('Project export streamed successfully', {
        projectId,
        imageCount: imagesResult.rows.length,
        userId,
      });
    } catch (error) {
      logger.error('Error in project export', { projectId, error });
      next(error);
    }
  }
);

export default router;
