/**
 * Cache Warming Configuration for API Responses
 * 
 * Defines intelligent cache warming rules and patterns for different
 * types of data access to improve response times through predictive caching.
 */

import { cacheWarming } from '../middleware/advancedApiCache';

// Cache warming rules for predictive data loading
export const cacheWarmingRules = [
  // When user accesses stats, warm up related project data
  {
    pattern: /\/api\/users\/stats$/,
    dependencies: [
      'api:GET:/projects:user:{userId}',
      'api:GET:/users/projects/optimized:user:{userId}:query:page=1&limit=20',
    ],
    priority: 1,
  },

  // When user views a project, warm up related images
  {
    pattern: /\/api\/projects\/[^\/]+$/,
    dependencies: [
      'api:GET:/projects/{projectId}/images:user:{userId}',
      'api:GET:/images/:id/segmentation:user:{userId}',
    ],
    priority: 2,
  },

  // When user uploads images, warm up segmentation queue status
  {
    pattern: /\/api\/projects\/[^\/]+\/upload$/,
    dependencies: [
      'api:GET:/segmentation/queue/status:user:{userId}',
      'api:GET:/users/stats/basic:user:{userId}',
    ],
    priority: 1,
  },

  // When user accesses error tracking, warm up related dashboard data
  {
    pattern: /\/api\/errors$/,
    dependencies: [
      'api:GET:/errors/dashboard:user:{userId}',
      'api:GET:/errors/patterns:user:{userId}',
    ],
    priority: 3,
  },

  // When user accesses project images, warm up segmentation results
  {
    pattern: /\/api\/projects\/[^\/]+\/images$/,
    dependencies: [
      'api:GET:/images/:id/segmentation:user:{userId}',
      'api:GET:/segmentation/queue/status:user:{userId}',
    ],
    priority: 2,
  },
];

// Adaptive cache strategy thresholds for different performance requirements
export const adaptiveCacheThresholds = {
  fast: 100,    // Responses under 100ms - use COLD strategy
  medium: 500,  // Responses 100-500ms - use WARM strategy  
  slow: 1000,   // Responses over 500ms - use HOT strategy
};

// Cache invalidation patterns for different data types
export const invalidationPatterns = {
  user: {
    patterns: [
      'user_stats:*',
      'user_projects:*',
      'project_list:*',
    ],
    cascades: ['projects', 'images'], // Invalidate related data
  },
  
  project: {
    patterns: [
      'project:*',
      'project_list:*',
      'project_images:*',
    ],
    cascades: ['images', 'segmentation'],
  },
  
  image: {
    patterns: [
      'image:*',
      'project_images:*',
      'image_segmentation:*',
    ],
    cascades: ['segmentation'],
  },
  
  segmentation: {
    patterns: [
      'segmentation:*',
      'segmentation_results:*',
      'queue_status:*',
    ],
    cascades: [],
  },
  
  error: {
    patterns: [
      'errors:*',
      'error_dashboard:*',
      'error_patterns:*',
    ],
    cascades: ['dashboard'],
  },
};

// Performance monitoring for cache effectiveness
export const cacheMetrics = {
  hitRateThresholds: {
    excellent: 90,  // >90% hit rate
    good: 75,       // 75-90% hit rate
    poor: 50,       // 50-75% hit rate
    critical: 25,   // <50% hit rate
  },
  
  responseTimeTargets: {
    userStats: 80,           // User stats should be <80ms
    projectList: 100,        // Project lists should be <100ms
    segmentationResults: 150, // Segmentation results should be <150ms
    errorDashboard: 200,     // Error dashboard should be <200ms
  },
  
  warmingEffectiveness: {
    minimumImprovement: 0.3,  // 30% improvement required
    maximumWarmingDelay: 5000, // Max 5s delay for warming
  },
};

// Cache size limits and cleanup strategies
export const cacheManagement = {
  maxMemoryUsage: 256 * 1024 * 1024, // 256MB max memory usage
  cleanupThresholds: {
    memory: 0.85,     // Start cleanup at 85% memory usage
    entries: 10000,   // Max 10k cache entries
    age: 3600000,     // Remove entries older than 1 hour
  },
  
  priorityWeights: {
    HOT: 4,     // Highest retention priority
    WARM: 3,    // Medium retention priority
    COLD: 2,    // Lower retention priority
    STATIC: 5,  // Highest retention (rarely changes)
  },
};

/**
 * Get cache warming middleware with pre-configured rules
 */
export function getCacheWarmingMiddleware() {
  return cacheWarming(cacheWarmingRules);
}

/**
 * Intelligent cache invalidation based on data relationships
 */
export async function intelligentCacheInvalidation(
  dataType: keyof typeof invalidationPatterns,
  identifier: string,
  cacheService: any
): Promise<void> {
  const config = invalidationPatterns[dataType];
  
  if (!config) {
    throw new Error(`Unknown data type for cache invalidation: ${dataType}`);
  }
  
  // Invalidate direct patterns
  for (const pattern of config.patterns) {
    const resolvedPattern = pattern.replace('*', identifier);
    await cacheService.invalidatePattern(resolvedPattern);
  }
  
  // Cascade invalidation to related data
  for (const cascade of config.cascades) {
    const cascadeConfig = invalidationPatterns[cascade as keyof typeof invalidationPatterns];
    if (cascadeConfig) {
      for (const pattern of cascadeConfig.patterns) {
        const resolvedPattern = pattern.replace('*', `*${identifier}*`);
        await cacheService.invalidatePattern(resolvedPattern);
      }
    }
  }
}

export default {
  cacheWarmingRules,
  adaptiveCacheThresholds,
  invalidationPatterns,
  cacheMetrics,
  cacheManagement,
  getCacheWarmingMiddleware,
  intelligentCacheInvalidation,
};