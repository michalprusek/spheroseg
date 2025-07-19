/**
 * HTTP Server Initialization
 *
 * This module handles HTTP server creation, Socket.IO initialization,
 * and graceful shutdown. Separated from app.ts for better modularity.
 */

import http from 'http';
import { AddressInfo } from 'net';
import v8 from 'v8';
import { Pool } from 'pg';

import app from './app';
import config from './config';
import logger from './utils/logger';

// Import services
import socketService from './services/socketService';
import scheduledTaskService from './services/scheduledTaskService';
import segmentationQueueService from './services/segmentationQueueService';
import stuckImageCleanupService from './services/stuckImageCleanup';
import db, { getPool } from './db';
import { startPerformanceMonitoring } from './utils/performance';
import performanceConfig from './config/performance';
import performanceMonitor from './services/performanceMonitor';
import { initializeRedis, closeRedis } from './config/redis';

// Memory optimization settings
// Note: Manual garbage collection should be used sparingly as V8's GC is highly optimized
// Only enable in specific scenarios where memory usage patterns are well understood
const isProduction = process.env.NODE_ENV === 'production';
const manualGcEnabled = process.env.ENABLE_MANUAL_GC === 'true';

if (isProduction && manualGcEnabled) {
  logger.warn(
    'Manual GC is enabled in production! This should only be used for debugging specific memory issues.'
  );
}

if (global.gc && performanceConfig.memory.gcIntervalMs > 0 && manualGcEnabled && !isProduction) {
  logger.info(
    'Manual garbage collection enabled with interval:',
    performanceConfig.memory.gcIntervalMs
  );

  // Track GC performance
  let gcCount = 0;
  let totalGcTime = 0;

  setInterval(() => {
    if (global.gc) {
      const startTime = process.hrtime.bigint();
      const memBefore = process.memoryUsage();

      global.gc();

      const endTime = process.hrtime.bigint();
      const memAfter = process.memoryUsage();
      const gcTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds

      gcCount++;
      totalGcTime += gcTime;

      const freedMemory = (memBefore.heapUsed - memAfter.heapUsed) / 1024 / 1024;

      logger.debug('Manual GC completed', {
        gcNumber: gcCount,
        duration: `${gcTime.toFixed(2)}ms`,
        avgDuration: `${(totalGcTime / gcCount).toFixed(2)}ms`,
        freedMemory: `${freedMemory.toFixed(2)}MB`,
        heapUsed: `${(memAfter.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      });

      // Warn if GC is taking too long
      if (gcTime > 100) {
        logger.warn('Manual GC took longer than 100ms', { duration: gcTime });
      }
    }
  }, performanceConfig.memory.gcIntervalMs);
} else if (global.gc) {
  if (isProduction) {
    logger.info('Manual GC available but disabled in production');
  } else {
    logger.info(
      'Manual GC available but disabled. Enable with ENABLE_MANUAL_GC=true (development only)'
    );
  }
}

// Set memory limits for V8
v8.setFlagsFromString(`--max-old-space-size=${performanceConfig.memory.v8MaxOldSpaceMB}`);

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

    // Initialize segmentation queue service
    await segmentationQueueService.init();
    logger.info('Segmentation queue service initialized');

    // Initialize scheduled tasks
    scheduledTaskService.initialize(getPool());
    logger.info('Scheduled task service initialized');

    // Start stuck image cleanup service
    stuckImageCleanupService.start();
    logger.info('Stuck image cleanup service started');

    // Test database connection
    logger.info('Testing database connection...');
    try {
      // Create a simple pool without wrapper for testing
      const testPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 1,
      });

      logger.info('Created test pool');

      const result = await testPool.query('SELECT NOW()');
      logger.info('Database connection verified', { time: result.rows[0].now });

      await testPool.end();
      logger.info('Test pool closed');
    } catch (dbError) {
      logger.error('Database connection test failed', {
        error: dbError,
        message: (dbError as Error).message,
        stack: (dbError as Error).stack,
      });
      throw dbError;
    }

    // Start performance monitoring
    if (config.monitoring?.metricsEnabled) {
      startPerformanceMonitoring(60000); // Every minute
    }
  } catch (error: unknown) {
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
  } catch (error: unknown) {
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
        performanceMonitor.stop();
        logger.info('Performance monitoring stopped');

        stuckImageCleanupService.stop();
        logger.info('Stuck image cleanup service stopped');

        if (scheduledTaskService && typeof scheduledTaskService.shutdown === 'function') {
          await scheduledTaskService.shutdown();
          logger.info('Scheduled tasks stopped');
        }

        // Socket.IO will be closed when HTTP server closes
        logger.info('Socket.IO server will close with HTTP server');

        await db.closePool();
        logger.info('Database connections closed');

        clearTimeout(shutdownTimeout);
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error: unknown) {
        logger.error('Error during shutdown', { error: error?.message || error });
        clearTimeout(shutdownTimeout);
        process.exit(1);
      }
    });
  } catch (error: unknown) {
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
    stack: error.stack,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason,
    promise: promise,
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
