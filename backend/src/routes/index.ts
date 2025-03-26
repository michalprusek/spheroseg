import { Express } from 'express';
import express from 'express';
import authRoutes from './authRoutes';
import userRoutes from './userRoutes';
import projectRoutes from './projectRoutes';
import imageRoutes from './imageRoutes';
import config from '../config/config';
import { notFoundHandler } from '../middleware/errorHandler';

/**
 * Set up all API routes
 */
export const setupRoutes = (app: Express) => {
  // API prefix
  const apiPrefix = config.apiPrefix;

  // Register routes
  app.use(`${apiPrefix}/auth`, authRoutes);
  app.use(`${apiPrefix}/users`, userRoutes);
  app.use(`${apiPrefix}/projects`, projectRoutes);
  app.use(`${apiPrefix}/images`, imageRoutes);

  // Static files for uploaded images
  app.use('/uploads', express.static(config.storage.uploadsFolder));

  // Health check route
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'success',
      message: 'Server is running',
      timestamp: new Date().toISOString()
    });
  });

  // Handle 404 for undefined routes
  app.use(notFoundHandler);
}; 