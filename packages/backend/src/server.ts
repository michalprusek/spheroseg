/**
 * HTTP Server Initialization
 * 
 * This module handles HTTP server creation, Socket.IO initialization,
 * and graceful shutdown. Separated from app.ts for better modularity.
 */

import http from 'http';
import { AddressInfo } from 'net';

import app from './app';
import config from './config';
import logger from './utils/logger';

// Import services
import socketService from './services/socketService';
import scheduledTaskService from './services/scheduledTaskService';
import dbPool from './db';
import { startPerformanceMonitoring, stopPerformanceMonitoring } from './utils/performance';

/**
 * Create HTTP server
 */
const server = http.createServer(app);

/**
 * Initialize additional services
 */
const initializeServices = async (): Promise<void> => {
  try {
    // Initialize Socket.IO
    socketService.initializeSocketIO(server);
    logger.info('Socket.IO server initialized');

    // Initialize scheduled tasks
    scheduledTaskService.initialize(dbPool);
    logger.info('Scheduled task service initialized');

    // Test database connection
    await dbPool.query('SELECT NOW()');
    logger.info('Database connection verified');

    // Start performance monitoring
    if (config.monitoring?.metricsEnabled) {
      startPerformanceMonitoring(60000); // Every minute
    }

  } catch (error: any) {
    logger.error('Failed to initialize services', { error: error?.message || error });
    throw error;
  }
};

/**
 * Start the server
 */
const startServer = async (): Promise<void> => {
  try {
    // Initialize services first
    await initializeServices();

    // Start HTTP server
    const { port, host } = config.server;
    
    server.listen(port, host, () => {
      const address = server.address() as AddressInfo;
      const serverUrl = `http://${address.address}:${address.port}`;
      
      logger.info('Server started successfully', {
        port: address.port,
        host: address.address,
        environment: config.env,
        url: serverUrl,
        uploadDir: config.storage.uploadDir,
        processId: process.pid,
      });
      
      // Console output for development
      console.log(`🚀 Server running at ${serverUrl}`);
      console.log(`📁 Upload directory: ${config.storage.uploadDir}`);
      console.log(`🔧 Environment: ${config.env}`);
      console.log(`⏰ Scheduled tasks initialized`);
      console.log(`🔌 Socket.IO server ready`);
      console.log(`💾 Database connected`);
    });

  } catch (error: any) {
    logger.error('Failed to start server', { error: error?.message || error });
    process.exit(1);
  }
};

/**
 * Graceful shutdown handler
 */
const shutdown = async (signal: string): Promise<void> => {
  logger.info(`${signal} received, starting graceful shutdown`);
  
  const shutdownTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timeout, forcing exit');
    process.exit(1);
  }, 10000); // 10 second timeout

  try {
    // Stop accepting new connections
    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        // Shutdown services in reverse order
        if (scheduledTaskService && typeof scheduledTaskService.shutdown === 'function') {
          await scheduledTaskService.shutdown();
          logger.info('Scheduled tasks stopped');
        }

        // Socket.IO will be closed when HTTP server closes
        logger.info('Socket.IO server will close with HTTP server');

        if (dbPool && typeof dbPool.end === 'function') {
          await dbPool.end();
          logger.info('Database connections closed');
        }

        clearTimeout(shutdownTimeout);
        logger.info('Graceful shutdown completed');
        process.exit(0);

      } catch (error: any) {
        logger.error('Error during shutdown', { error: error?.message || error });
        clearTimeout(shutdownTimeout);
        process.exit(1);
      }
    });

  } catch (error: any) {
    logger.error('Error initiating shutdown', { error: error?.message || error });
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
};

/**
 * Error handlers
 */
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { 
    error: error.message, 
    stack: error.stack 
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { 
    reason: reason,
    promise: promise 
  });
  process.exit(1);
});

// Graceful shutdown signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start the server
if (require.main === module) {
  startServer().catch((error) => {
    logger.error('Failed to start application', { error: error.message });
    process.exit(1);
  });
}

// Export for testing
export { server, app };
export default server;