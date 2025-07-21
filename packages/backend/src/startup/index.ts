/**
 * Centralized Startup Module
 * 
 * Orchestrates all startup initialization modules in the correct order
 */

import { Redis } from 'ioredis';
import logger from '../utils/logger';
import { initializeSecretRotationOnStartup } from './secretRotation.startup';
import { initializeAdvancedCacheOnStartup } from './advancedCache.startup';
import { initializeBusinessMetricsSystem } from './businessMetrics.startup';
import { initializePerformanceCoordinatorOnStartup } from './performanceCoordinator.startup';

export async function initializeAllStartupModules(redisClient: Redis | null): Promise<void> {
  logger.info('Initializing all startup modules...');
  
  const startTime = Date.now();
  const results: { module: string; success: boolean; error?: string }[] = [];
  
  // Initialize each module with error handling
  const modules = [
    {
      name: 'Secret Rotation',
      init: async () => {
        if (redisClient) {
          await initializeSecretRotationOnStartup(redisClient);
        } else {
          logger.warn('Skipping secret rotation initialization - Redis not available');
        }
      },
    },
    {
      name: 'Advanced Cache',
      init: async () => {
        if (redisClient) {
          await initializeAdvancedCacheOnStartup(redisClient);
        } else {
          logger.warn('Skipping advanced cache initialization - Redis not available');
        }
      },
    },
    {
      name: 'Business Metrics',
      init: async () => {
        if (redisClient) {
          await initializeBusinessMetricsSystem();
        } else {
          logger.warn('Skipping business metrics initialization - Redis not available');
        }
      },
    },
    {
      name: 'Performance Coordinator',
      init: async () => {
        if (redisClient) {
          await initializePerformanceCoordinatorOnStartup(redisClient);
        } else {
          logger.warn('Skipping performance coordinator initialization - Redis not available');
        }
      },
    },
  ];
  
  // Initialize modules sequentially to manage dependencies
  for (const module of modules) {
    try {
      logger.info(`Initializing ${module.name}...`);
      await module.init();
      results.push({ module: module.name, success: true });
      logger.info(`${module.name} initialized successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to initialize ${module.name}`, { error: errorMessage });
      results.push({ module: module.name, success: false, error: errorMessage });
      
      // Continue with other modules even if one fails
      // In production, you might want to fail fast for critical modules
      if (process.env['NODE_ENV'] === 'production' && module.name === 'Secret Rotation') {
        throw error;
      }
    }
  }
  
  const duration = Date.now() - startTime;
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;
  
  logger.info('Startup module initialization complete', {
    duration: `${duration}ms`,
    successCount,
    failureCount,
    results,
  });
  
  if (failureCount > 0 && process.env['NODE_ENV'] === 'production') {
    logger.warn(`${failureCount} startup modules failed to initialize`);
  }
}

export default {
  initializeAllStartupModules,
};