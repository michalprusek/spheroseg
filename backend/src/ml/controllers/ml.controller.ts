import { Request, Response } from 'express';
import { handleWorkerCallback } from '../services/ml.service';
import { asyncHandler } from '../../utils/asyncHandler';

export const mlCallbackHandler = asyncHandler(async (req: Request, res: Response) => {
  const { jobId } = req.params;
  const { success, payload } = req.body;

  if (typeof success !== 'boolean' || typeof payload !== 'object') {
    res.status(400).json({ error: 'Invalid callback payload' });
    return;
  }

  try {
    await handleWorkerCallback(req.app.get('db'), jobId, success, payload);
    res.status(200).json({ status: 'ok' });
  } catch (error: any) {
    if (error.name === 'ValidationError') {
      res.status(400).json({ error: error.message });
    } else if (error.name === 'NotFoundError') {
      res.status(404).json({ error: error.message });
    } else {
      console.error('Unexpected error in mlCallbackHandler:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Placeholder for ML-specific endpoints if needed
// export const startSegmentation = ...
// export const getSegmentationStatus = ...
// export const getSegmentationResult = ...