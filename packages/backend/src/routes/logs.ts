import express, { Request, Response, Router, NextFunction } from 'express';
import logger from '../utils/logger';
import authMiddleware, { AuthenticatedRequest } from '../middleware/authMiddleware';

const router: Router = express.Router();

/**
 * POST /api/logs - Log client-side messages
 * This endpoint allows the frontend to send logs to the server
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { level, levelName, message, data, timestamp } = req.body;
    
    // Log the message with the appropriate level
    switch (level) {
      case 0: // ERROR
        logger.error(`[Client] ${message}`, { clientData: data, timestamp });
        break;
      case 1: // WARN
        logger.warn(`[Client] ${message}`, { clientData: data, timestamp });
        break;
      case 2: // INFO
        logger.info(`[Client] ${message}`, { clientData: data, timestamp });
        break;
      case 3: // DEBUG
        logger.debug(`[Client] ${message}`, { clientData: data, timestamp });
        break;
      default:
        logger.info(`[Client] ${message}`, { clientData: data, timestamp, level: levelName });
    }
    
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error processing client log', { error });
    res.status(500).json({ success: false, message: 'Failed to process log' });
  }
});

export default router;
