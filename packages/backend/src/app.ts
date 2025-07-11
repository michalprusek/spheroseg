/**
 * Express Application Configuration
 *
 * This module configures the Express application with all middleware and routes.
 * Separated from server.ts for better testing and modularity.
 */

import express, { Application } from 'express';
import { configureMiddleware, configureErrorMiddleware } from './middleware';
import apiRouter from './routes';
import config from './config';
import logger from './utils/logger';
import { performHealthCheck } from './utils/healthCheck';
// TODO: Fix i18n import - temporarily disabled
// import i18next from './config/i18n';

/**
 * Create and configure Express application
 */
export const createApp = (): Application => {
  const app = express();

  // Enable trust proxy for proper IP detection behind nginx/docker
  app.set('trust proxy', true);

  // CRITICAL: Add body parser FIRST before any other middleware
  // This ensures the body is parsed before security checks
  app.use(
    express.json({
      limit: '10mb',
      verify: (req: express.Request, res: express.Response, buf: Buffer) => {
        // Store raw body for debugging
        (req as any).rawBody = buf;
      },
    })
  );
  app.use(
    express.urlencoded({
      extended: true,
      limit: '10mb',
    })
  );

  // Configure all middleware in the correct order
  configureMiddleware(app);

  // Health check endpoint (before API routes)
  app.get('/health', async (req, res) => {
    try {
      const health = await performHealthCheck();
      const statusCode =
        health.overall === 'healthy' ? 200 : health.overall === 'degraded' ? 200 : 503;

      res.status(statusCode).json({
        success: health.overall !== 'unhealthy',
        ...health,
      });
    } catch (error) {
      logger.error('Health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(503).json({
        success: false,
        overall: 'unhealthy',
        error: 'Health check failed',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // API routes
  app.use('/api', apiRouter);

  // Configure error handling middleware (must be after routes)
  configureErrorMiddleware(app);

  logger.info('Express application configured successfully', {
    environment: config.env,
    corsOrigins: config.server.corsOrigins,
  });

  return app;
};

// Export configured app instance
export default createApp();
