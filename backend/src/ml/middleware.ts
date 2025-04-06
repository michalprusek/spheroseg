import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { config } from '../config/app';

// Middleware to validate segmentation parameters
export const validateSegmentationParams = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { parameters } = req.body;

  // If no parameters provided, use defaults
  if (!parameters) {
    next();
    return;
  }

  // Validate threshold
  if (parameters.threshold !== undefined) {
    if (typeof parameters.threshold !== 'number') {
      res.status(400).json({ message: 'Invalid parameters: threshold must be a number' });
      return;
    }

    if (parameters.threshold < 0 || parameters.threshold > 1) {
      res.status(400).json({ message: 'Invalid parameters: threshold must be between 0 and 1' });
      return;
    }
  }

  // Validate minSize
  if (parameters.minSize !== undefined) {
    if (typeof parameters.minSize !== 'number') {
      res.status(400).json({ message: 'Invalid parameters: minSize must be a number' });
      return;
    }

    if (parameters.minSize < 0) {
      res.status(400).json({ message: 'Invalid parameters: minSize must be a positive number' });
      return;
    }
  }

  next();
};

// Middleware to check if ML service is available
export const checkMLServiceAvailability = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const mlServiceUrl = config.ml?.serviceUrl || 'http://ml-service:8000';
    await axios.get(`${mlServiceUrl}/health`);
    next();
  } catch (error) {
    res.status(503).json({
      error: 'ML service is not available',
      details: 'The machine learning service is currently unavailable. Please try again later.'
    });
  }
};

export function validateMLCallbackToken(req: Request, res: Response, next: NextFunction) {
  const expectedToken = process.env.ML_CALLBACK_TOKEN;
  if (!expectedToken) {
    return next(); // No token configured, allow
  }

  const token = req.headers['x-callback-token'] || req.query.token;

  if (token === expectedToken) {
    return next();
  }

  res.status(401).json({ error: 'Invalid callback token' });
  return;
}

