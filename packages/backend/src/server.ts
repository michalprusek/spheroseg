/**
 * Development Server
 *
 * This file initializes and runs the Express server for development.
 */

import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';

// Import configuration
import config from './config';
import logger from './utils/logger';

// Import Socket.IO service
import socketService from './services/socketService';

// Import main API router
import mainApiRouter from './routes';

// Import routes needed for specific manual registration or legacy routes
import imageRoutes from './routes/images'; // Still needed for manual app.post('/api/projects/:projectId/images', ...) etc.
import segmentationRoutes from './routes/segmentation'; // Still needed for manual app.get('/api/segmentations/queue/status', ...) etc.
import userRoutes from './routes/users'; // Still needed for legacy app.use('/users', userRoutes)
import projectRoutes from './routes/projects'; // Still needed for legacy app.use('/projects', projectRoutes)
import performanceRoutes from './routes/performance'; // Still needed for legacy app.use('/metrics/performance', performanceRoutes)

// Create Express application
const app = express();
const server = http.createServer(app);

// Basic middleware
app.use(
  cors({
    origin: '*',
    credentials: true,
  }),
);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files - serve uploads directory with multiple paths
const uploadsPath = path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsPath));
app.use('/api/uploads', express.static(uploadsPath));
app.use('/public/uploads', express.static(uploadsPath));

// Create upload directory
const uploadDir = path.join(__dirname, '../uploads');
try {
  require('fs').mkdirSync(uploadDir, { recursive: true });
  logger.info(`Created upload directory: ${uploadDir}`);
} catch (error) {
  logger.error(`Error creating upload directory: ${error}`);
}

// Register main API router
app.use('/api', mainApiRouter);

// Add GET routes for project images
app.get('/api/projects/:projectId/images', (req, res, next) => {
  req.url = `/projects/${req.params.projectId}/images`;
  imageRoutes(req, res, next);
});

app.get('/api/projects/:projectId/images/:imageId', (req, res, next) => {
  req.url = `/projects/${req.params.projectId}/images/${req.params.imageId}`;
  imageRoutes(req, res, next);
});

// Add GET routes for segmentation data
app.get('/api/segmentations/:imageId', (req, res, next) => {
  req.url = `/images/${req.params.imageId}/segmentation`;
  segmentationRoutes(req, res, next);
});

app.get('/api/projects/:projectId/segmentations/:imageId', (req, res, next) => {
  req.url = `/projects/${req.params.projectId}/segmentations/${req.params.imageId}`;
  segmentationRoutes(req, res, next);
});

// Add special 'any' project route for getting segmentation data when project ID is unknown
app.get('/api/projects/any/images/:imageId/segmentation', (req, res, next) => {
  req.url = `/images/${req.params.imageId}/segmentation`;
  segmentationRoutes(req, res, next);
});

// Specific manual route registrations that might need more complex logic or rewrites
// Register projects/:projectId/images endpoint
app.post('/api/projects/:projectId/images', (req, res, next) => {
  req.url = `/projects/${req.params.projectId}/images`;
  imageRoutes(req, res, next);
});

// Register projects/:projectId/images/batch endpoint
app.post('/api/projects/:projectId/images/batch', (req, res, next) => {
  req.url = `/projects/${req.params.projectId}/images/batch`;
  imageRoutes(req, res, next);
});

// Register images endpoint
app.post('/api/images', (req, res, next) => {
  req.url = '/images';
  imageRoutes(req, res, next);
});

// Register segmentations/queue/status endpoint
app.get('/api/segmentations/queue/status', (req, res, next) => {
  req.url = '/queue-status';
  segmentationRoutes(req, res, next);
});

// Register segmentations/queue/status/:projectId endpoint
app.get('/api/segmentations/queue/status/:projectId', (req, res, next) => {
  req.url = `/queue-status/${req.params.projectId}`;
  segmentationRoutes(req, res, next);
});

// Register segmentations/batch endpoint
app.post('/api/segmentations/batch', (req, res, next) => {
  req.url = '/images/segmentation/trigger-batch';
  segmentationRoutes(req, res, next);
});

// Register projects/:projectId/segmentations/batch endpoint
app.post('/api/projects/:projectId/segmentations/batch', (req, res, next) => {
  req.url = `/projects/${req.params.projectId}/segmentation/batch-trigger`;
  segmentationRoutes(req, res, next);
});

// Register images/:imageId/segmentation endpoint
app.post('/api/images/:imageId/segmentation', (req, res, next) => {
  req.url = `/images/${req.params.imageId}/segmentation`;
  segmentationRoutes(req, res, next);
});

// Register images/:imageId/segmentation endpoint (GET)
app.get('/api/images/:imageId/segmentation', (req, res, next) => {
  req.url = `/images/${req.params.imageId}/segmentation`;
  segmentationRoutes(req, res, next);
});

// Register images/:imageId/segmentation endpoint (PUT)
app.put('/api/images/:imageId/segmentation', (req, res, next) => {
  req.url = `/images/${req.params.imageId}/segmentation`;
  segmentationRoutes(req, res, next);
});

// Register projects/:projectId/images/:imageId/segmentation endpoint (PUT)
app.put('/api/projects/:projectId/images/:imageId/segmentation', (req, res, next) => {
  req.url = `/projects/${req.params.projectId}/images/${req.params.imageId}/segmentation`;
  segmentationRoutes(req, res, next);
});

// Register DELETE endpoints for images
app.delete('/api/projects/:projectId/images/:imageId', (req, res, next) => {
  req.url = `/projects/${req.params.projectId}/images/${req.params.imageId}`;
  imageRoutes(req, res, next);
});

app.delete('/api/images/:id', (req, res, next) => {
  req.url = `/images/${req.params.id}`;
  imageRoutes(req, res, next);
});

app.delete('/api/images/:imageId/segmentation', (req, res, next) => {
  req.url = `/images/${req.params.imageId}/segmentation`;
  segmentationRoutes(req, res, next);
});

// Legacy queue-status endpoints for backward compatibility
app.get('/api/queue-status', (req, res, next) => {
  req.url = '/queue-status';
  segmentationRoutes(req, res, next);
});

app.get('/api/queue-status/:projectId', (req, res, next) => {
  req.url = `/queue-status/${req.params.projectId}`;
  segmentationRoutes(req, res, next);
});

// Legacy routes without /api prefix for backward compatibility
app.use('/users', userRoutes);
app.use('/projects', projectRoutes);
app.use('/metrics/performance', performanceRoutes);
app.use('/segmentation', segmentationRoutes);
app.use('/images', imageRoutes);

// Fallback for unknown routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Server error', { error: err });
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = config.server.port || 5001;
const HOST = config.server.host || '0.0.0.0';

// Initialize Socket.IO server
socketService.initializeSocketIO(server);

server.listen(PORT, HOST as any, () => {
  logger.info('Server started successfully', {
    port: PORT,
    host: HOST,
    version: '1.0.0',
    environment: 'development',
    uploadDir: path.join(__dirname, '../uploads'),
  });

  console.log(`Server running at http://${HOST}:${PORT}`);
});

// Handle process termination
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down server');
  server.close(() => {
    logger.info('Server terminated');
    process.exit(0);
  });
});

// Export Express app and HTTP server
export { app, server };
