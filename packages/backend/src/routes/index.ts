/**
 * API Routes
 *
 * This file exports the main API router with versioning support.
 * Routes are organized by version for better API evolution.
 */

import express, { Router } from 'express';
import v1Routes from './v1';
import { getMetrics, getMetricsContentType } from '../monitoring/unified';

// Import legacy routes for backward compatibility
import authRoutes from './auth';
import userRoutes from './users';
import projectRoutes from './projects';
import imageRoutes from './images';
import segmentationRoutes from './segmentation';
import userStatsRoutes from './userStats';
import userProfileRoutes from './userProfile';
import projectSharesRoutes from './projectShares';
import metricsRoutes from './metricsRoutes';
import statusRoutes from './status';
import previewRoutes from './preview';
import logsRoutes from './logs';
import performanceRoutes from './performance';
import accessRequestsRoutes from './accessRequests';
import debugRoutes from './debug';
import adminRoutes from './admin';
import downloadRoutes from './download';
import metricsApiRoutes from './metrics';

// Create main router
const router: Router = express.Router();

// Version 1 routes (recommended)
router.use('/v1', v1Routes);

// Legacy routes (for backward compatibility)
// TODO: Deprecate these in favor of versioned routes
router.use('/auth', authRoutes);

// User-related routes
router.use('/users', userRoutes);
router.use('/user-stats', userStatsRoutes); // Changed to avoid path conflict
router.use('/user-profile', userProfileRoutes);

// Project-related routes
router.use('/projects', projectRoutes);
router.use('/projects', imageRoutes); // Images are nested under projects
router.use('/project-shares', projectSharesRoutes);

// Segmentation routes (single mounting point)
router.use('/segmentation', segmentationRoutes);
router.use('/segmentations', segmentationRoutes); // Alias for compatibility
router.use('/', segmentationRoutes); // Mount at root for /images/:id/segmentation compatibility

// Monitoring routes
router.use('/metrics', metricsRoutes); // Prometheus metrics
router.use('/metrics', metricsApiRoutes); // Our performance metrics API
router.use('/metrics/performance', performanceRoutes);

// Logs routes
router.use('/logs', logsRoutes);

// Status routes (for queue status)
router.use('/', statusRoutes);

// Preview routes (for TIFF/BMP preview generation)
router.use('/preview', previewRoutes);

// Download routes (for streaming downloads)
router.use('/download', downloadRoutes);

// Access requests routes
router.use('/access-requests', accessRequestsRoutes);

// Admin routes
router.use('/admin', adminRoutes);

// Debug routes (only in development)
if (process.env.NODE_ENV !== 'production') {
  router.use('/debug', debugRoutes);
}

// Add a default route for root
router.get('/', (req, res) => {
  res.status(200).json({
    name: 'SpheroSeg API',
    version: process.env.npm_package_version || '1.0.0',
    status: 'operational',
  });
});

export default router;

/**
 * Setup all routes for the Express application
 * @param app - Express application instance
 * @param io - Socket.IO server instance
 */
export const setupRoutes = (app: express.Application, io: any) => {
  // Mount the API router at /api
  app.use('/api', router);
};
