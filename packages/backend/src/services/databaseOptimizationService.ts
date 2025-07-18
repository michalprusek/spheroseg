/**
 * Database Optimization Service
 *
 * Comprehensive database optimization combining query optimization,
 * intelligent caching, connection pooling, and performance monitoring
 */

import { Pool } from 'pg';
import logger from '../utils/logger';
import OptimizedQueryService from './optimizedQueryService';
import AdvancedCacheService from './advancedCacheService';

interface OptimizationConfig {
  enableQueryCache: boolean;
  enablePreparedStatements: boolean;
  enableConnectionPooling: boolean;
  maxConnections: number;
  queryTimeout: number;
  cacheStrategy: 'aggressive' | 'moderate' | 'conservative';
  monitoringEnabled: boolean;
}

interface PerformanceProfile {
  averageQueryTime: number;
  slowQueryCount: number;
  cacheHitRate: number;
  connectionPoolUtilization: number;
  recommendedOptimizations: string[];
}

interface DatabaseHealth {
  connectionPool: {
    total: number;
    idle: number;
    waiting: number;
  };
  performance: {
    averageQueryTime: number;
    slowQueries: number;
    totalQueries: number;
  };
  cache: {
    hitRate: number;
    memoryUsage: number;
    size: number;
  };
  recommendations: string[];
}

class DatabaseOptimizationService {
  private queryService: OptimizedQueryService;
  private cacheService: AdvancedCacheService;
  private config: OptimizationConfig;
  private healthChecks: DatabaseHealth[] = [];
  private monitoringInterval: NodeJS.Timer;

  constructor(
    private pool: Pool,
    config: Partial<OptimizationConfig> = {}
  ) {
    this.config = {
      enableQueryCache: true,
      enablePreparedStatements: true,
      enableConnectionPooling: true,
      maxConnections: 20,
      queryTimeout: 30000,
      cacheStrategy: 'moderate',
      monitoringEnabled: true,
      ...config,
    };

    this.queryService = new OptimizedQueryService(pool);
    this.cacheService = new AdvancedCacheService(pool);

    if (this.config.monitoringEnabled) {
      this.startHealthMonitoring();
    }
  }

  /**
   * Optimized user statistics query with multi-layer caching
   */
  async getUserStatsOptimized(userId: string): Promise<any> {
    const cacheKey = `user_stats_v2:${userId}`;

    try {
      // Try to get from cache first
      const cached = await this.cacheService.get(
        cacheKey,
        'HOT', // User stats are frequently accessed
        async () => {
          // If not in cache, execute optimized database query
          const query = `
            WITH date_ranges AS (
              SELECT 
                date_trunc('month', CURRENT_DATE) AS current_month_start,
                date_trunc('month', CURRENT_DATE - INTERVAL '1 month') AS last_month_start
            ),
            user_projects AS (
              SELECT 
                p.id,
                p.title,
                p.description,
                p.created_at,
                p.updated_at,
                COUNT(DISTINCT i.id) AS image_count,
                COUNT(DISTINCT CASE WHEN i.segmentation_status = 'completed' THEN i.id END) AS completed_count,
                COALESCE(SUM(i.file_size), 0) AS total_size
              FROM projects p
              LEFT JOIN images i ON p.id = i.project_id
              WHERE p.user_id = $1
              GROUP BY p.id, p.title, p.description, p.created_at, p.updated_at
            ),
            stats_summary AS (
              SELECT 
                COUNT(DISTINCT p.id) AS total_projects,
                COUNT(DISTINCT i.id) AS total_images,
                COUNT(DISTINCT CASE WHEN i.segmentation_status = 'completed' THEN i.id END) AS completed_segmentations,
                COUNT(DISTINCT CASE WHEN i.segmentation_status = 'processing' THEN i.id END) AS processing_images,
                COUNT(DISTINCT CASE WHEN i.segmentation_status = 'queued' THEN i.id END) AS queued_images,
                COALESCE(SUM(i.file_size), 0) AS storage_used_bytes,
                COUNT(DISTINCT CASE WHEN p.created_at >= dr.current_month_start THEN p.id END) AS projects_this_month,
                COUNT(DISTINCT CASE WHEN p.created_at >= dr.last_month_start AND p.created_at < dr.current_month_start THEN p.id END) AS projects_last_month,
                COUNT(DISTINCT CASE WHEN i.created_at >= dr.current_month_start THEN i.id END) AS images_this_month,
                COUNT(DISTINCT CASE WHEN i.created_at >= dr.last_month_start AND i.created_at < dr.current_month_start THEN i.id END) AS images_last_month
              FROM projects p
              LEFT JOIN images i ON p.id = i.project_id
              CROSS JOIN date_ranges dr
              WHERE p.user_id = $1
            ),
            recent_projects AS (
              SELECT * FROM user_projects
              ORDER BY updated_at DESC
              LIMIT 5
            ),
            recent_activity AS (
              SELECT 
                'project_created' as type,
                p.title as item_name,
                p.id as item_id,
                p.created_at as timestamp,
                p.title as project_name,
                p.id as project_id
              FROM projects p
              WHERE p.user_id = $1
              AND p.created_at > NOW() - INTERVAL '30 days'
              
              UNION ALL
              
              SELECT 
                'image_uploaded' as type,
                i.name as item_name,
                i.id as item_id,
                i.created_at as timestamp,
                p.title as project_name,
                p.id as project_id
              FROM images i
              JOIN projects p ON i.project_id = p.id
              WHERE p.user_id = $1
              AND i.created_at > NOW() - INTERVAL '30 days'
              
              UNION ALL
              
              SELECT 
                'segmentation_completed' as type,
                i.name as item_name,
                i.id as item_id,
                i.updated_at as timestamp,
                p.title as project_name,
                p.id as project_id
              FROM images i
              JOIN projects p ON i.project_id = p.id
              WHERE p.user_id = $1
              AND i.segmentation_status = 'completed'
              AND i.updated_at > NOW() - INTERVAL '30 days'
              ORDER BY timestamp DESC
              LIMIT 20
            )
            SELECT 
              (SELECT row_to_json(stats_summary.*) FROM stats_summary) AS stats,
              (SELECT json_agg(row_to_json(recent_projects.*)) FROM recent_projects) AS recent_projects,
              (SELECT json_agg(row_to_json(recent_activity.*)) FROM recent_activity) AS recent_activity
          `;

          const result = await this.queryService.query(query, [userId], {
            useCache: false, // We're handling caching at a higher level
            usePreparedStatement: true,
            cacheStrategy: 'HOT',
          });

          if (result.rows.length === 0) {
            return null;
          }

          const { stats, recent_projects, recent_activity } = result.rows[0];

          return {
            ...stats,
            recentProjects: recent_projects || [],
            recentActivity: recent_activity || [],
            lastUpdated: new Date().toISOString(),
          };
        }
      );

      return cached;
    } catch (error) {
      logger.error('Error fetching optimized user stats', { userId, error });
      throw error;
    }
  }

  /**
   * Optimized project list query with intelligent pagination
   */
  async getProjectListOptimized(
    userId: string,
    page: number = 1,
    limit: number = 20,
    filters: any = {}
  ): Promise<any> {
    const offset = (page - 1) * limit;
    const cacheKey = `project_list:${userId}:${page}:${limit}:${JSON.stringify(filters)}`;

    try {
      return await this.cacheService.get(cacheKey, 'WARM', async () => {
        let whereClause = 'WHERE p.user_id = $1';
        let paramIndex = 2;
        const params = [userId];

        // Add filters
        if (filters.search) {
          whereClause += ` AND (p.title ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`;
          params.push(`%${filters.search}%`);
          paramIndex++;
        }

        if (filters.status) {
          whereClause += ` AND p.status = $${paramIndex}`;
          params.push(filters.status);
          paramIndex++;
        }

        if (filters.dateFrom) {
          whereClause += ` AND p.created_at >= $${paramIndex}`;
          params.push(filters.dateFrom);
          paramIndex++;
        }

        if (filters.dateTo) {
          whereClause += ` AND p.created_at <= $${paramIndex}`;
          params.push(filters.dateTo);
          paramIndex++;
        }

        const query = `
            WITH project_stats AS (
              SELECT 
                p.*,
                COUNT(DISTINCT i.id) AS image_count,
                COUNT(DISTINCT CASE WHEN i.segmentation_status = 'completed' THEN i.id END) AS completed_count,
                COUNT(DISTINCT CASE WHEN i.segmentation_status = 'processing' THEN i.id END) AS processing_count,
                COUNT(DISTINCT CASE WHEN i.segmentation_status = 'queued' THEN i.id END) AS queued_count,
                COALESCE(SUM(i.file_size), 0) AS total_size,
                MAX(i.updated_at) AS last_activity
              FROM projects p
              LEFT JOIN images i ON p.id = i.project_id
              ${whereClause}
              GROUP BY p.id
            ),
            paginated_projects AS (
              SELECT *
              FROM project_stats
              ORDER BY last_activity DESC NULLS LAST, created_at DESC
              LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
            ),
            total_count AS (
              SELECT COUNT(*) as total
              FROM projects p
              ${whereClause}
            )
            SELECT 
              (SELECT json_agg(row_to_json(paginated_projects.*)) FROM paginated_projects) AS projects,
              (SELECT total FROM total_count) AS total
          `;

        params.push(limit, offset);

        const result = await this.queryService.query(query, params, {
          usePreparedStatement: true,
          cacheStrategy: 'WARM',
        });

        return {
          projects: result.rows[0].projects || [],
          total: parseInt(result.rows[0].total || 0),
          page,
          limit,
          totalPages: Math.ceil((result.rows[0].total || 0) / limit),
        };
      });
    } catch (error) {
      logger.error('Error fetching optimized project list', { userId, page, limit, error });
      throw error;
    }
  }

  /**
   * Optimized image list query with lazy loading support
   */
  async getImageListOptimized(
    projectId: string,
    page: number = 1,
    limit: number = 50,
    includeThumbnails: boolean = false
  ): Promise<any> {
    const offset = (page - 1) * limit;
    const cacheKey = `image_list:${projectId}:${page}:${limit}:${includeThumbnails}`;

    try {
      return await this.cacheService.get(cacheKey, 'WARM', async () => {
        const thumbnailSelect = includeThumbnails
          ? ', i.thumbnail_storage_path, i.thumbnail_url'
          : '';

        const query = `
            WITH image_stats AS (
              SELECT 
                i.*${thumbnailSelect},
                CASE 
                  WHEN sr.id IS NOT NULL THEN json_build_object(
                    'id', sr.id,
                    'status', sr.status,
                    'polygon_count', sr.polygon_count,
                    'created_at', sr.created_at
                  )
                  ELSE NULL
                END as segmentation_result
              FROM images i
              LEFT JOIN segmentation_results sr ON i.id = sr.image_id
              WHERE i.project_id = $1
            ),
            paginated_images AS (
              SELECT *
              FROM image_stats
              ORDER BY created_at DESC
              LIMIT $2 OFFSET $3
            ),
            total_count AS (
              SELECT COUNT(*) as total
              FROM images
              WHERE project_id = $1
            )
            SELECT 
              (SELECT json_agg(row_to_json(paginated_images.*)) FROM paginated_images) AS images,
              (SELECT total FROM total_count) AS total
          `;

        const result = await this.queryService.query(query, [projectId, limit, offset], {
          usePreparedStatement: true,
          cacheStrategy: 'WARM',
        });

        return {
          images: result.rows[0].images || [],
          total: parseInt(result.rows[0].total || 0),
          page,
          limit,
          hasMore: offset + limit < parseInt(result.rows[0].total || 0),
        };
      });
    } catch (error) {
      logger.error('Error fetching optimized image list', { projectId, page, limit, error });
      throw error;
    }
  }

  /**
   * Invalidate related caches when data changes
   */
  async invalidateRelatedCaches(type: 'user' | 'project' | 'image', id: string): Promise<void> {
    try {
      switch (type) {
        case 'user': {
          await this.cacheService.invalidatePattern(`user_stats*:${id}*`);
          await this.cacheService.invalidatePattern(`project_list:${id}*`);
          break;
        }

        case 'project': {
          await this.cacheService.invalidatePattern(`image_list:${id}*`);
          await this.cacheService.invalidatePattern(`project_stats:${id}*`);
          // Also invalidate user stats for project owner
          const projectOwnerQuery = 'SELECT user_id FROM projects WHERE id = $1';
          const result = await this.queryService.query(projectOwnerQuery, [id]);
          if (result.rows.length > 0) {
            const userId = result.rows[0].user_id;
            await this.cacheService.invalidatePattern(`user_stats*:${userId}*`);
            await this.cacheService.invalidatePattern(`project_list:${userId}*`);
          }
          break;
        }

        case 'image': {
          // Invalidate project and user caches
          const imageProjectQuery = `
            SELECT p.id as project_id, p.user_id 
            FROM images i 
            JOIN projects p ON i.project_id = p.id 
            WHERE i.id = $1
          `;
          const imageResult = await this.queryService.query(imageProjectQuery, [id]);
          if (imageResult.rows.length > 0) {
            const { project_id, user_id } = imageResult.rows[0];
            await this.cacheService.invalidatePattern(`image_list:${project_id}*`);
            await this.cacheService.invalidatePattern(`user_stats*:${user_id}*`);
          }
          break;
        }
      }
    } catch (error) {
      logger.error('Error invalidating related caches', { type, id, error });
    }
  }

  /**
   * Generate performance profile and recommendations
   */
  async generatePerformanceProfile(): Promise<PerformanceProfile> {
    const metrics = this.queryService.getMetrics();
    const cacheMetrics = this.cacheService.getMetrics();

    const recommendations: string[] = [];

    // Analyze query performance
    if (metrics.averageTime > 500) {
      recommendations.push('Consider adding database indexes for frequently used columns');
    }

    if (metrics.slowQueries > 10) {
      recommendations.push('Review and optimize slow queries');
    }

    // Analyze cache performance
    if (cacheMetrics.hitRate < 70) {
      recommendations.push('Increase cache TTL for stable data');
      recommendations.push('Consider warming up frequently accessed data');
    }

    if (cacheMetrics.memoryUsage > 100 * 1024 * 1024) {
      // 100MB
      recommendations.push('Consider reducing memory cache size or implementing LRU eviction');
    }

    // Analyze connection pool
    const poolUtilization = (this.pool.totalCount / this.config.maxConnections) * 100;
    if (poolUtilization > 80) {
      recommendations.push('Consider increasing connection pool size');
    }

    return {
      averageQueryTime: metrics.averageTime,
      slowQueryCount: metrics.slowQueries,
      cacheHitRate: cacheMetrics.hitRate,
      connectionPoolUtilization: poolUtilization,
      recommendedOptimizations: recommendations,
    };
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      try {
        const health = await this.checkDatabaseHealth();
        this.healthChecks.push(health);

        // Keep only last 24 hours of health checks (assuming 5-minute intervals)
        if (this.healthChecks.length > 288) {
          this.healthChecks.shift();
        }

        // Log critical issues
        if (health.recommendations.length > 0) {
          logger.warn('Database optimization recommendations', {
            recommendations: health.recommendations,
          });
        }
      } catch (error) {
        logger.error('Health monitoring error', { error });
      }
    }, 300000); // Every 5 minutes
  }

  /**
   * Check database health
   */
  async checkDatabaseHealth(): Promise<DatabaseHealth> {
    const queryMetrics = this.queryService.getMetrics();
    const cacheMetrics = this.cacheService.getMetrics();

    const recommendations: string[] = [];

    // Check connection pool health
    const poolHealth = {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };

    if (poolHealth.waiting > 5) {
      recommendations.push('High connection pool wait time detected');
    }

    // Check performance health
    if (queryMetrics.averageTime > 1000) {
      recommendations.push('Average query time is too high');
    }

    if (cacheMetrics.hitRate < 50) {
      recommendations.push('Cache hit rate is below optimal threshold');
    }

    return {
      connectionPool: poolHealth,
      performance: {
        averageQueryTime: queryMetrics.averageTime,
        slowQueries: queryMetrics.slowQueries,
        totalQueries: queryMetrics.totalQueries,
      },
      cache: {
        hitRate: cacheMetrics.hitRate,
        memoryUsage: cacheMetrics.memoryUsage,
        size: cacheMetrics.memoryCacheSize,
      },
      recommendations,
    };
  }

  /**
   * Get current metrics
   */
  getMetrics(): any {
    return {
      query: this.queryService.getMetrics(),
      cache: this.cacheService.getMetrics(),
      config: this.config,
    };
  }

  /**
   * Get health history
   */
  getHealthHistory(): DatabaseHealth[] {
    return [...this.healthChecks];
  }

  /**
   * Clear all caches
   */
  async clearAllCaches(): Promise<void> {
    await this.cacheService.clear();
  }

  /**
   * Shutdown optimization service
   */
  async shutdown(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    await this.queryService.shutdown();
    await this.cacheService.shutdown();
  }
}

export default DatabaseOptimizationService;
