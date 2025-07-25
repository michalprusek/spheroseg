/**
 * Segmentation Controller
 * Handles segmentation-related API endpoints
 */
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../security/middleware/auth';
import * as segmentationService from '../services/segmentationService';
import * as segmentationQueueService from '../services/segmentationQueueService';
import { ApiError } from '../utils/errors';

/**
 * Get segmentation for an image
 * @route GET /api/images/:imageId/segmentation
 */
export const getSegmentation = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const imageId = req.params.imageId;

    if (!imageId) {
      throw new ApiError('Image ID is required', 400);
    }

    const segmentation = await segmentationService.getSegmentation(imageId);
    res.status(200).json(segmentation);
  } catch (error) {
    next(error);
  }
};

/**
 * Save segmentation data for an image
 * @route PUT /api/images/:imageId/segmentation
 */
export const saveSegmentation = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const imageId = req.params.imageId;
    const { polygons } = req.body;

    if (!imageId) {
      throw new ApiError('Image ID is required', 400);
    }

    if (!polygons) {
      throw new ApiError('Segmentation data is required', 400);
    }

    const userId = req.user?.userId || '';
    const result = await segmentationService.saveSegmentation(imageId, userId, polygons);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Run auto-segmentation on an image
 * @route POST /api/images/:imageId/auto-segmentation
 */
export const runAutoSegmentation = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const imageId = req.params.imageId;
    const { options } = req.body;

    if (!imageId) {
      throw new ApiError('Image ID is required', 400);
    }

    const job = await segmentationQueueService.queueSegmentationJob(imageId, options || {});
    res.status(202).json(job);
  } catch (error) {
    next(error);
  }
};

/**
 * Get segmentation job status
 * @route GET /api/segmentation/jobs/:jobId
 */
export const getSegmentationStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const jobId = req.params.jobId;

    if (!jobId) {
      throw new ApiError('Job ID is required', 400);
    }

    const status = await segmentationQueueService.getJobStatus(jobId);
    res.status(200).json(status);
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel segmentation job
 * @route DELETE /api/segmentation/jobs/:jobId
 */
export const cancelSegmentation = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const jobId = req.params.jobId;

    if (!jobId) {
      throw new ApiError('Job ID is required', 400);
    }

    const result = await segmentationQueueService.cancelJob(jobId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get segmentation version history
 * @route GET /api/images/:imageId/segmentation/history
 */
export const getSegmentationHistory = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const imageId = req.params.imageId;

    if (!imageId) {
      throw new ApiError('Image ID is required', 400);
    }

    const history = await segmentationService.getSegmentationHistory(imageId);
    res.status(200).json(history);
  } catch (error) {
    next(error);
  }
};

/**
 * Get specific segmentation version
 * @route GET /api/images/:imageId/segmentation/versions/:version
 */
export const getSegmentationVersion = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const imageId = req.params.imageId;
    const versionStr = req.params.version;

    if (!imageId) {
      throw new ApiError('Image ID is required', 400);
    }

    if (!versionStr) {
      throw new ApiError('Version is required', 400);
    }

    const version = parseInt(versionStr, 10);
    if (isNaN(version) || version <= 0) {
      throw new ApiError('Invalid version number', 400);
    }

    const versionData = await segmentationService.getSegmentationVersion(imageId, version);
    res.status(200).json(versionData);
  } catch (error) {
    next(error);
  }
};

/**
 * Restore previous segmentation version
 * @route POST /api/images/:imageId/segmentation/versions/:version/restore
 */
export const restoreSegmentationVersion = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const imageId = req.params.imageId;
    const versionStr = req.params.version;

    if (!imageId) {
      throw new ApiError('Image ID is required', 400);
    }

    if (!versionStr) {
      throw new ApiError('Version is required', 400);
    }

    const version = parseInt(versionStr, 10);
    if (isNaN(version) || version <= 0) {
      throw new ApiError('Invalid version number', 400);
    }

    const result = await segmentationService.restoreSegmentationVersion(
      imageId,
      req.user?.userId || '',
      version
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
