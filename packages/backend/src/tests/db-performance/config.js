/**
 * Database Performance Testing Configuration
 * Contains settings for the performance test suite
 */

module.exports = {
  // Database connection settings
  database: {
    host: process.env.DB_TEST_HOST || 'localhost',
    port: process.env.DB_TEST_PORT || 5432,
    database: process.env.DB_TEST_DATABASE || 'spheroseg_test',
    user: process.env.DB_TEST_USER || 'postgres',
    password: process.env.DB_TEST_PASSWORD || 'postgres',
    // Max number of connections in the pool
    poolMax: parseInt(process.env.DB_TEST_POOL_MAX || '10', 10),
    // Statement timeout in milliseconds (5 seconds)
    statementTimeout: parseInt(process.env.DB_TEST_STMT_TIMEOUT || '5000', 10)
  },
  
  // Test execution settings
  execution: {
    // Number of virtual users for load testing
    concurrentUsers: parseInt(process.env.DB_TEST_CONCURRENT_USERS || '10', 10),
    // Duration of each test in seconds
    duration: parseInt(process.env.DB_TEST_DURATION || '30', 10),
    // Ramp-up period in seconds
    rampUp: parseInt(process.env.DB_TEST_RAMP_UP || '5', 10),
    // Think time between requests in milliseconds (random between min and max)
    thinkTime: {
      min: parseInt(process.env.DB_TEST_THINK_TIME_MIN || '100', 10),
      max: parseInt(process.env.DB_TEST_THINK_TIME_MAX || '500', 10)
    }
  },
  
  // Performance thresholds
  thresholds: {
    // Maximum acceptable 95th percentile response time in milliseconds
    responseTimeP95: parseInt(process.env.DB_TEST_THRESHOLD_P95 || '200', 10),
    // Maximum acceptable error rate (percentage)
    errorRate: parseFloat(process.env.DB_TEST_THRESHOLD_ERROR_RATE || '1.0'),
    // Maximum acceptable mean response time in milliseconds
    responseTimeMean: parseInt(process.env.DB_TEST_THRESHOLD_MEAN || '50', 10)
  },
  
  // Monitoring settings
  monitoring: {
    // Enable detailed query logging
    enableQueryLogging: process.env.DB_TEST_LOG_QUERIES === 'true',
    // Log queries that exceed this duration (milliseconds)
    slowQueryThreshold: parseInt(process.env.DB_TEST_SLOW_QUERY || '100', 10),
    // Enable EXPLAIN plans for slow queries
    enableExplainForSlowQueries: process.env.DB_TEST_EXPLAIN_SLOW === 'true',
    // Collect metrics every n milliseconds
    metricsInterval: parseInt(process.env.DB_TEST_METRICS_INTERVAL || '1000', 10)
  },
  
  // Test data generation settings
  testData: {
    // Number of test users to create
    users: parseInt(process.env.DB_TEST_DATA_USERS || '100', 10),
    // Number of projects per user
    projectsPerUser: parseInt(process.env.DB_TEST_DATA_PROJECTS || '5', 10),
    // Number of images per project
    imagesPerProject: parseInt(process.env.DB_TEST_DATA_IMAGES || '10', 10),
    // Number of segmentations per image
    segmentationsPerImage: parseInt(process.env.DB_TEST_DATA_SEGMENTATIONS || '2', 10),
    // Random seed for deterministic data generation
    seed: process.env.DB_TEST_DATA_SEED || '42'
  }
};