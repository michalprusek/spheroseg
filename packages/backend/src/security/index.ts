import { Application } from 'express';
import { applySecurityMiddleware } from './middleware/security';
import { SecurityManager } from './SecurityManager';
import config from '../config';
import { securityConfig, validateSecurityConfig } from '../config/security';
import logger from '../utils/logger';
import { applySecurity as applySecurityHeaders } from '../middleware/securityHeaders';
import { csrfProtection, csrfCookie } from '../middleware/csrf';
import { dynamicRateLimiter } from '../middleware/rateLimiter';

/**
 * Configures all security-related middleware for the Express application.
 * This centralizes security configurations for better maintainability.
 */
export const configureSecurity = (app: Application): void => {
  // Validate security configuration in production
  validateSecurityConfig();
  
  // Apply security headers (helmet and custom headers)
  applySecurityHeaders(app);
  logger.info('Security headers configured');
  
  // Apply CSRF protection
  if (securityConfig.csrf.enabled) {
    app.use(csrfCookie);
    app.use(csrfProtection);
    logger.info('CSRF protection enabled');
  }
  
  // Apply dynamic rate limiting
  app.use(dynamicRateLimiter);
  logger.info('Dynamic rate limiting configured');
  
  // Apply base security middleware using the consolidated security module
  applySecurityMiddleware(app, {
    hsts: !config.isDevelopment,
    hstsMaxAge: securityConfig.headers.strictTransportSecurity.maxAge,
    hstsIncludeSubdomains: securityConfig.headers.strictTransportSecurity.includeSubDomains,
    cspReportOnly: config.isDevelopment,
    csrfProtection: securityConfig.csrf.enabled,
    corsOrigins: securityConfig.cors.origin as string[],
    enableRateLimit: securityConfig.rateLimit.standardHeaders,
  });

  // Apply advanced security features via SecurityManager
  const securityManager = SecurityManager.getInstance({
    enableRateLimit: true,
    enableCSRF: securityConfig.csrf.enabled,
    enableCORS: true,
    enableHSTS: !config.isDevelopment,
    enableCSP: true,
    corsOrigins: securityConfig.cors.origin as string[],
    rateLimitWindow: securityConfig.rateLimit.windowMs,
    rateLimitRequests: securityConfig.rateLimit.max,
    useRedisForRateLimit: config.security?.useRedis || false,
    redisUrl: config.redis?.url,
  });

  // Apply security manager middleware
  securityManager.applyToApp(app);

  logger.info('Security middleware configured successfully with enhanced security');
};

// Export authentication middleware for use in routes
export * from './middleware/auth';

// Export rate limiting middleware for use in specific routes
export {
  standardLimiter,
  authLimiter,
  sensitiveOperationsLimiter,
  userStatsLimiter,
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
