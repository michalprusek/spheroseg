/**
 * API Routes
 *
 * This file exports the main API router with versioning support.
 * Routes are organized by version for better API evolution.
 */

import express, { Router } from 'express';
import v1Routes from './v1';

// Import legacy routes for backward compatibility
import authRoutes from './auth';
import userRoutes from './users';
import projectRoutes from './projects';
import imageRoutes from './images';
import segmentationRoutes from './segmentation';
import statusRoute from './status';
import projectDuplicationRoutes from './projectDuplicationRoutes';
import testRoute from './test';
import logsRoutes from './logs';
import performanceRoutes from './performance';
import userStatsRoutes from './userStats';
import userProfileRoutes from './userProfile';
import projectSharesRoutes from './projectShares';
import previewRoutes from './preview';

// Create main router
const router: Router = express.Router();

// Version 1 routes (recommended)
router.use('/v1', v1Routes);

// Legacy routes (for backward compatibility)
// TODO: Deprecate these in favor of versioned routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/users', userStatsRoutes);
router.use('/user-profile', userProfileRoutes);
router.use('/projects', projectRoutes);
router.use('/projects', imageRoutes);  // Mount image routes under /projects for nested routes
router.use('/images', imageRoutes);     // Keep original mounting for backward compatibility
router.use('/project-shares', projectSharesRoutes);
router.use('/segmentation', segmentationRoutes);
router.use('/segmentations', segmentationRoutes); // Add plural variant for frontend compatibility
router.use('/', segmentationRoutes); // Mount at root level for routes like /projects/:id/segmentations/batch
router.use('/status', statusRoute);
router.use('/duplication', projectDuplicationRoutes);
router.use('/test', testRoute);
router.use('/logs', logsRoutes);
router.use('/metrics/performance', performanceRoutes);
router.use('/preview', previewRoutes);

// Add queue-status routes at root level for convenience
router.use('/queue-status', segmentationRoutes);

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
