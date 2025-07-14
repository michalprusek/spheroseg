/**
 * Enhanced HTTP Server Initialization with Scalability Improvements
 *
 * This module handles HTTP server creation, Socket.IO initialization,
 * Bull queue setup, database pooling, and graceful shutdown.
 */

import http from 'http';
import { AddressInfo } from 'net';
import v8 from 'v8';

import app from './app';
import config from './config';
import logger from './utils/logger';

// Import new scalability services
import { DatabasePool } from './db/pool';
import { BullQueueService } from './services/bullQueueService';
import { MLServiceCircuitBreaker } from './services/circuitBreaker';
import { SegmentationWorker } from './workers/segmentationWorker';
import { createHealthCheckRouter } from './routes/healthCheck';

// Import existing services
import socketService from './services/socketService';
import scheduledTaskService from './services/scheduledTaskService';
import stuckImageCleanupService from './services/stuckImageCleanup';
import { startPerformanceMonitoring, stopPerformanceMonitoring } from './utils/performance';
import performanceConfig from './config/performance';
import performanceMonitor from './services/performanceMonitor';

// Global service instances
let dbPool: DatabasePool;
let queueService: BullQueueService;
let mlCircuitBreaker: MLServiceCircuitBreaker;
let segmentationWorker: SegmentationWorker;

// Memory optimization settings
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
 * Initialize scalability services
 */
const initializeScalabilityServices = async (): Promise<void> => {
  try {
    // Initialize database pool
    const databaseUrl = process.env.DATABASE_URL || config.database.url;
    dbPool = new DatabasePool(databaseUrl, {
      max: Number(process.env.DB_POOL_MAX) || 20,
      idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_TIMEOUT) || 30000,
      connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT) || 2000,
    });
    logger.info('Database connection pool initialized', {
      poolSize: dbPool.getPoolStats().total,
    });

    // Make dbPool available globally for legacy code
    (global as any).dbPool = dbPool;

    // Initialize Bull queue service
    const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
    queueService = new BullQueueService(redisUrl);
    logger.info('Bull queue service initialized');

    // Initialize ML service circuit breaker
    const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://ml:5002';
    mlCircuitBreaker = new MLServiceCircuitBreaker(mlServiceUrl, socketService, {
      timeout: Number(process.env.ML_SERVICE_TIMEOUT) || 300000,
      errorThresholdPercentage: Number(process.env.ML_ERROR_THRESHOLD) || 50,
      resetTimeout: Number(process.env.ML_RESET_TIMEOUT) || 60000,
    });
    logger.info('ML service circuit breaker initialized');

    // Initialize segmentation worker
    const workerConcurrency = Number(process.env.QUEUE_CONCURRENCY) || 5;
    segmentationWorker = new SegmentationWorker(
      queueService,
      dbPool,
      socketService,
      mlServiceUrl
    );
    segmentationWorker.start(workerConcurrency);
    logger.info('Segmentation worker started', { concurrency: workerConcurrency });

    // Add health check routes
    const healthRouter = createHealthCheckRouter(dbPool, queueService, redisUrl);
    app.use('/api/health', healthRouter);
    logger.info('Health check endpoints registered');

    // Make services available globally for routes
    (app as any).scalabilityServices = {
      dbPool,
      queueService,
      mlCircuitBreaker,
    };
  } catch (error) {
    logger.error('Failed to initialize scalability services', { error });
    throw error;
  }
};

/**
 * Initialize additional services
 */
const initializeServices = async (): Promise<void> => {
  try {
    // Initialize scalability services first
    await initializeScalabilityServices();

    // Initialize Socket.IO
    socketService.initializeSocketIO(server);
    logger.info('Socket.IO server initialized');

    // Initialize scheduled tasks with new db pool
    scheduledTaskService.initialize(dbPool);
    logger.info('Scheduled task service initialized');

    // Start stuck image cleanup service
    stuckImageCleanupService.start();
    logger.info('Stuck image cleanup service started');

    // Test database connection with new pool
    logger.info('Testing database connection...');
    try {
      const result = await dbPool.query('SELECT NOW()');
      logger.info('Database connection verified', { time: result.rows[0].now });
    } catch (dbError) {
      logger.error('Database connection test failed', { 
        error: dbError,
        message: (dbError as Error).message,
        stack: (dbError as Error).stack 
      });
      throw dbError;
    }

    // Start performance monitoring
    if (config.monitoring?.metricsEnabled) {
      startPerformanceMonitoring(60000); // Every minute
    }

    // Log queue metrics periodically
    setInterval(async () => {
      try {
        const metrics = await queueService.getQueueMetrics();
        logger.info('Queue metrics', metrics);
      } catch (error) {
        logger.error('Failed to get queue metrics', { error });
      }
    }, 60000); // Every minute

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
      console.log(`💾 Database pool connected`);
      console.log(`📨 Bull queue ready`);
      console.log(`🔄 ML circuit breaker active`);
      console.log(`👷 Segmentation workers: ${process.env.QUEUE_CONCURRENCY || 5}`);
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
  }, 30000); // 30 second timeout for queue processing

  try {
    // Stop accepting new connections
    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        // Shutdown services in reverse order
        performanceMonitor.stop();
        logger.info('Performance monitoring stopped');

        // Stop segmentation worker
        if (segmentationWorker) {
          await segmentationWorker.stop();
          logger.info('Segmentation worker stopped');
        }

        // Close ML circuit breaker
        if (mlCircuitBreaker) {
          mlCircuitBreaker.shutdown();
          logger.info('ML circuit breaker shut down');
        }

        // Close queue service
        if (queueService) {
          await queueService.close();
          logger.info('Queue service closed');
        }

        stuckImageCleanupService.stop();
        logger.info('Stuck image cleanup service stopped');

        if (scheduledTaskService && typeof scheduledTaskService.shutdown === 'function') {
          await scheduledTaskService.shutdown();
          logger.info('Scheduled tasks stopped');
        }

        // Socket.IO will be closed when HTTP server closes
        logger.info('Socket.IO server will close with HTTP server');

        // Close database pool
        if (dbPool) {
          await dbPool.end();
          logger.info('Database pool closed');
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
    stack: error.stack,
  });
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason,
    promise,
  });
});

/**
 * Signal handlers
 */
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

/**
 * Start the server
 */
startServer().catch((error) => {
  logger.error('Failed to start server', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

export { server, dbPool, queueService, mlCircuitBreaker };