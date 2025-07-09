import { Application } from 'express';
import { applySecurityMiddleware } from './middleware/security';
import { SecurityManager } from './SecurityManager';
import config from '../config';
import logger from '../utils/logger';

/**
 * Configures all security-related middleware for the Express application.
 * This centralizes security configurations for better maintainability.
 */
export const configureSecurity = (app: Application): void => {
  // Apply base security middleware using the consolidated security module
  applySecurityMiddleware(app, {
    hsts: !config.isDevelopment,
    hstsMaxAge: 31536000, // 1 year
    hstsIncludeSubdomains: true,
    cspReportOnly: config.isDevelopment,
    csrfProtection: !config.isDevelopment,
    corsOrigins: config.server.corsOrigins,
    enableRateLimit: config.security?.enableRateLimit !== false,
  });

  // Apply advanced security features via SecurityManager
  const securityManager = SecurityManager.getInstance({
    enableRateLimit: config.security?.enableRateLimit !== false,
    enableCSRF: !config.isDevelopment,
    enableCORS: true,
    enableHSTS: !config.isDevelopment,
    enableCSP: true,
    corsOrigins: config.server.corsOrigins,
    rateLimitWindow: config.security?.rateLimitWindow,
    rateLimitRequests: config.security?.rateLimitRequests,
    useRedisForRateLimit: config.security?.useRedis || false,
    redisUrl: config.redis?.url,
  });

  // Apply security manager middleware
  securityManager.applyToApp(app);

  logger.info('Security middleware configured successfully with SecurityManager');
};

// Export authentication middleware for use in routes
export * from './middleware/auth';

// Export rate limiting middleware for use in specific routes
export {
  standardLimiter,
  authLimiter,
  sensitiveOperationsLimiter,
  createRateLimiter,
} from './middleware/rateLimitMiddleware';

// Export advanced rate limiting features
export {
  HierarchicalRateLimiter,
  RATE_LIMIT_TIERS,
  publicRateLimiter,
  authenticatedRateLimiter,
  authEndpointRateLimiter,
  sensitiveRateLimiter,
  uploadRateLimiter,
  publicRateLimit,
  authenticatedRateLimit,
  authRateLimit,
  sensitiveRateLimit,
  uploadRateLimit,
} from './middleware/advancedRateLimiter';

// Export SecurityManager for advanced security features
export { SecurityManager };

// Export security helper utilities
export * as securityHelpers from './utils/securityHelpers';
