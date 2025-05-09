import express, { Request, Response, Router } from 'express';
import logger from '../utils/logger';

const router: Router = express.Router();

/**
 * @route   GET /api/test
 * @desc    Basic test endpoint that doesn't require authentication
 * @access  Public
 */
router.get('/', (_req: Request, res: Response) => {
  logger.debug('Test endpoint called');
  res.status(200).json({
    status: "ok",
    message: "API is working"
  });
});

export default router;