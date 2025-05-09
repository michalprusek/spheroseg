import express from 'express';
import http from 'http';
import config from './config';
import logger from './utils/logger';
import { setupRoutes } from './routes/index';
import { setupErrorHandler } from './middleware/errorHandler';
import { setupRequestLogger } from './middleware/requestLogger';
import securityMiddleware from './middleware/securityMiddleware';
import bodyParser from './middleware/bodyParser';
import validationMiddleware from './middleware/validationMiddleware';
import fileUtils from './utils/fileUtils';
import { corsMiddleware } from './middleware/corsMiddleware';
import taskQueueService from './services/taskQueueService';
import { setupSegmentationQueue } from './services/segmentationQueueService';
import { initializeSocketIO } from './socket';
import { setupDatabaseMonitoringComponents } from './server.monitoring.patch';

// Create Express app
const app = express();
const server = http.createServer(app);

// Setup Socket.IO server with authentication
const io = initializeSocketIO(server);

// Apply middleware
securityMiddleware(app);
app.use(corsMiddleware());  // Apply CORS middleware
bodyParser(app);
setupRequestLogger(app);
validationMiddleware(app);
fileUtils.setupUploadDirectories();

// Configure task queue
const taskQueue = taskQueueService.default({
  maxConcurrentTasks: config.server.maxConcurrentTasks || 2
});

// Setup segmentation queue
setupSegmentationQueue();

// Setup routes
setupRoutes(app, io);

// Apply error handler middleware
setupErrorHandler(app);

// Setup database monitoring components
setupDatabaseMonitoringComponents(app, io);

// Start server
const PORT = config.server.port || 5000;
const HOST = config.server.host || '0.0.0.0';

server.listen(PORT, HOST as any, () => {
  logger.info('Server started successfully', { 
    port: PORT, 
    host: HOST,
    environment: config.environment,
    socketIO: true,
    uploadDir: config.uploads?.path,
    segmentation: {
      maxConcurrentTasks: config.queue?.maxConcurrentTasks || 2,
      checkpointExists: true
    }
  });
});

// Handle process termination
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export { app, server, io };