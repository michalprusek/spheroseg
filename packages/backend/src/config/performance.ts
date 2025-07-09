/**
 * Performance configuration settings
 * Centralizes all performance-related magic numbers and thresholds
 */

export const performanceConfig = {
  // Memory settings
  memory: {
    // Container memory limit in MB (should match docker-compose.yml)
    containerLimitMB: parseInt(process.env.CONTAINER_MEMORY_LIMIT_MB || '512', 10),
    // V8 max old space size in MB
    v8MaxOldSpaceMB: parseInt(process.env.V8_MAX_OLD_SPACE_MB || '384', 10),
    // Garbage collection interval in milliseconds
    gcIntervalMs: parseInt(process.env.GC_INTERVAL_MS || '30000', 10),
    // Memory usage thresholds
    thresholds: {
      unhealthy: 90, // percentage
      degraded: 75, // percentage
      heapUnhealthy: 95, // percentage
      heapDegraded: 85, // percentage
    },
  },

  // Database connection pool settings
  database: {
    // Maximum number of connections in the pool
    poolMax: parseInt(process.env.DB_POOL_MAX || '10', 10),
    // Minimum number of connections to maintain
    poolMin: parseInt(process.env.DB_POOL_MIN || '2', 10),
    // Idle timeout in milliseconds
    idleTimeoutMs: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '10000', 10),
    // Connection timeout in milliseconds
    connectionTimeoutMs: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '5000', 10),
    // Allow pool to exit when idle
    allowExitOnIdle: process.env.DB_ALLOW_EXIT_ON_IDLE !== 'false',
  },

  // Static file caching durations (in seconds)
  caching: {
    images: 30 * 24 * 60 * 60, // 30 days
    scripts: 365 * 24 * 60 * 60, // 1 year
    fonts: 365 * 24 * 60 * 60, // 1 year
    json: 0, // No cache
  },

  // Response compression settings
  compression: {
    level: parseInt(process.env.COMPRESSION_LEVEL || '6', 10), // 0-9
    threshold: parseInt(process.env.COMPRESSION_THRESHOLD || '1024', 10), // bytes
    memLevel: parseInt(process.env.COMPRESSION_MEM_LEVEL || '8', 10), // 1-9
  },

  // Health check settings
  healthCheck: {
    // Database query timeout for health checks
    dbTimeoutMs: parseInt(process.env.HEALTH_CHECK_DB_TIMEOUT || '5000', 10),
    // Slow response threshold
    slowResponseMs: parseInt(process.env.HEALTH_CHECK_SLOW_RESPONSE || '5000', 10),
  },
};

export default performanceConfig;
