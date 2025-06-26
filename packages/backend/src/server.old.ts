/**
 * Express Server
 * 
 * Main server file that initializes the Express application with all middleware and routes.
 */

import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import fs from 'fs';

// Import configuration
import config from './config';
import logger from './utils/logger';

// Import middleware
import { errorHandler } from './middleware/errorHandler';

// Import Socket.IO service
import socketService from './services/socketService';

// Import main API router
import apiRouter from './routes';

// Import database pool
import dbPool from './db';

// Import scheduled task service
import scheduledTaskService from './services/scheduledTaskService';

// Create Express application
const app = express();
const server = http.createServer(app);

// CORS middleware
app.use(cors({
  origin: config.server.corsOrigins,
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files middleware
const uploadsPath = path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsPath));

// Ensure upload directory exists
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
  logger.info(`Created upload directory: ${uploadsPath}`);
}

// Mount API routes
app.use('/api', apiRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Fallback for unknown routes
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    path: req.originalUrl,
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Initialize Socket.IO
socketService.initializeSocketIO(server);

// Initialize scheduled tasks
scheduledTaskService.initialize(dbPool);

// Start server
const { port, host } = config.server;

server.listen(port, host as any, () => {
  logger.info('Server started successfully', {
    port,
    host,
    environment: config.env,
    uploadDir: uploadsPath,
  });
  
  console.log(`🚀 Server running at http://${host}:${port}`);
  console.log(`📁 Upload directory: ${uploadsPath}`);
  console.log(`🔧 Environment: ${config.env}`);
  console.log(`⏰ Scheduled tasks initialized`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  scheduledTaskService.shutdown();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  scheduledTaskService.shutdown();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Export for testing
export { app, server };