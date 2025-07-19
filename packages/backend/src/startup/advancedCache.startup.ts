/**
 * Advanced Cache Startup Module
 * 
 * Initializes cache warming and invalidation patterns on application startup
 */

import { Redis } from 'ioredis';
import { initializeCacheManager } from '../utils/advancedCacheManager';
import { CacheStrategyFactory } from '../utils/advancedCacheStrategies';
import logger from '../utils/logger';
import { pool } from '../db';

export async function initializeAdvancedCacheOnStartup(redisClient: Redis): Promise<void> {
  try {
    logger.info('Initializing advanced cache system...');
    
    // Initialize cache manager
    const cacheManager = initializeCacheManager(redisClient);
    const strategyFactory = new CacheStrategyFactory(cacheManager);
    
    // Register cache configurations
    
    // 1. User cache with automatic warming
    cacheManager.registerCache(
      {
        name: 'advanced_users',
        ttl: 3600, // 1 hour
        warmOnStartup: true,
        warmingInterval: 30, // Every 30 minutes
        invalidationPatterns: ['user:*'],
        compressionThreshold: 1024,
      },
      async () => {
        const result = await pool.query(`
          SELECT id, email, name, role, organization_id, created_at
          FROM users
          WHERE active = true
          AND last_login > NOW() - INTERVAL '7 days'
          ORDER BY last_login DESC
          LIMIT 1000
        `);
        
        const dataMap = new Map();
        for (const user of result.rows) {
          dataMap.set(user.id.toString(), user);
        }
        logger.info(`Warming cache with ${dataMap.size} active users`);
        return dataMap;
      }
    );
    
    // 2. Project statistics cache
    cacheManager.registerCache(
      {
        name: 'advanced_projectStats',
        ttl: 1800, // 30 minutes
        warmOnStartup: true,
        warmingInterval: 15, // Every 15 minutes
        invalidationPatterns: ['project:*', 'stats:*'],
        compressionThreshold: 2048,
      },
      async () => {
        const result = await pool.query(`
          WITH project_stats AS (
            SELECT 
              p.id,
              p.name,
              p.description,
              COUNT(DISTINCT i.id) as image_count,
              COUNT(DISTINCT c.id) as cell_count,
              COALESCE(SUM(i.file_size), 0) as total_size,
              COUNT(DISTINCT i.id) FILTER (WHERE i.segmentation_status = 'completed') as segmented_count,
              MAX(i.created_at) as last_upload,
              MIN(i.created_at) as first_upload
            FROM projects p
            LEFT JOIN images i ON i.project_id = p.id
            LEFT JOIN cells c ON c.image_id = i.id
            WHERE p.deleted_at IS NULL
            AND p.created_at > NOW() - INTERVAL '90 days'
            GROUP BY p.id, p.name, p.description
          )
          SELECT * FROM project_stats
          WHERE image_count > 0
          ORDER BY last_upload DESC
          LIMIT 500
        `);
        
        const dataMap = new Map();
        for (const stats of result.rows) {
          dataMap.set(stats.id.toString(), stats);
        }
        logger.info(`Warming cache with ${dataMap.size} project statistics`);
        return dataMap;
      }
    );
    
    // 3. Image metadata cache (no warming due to volume)
    cacheManager.registerCache({
      name: 'advanced_images',
      ttl: 7200, // 2 hours
      warmOnStartup: false,
      invalidationPatterns: ['image:*', 'project:*'],
      compressionThreshold: 2048,
      maxMemory: 100, // Limit to 100MB
    });
    
    // 4. Segmentation results cache
    cacheManager.registerCache({
      name: 'advanced_segmentation',
      ttl: 86400, // 24 hours
      warmOnStartup: false,
      invalidationPatterns: ['segmentation:*', 'image:*'],
      compressionThreshold: 5120,
      maxMemory: 200, // Limit to 200MB
    });
    
    // 5. Recent activity cache
    cacheManager.registerCache(
      {
        name: 'advanced_recentActivity',
        ttl: 600, // 10 minutes
        warmOnStartup: true,
        warmingInterval: 5, // Every 5 minutes
        invalidationPatterns: ['activity:*'],
      },
      async () => {
        const result = await pool.query(`
          WITH recent_uploads AS (
            SELECT 
              'upload' as type,
              i.id,
              i.project_id,
              i.filename,
              i.created_at,
              u.name as user_name,
              p.name as project_name
            FROM images i
            JOIN users u ON i.uploaded_by = u.id
            JOIN projects p ON i.project_id = p.id
            WHERE i.created_at > NOW() - INTERVAL '24 hours'
            ORDER BY i.created_at DESC
            LIMIT 50
          ),
          recent_segmentations AS (
            SELECT 
              'segmentation' as type,
              sr.id,
              sr.image_id as project_id,
              i.filename,
              sr.completed_at as created_at,
              'System' as user_name,
              p.name as project_name
            FROM segmentation_results sr
            JOIN images i ON sr.image_id = i.id
            JOIN projects p ON i.project_id = p.id
            WHERE sr.completed_at > NOW() - INTERVAL '24 hours'
            AND sr.status = 'completed'
            ORDER BY sr.completed_at DESC
            LIMIT 50
          )
          SELECT * FROM (
            SELECT * FROM recent_uploads
            UNION ALL
            SELECT * FROM recent_segmentations
          ) combined
          ORDER BY created_at DESC
          LIMIT 100
        `);
        
        const dataMap = new Map();
        dataMap.set('all', result.rows);
        logger.info(`Warming cache with ${result.rows.length} recent activities`);
        return dataMap;
      }
    );
    
    // 6. High-frequency query cache (user permissions, etc.)
    cacheManager.registerCache({
      name: 'advanced_permissions',
      ttl: 300, // 5 minutes
      warmOnStartup: false,
      invalidationPatterns: ['permission:*', 'user:*', 'role:*'],
      compressionThreshold: 512,
    });
    
    // 7. Cell features cache
    cacheManager.registerCache({
      name: 'advanced_cellFeatures',
      ttl: 43200, // 12 hours
      warmOnStartup: false,
      invalidationPatterns: ['cell:*', 'segmentation:*'],
      compressionThreshold: 4096,
      maxMemory: 150, // Limit to 150MB
    });
    
    // Setup invalidation handlers
    
    // User invalidation handler
    cacheManager.registerCache(
      {
        name: 'advanced_users',
        ttl: 3600,
        warmOnStartup: false,
      },
      undefined,
      async (pattern, keys) => {
        logger.info(`User cache invalidation triggered for pattern: ${pattern}, affecting ${keys.length} keys`);
        // Could trigger re-warming of specific users here
      }
    );
    
    // Warm caches on startup
    const warmingResults = await cacheManager.warmAllCaches();
    
    for (const result of warmingResults) {
      if (result.errors.length > 0) {
        logger.error(`Cache warming errors for ${result.cacheName}:`, result.errors);
      } else {
        logger.info(`Cache ${result.cacheName} warmed successfully with ${result.itemsWarmed} items in ${result.duration}ms`);
      }
    }
    
    // Setup graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('Stopping advanced cache system...');
      cacheManager.stopAll();
      strategyFactory.stopAll();
    });
    
    process.on('SIGINT', () => {
      logger.info('Stopping advanced cache system...');
      cacheManager.stopAll();
      strategyFactory.stopAll();
    });
    
    logger.info('Advanced cache system initialized successfully');
    
  } catch (error) {
    logger.error('Failed to initialize advanced cache system', { error });
    
    // In production, cache failures shouldn't prevent startup
    if (process.env['NODE_ENV'] === 'production') {
      logger.warn('Continuing without advanced cache system');
    } else {
      throw error;
    }
  }
}