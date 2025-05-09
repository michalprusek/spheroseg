/**
 * API Routes
 *
 * This file exports the main API router with all routes registered.
 */

import express, { Router } from 'express';
import authRoutes from './auth';
import userRoutes from './users';
import projectRoutes from './projects';
import imageRoutes from './images';
import segmentationRoutes from './segmentation';
import statusRoute from './status';
import projectDuplicationRoutes from './projectDuplicationRoutes';
import testRoute from './test';

// Create main router
const router: Router = express.Router();

// Register routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/projects', projectRoutes);
router.use('/images', imageRoutes);
router.use('/segmentation', segmentationRoutes);
router.use('/status', statusRoute);
router.use('/duplication', projectDuplicationRoutes);
router.use('/test', testRoute);

// Add a default route for root
router.get('/', (req, res) => {
  res.status(200).json({
    name: 'SpheroSeg API',
    version: process.env.npm_package_version || '1.0.0',
    status: 'operational'
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