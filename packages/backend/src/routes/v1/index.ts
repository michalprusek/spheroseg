/**
 * API v1 Routes
 * 
 * Version 1 of the API routes for better API versioning and future compatibility.
 */

import express, { Router } from 'express';
import authRoutes from '../auth';
import userRoutes from '../users';
import projectRoutes from '../projects';
import imageRoutes from '../images';
import segmentationRoutes from '../segmentation';
import statusRoute from '../status';
import projectDuplicationRoutes from '../projectDuplicationRoutes';
import testRoute from '../test';
import logsRoutes from '../logs';
import performanceRoutes from '../performance';
import userStatsRoutes from '../userStats';
import userProfileRoutes from '../userProfile';

// Create v1 router
const router: Router = express.Router();

// API versioning middleware
router.use((req, res, next) => {
  res.setHeader('API-Version', 'v1');
  next();
});

// Register v1 routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/users', userStatsRoutes);
router.use('/user-profile', userProfileRoutes);
router.use('/projects', projectRoutes);
router.use('/images', imageRoutes);
router.use('/segmentations', segmentationRoutes);
router.use('/status', statusRoute);
router.use('/project-duplication', projectDuplicationRoutes);
router.use('/test', testRoute);
router.use('/logs', logsRoutes);
router.use('/performance', performanceRoutes);

// Version info endpoint
router.get('/version', (req, res) => {
  res.json({
    success: true,
    version: 'v1',
    apiVersion: '1.0.0',
    deprecated: false,
    supportedUntil: null,
    timestamp: new Date().toISOString(),
  });
});

export default router;