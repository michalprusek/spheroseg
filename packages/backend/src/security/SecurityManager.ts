/**
 * Security Manager
 *
 * Centralized security management class that coordinates all security-related
 * functionality in the application.
 */

import { Application, Request, Response, NextFunction } from 'express';
import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import config from '../config';
import logger from '../utils/logger';
// Removed circular import - configureSecurity
import * as securityHelpers from './utils/securityHelpers';

export interface SecurityConfig {
  enableRateLimit: boolean;
  enableCSRF: boolean;
  enableCORS: boolean;
  enableHSTS: boolean;
  enableCSP: boolean;
  corsOrigins: string[];
  rateLimitWindow: number;
  rateLimitRequests: number;
  useRedisForRateLimit: boolean;
  redisUrl?: string;
}

export interface SecurityMetrics {
  totalRequests: number;
  blockedRequests: number;
  rateLimitHits: number;
  authenticationFailures: number;
  csrfViolations: number;
  suspiciousActivities: number;
}

/**
 * SecurityManager class for centralized security management
 */
export class SecurityManager {
  private static instance: SecurityManager;
  private config: SecurityConfig;
  private metrics: SecurityMetrics;
  private rateLimiter?: RateLimiterMemory | RateLimiterRedis;
  private suspiciousIPs: Set<string> = new Set();
  private whitelistedIPs: Set<string> = new Set();

  private constructor(config: Partial<SecurityConfig> = {}) {
    this.config = {
      enableRateLimit: config.enableRateLimit ?? true,
      enableCSRF: config.enableCSRF ?? !config.isDevelopment,
      enableCORS: config.enableCORS ?? true,
      enableHSTS: config.enableHSTS ?? !config.isDevelopment,
      enableCSP: config.enableCSP ?? true,
      corsOrigins: config.corsOrigins ?? config.server?.corsOrigins ?? ['http://localhost:3000'],
      rateLimitWindow: config.rateLimitWindow ?? 900000, // 15 minutes
      rateLimitRequests: config.rateLimitRequests ?? 100,
      useRedisForRateLimit: config.useRedisForRateLimit ?? false,
      redisUrl: config.redisUrl,
    };

    this.metrics = {
      totalRequests: 0,
      blockedRequests: 0,
      rateLimitHits: 0,
      authenticationFailures: 0,
      csrfViolations: 0,
      suspiciousActivities: 0,
    };

    this.initializeRateLimiter();
    this.initializeWhitelist();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: Partial<SecurityConfig>): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager(config);
    }
    return SecurityManager.instance;
  }

  /**
   * Initialize rate limiter
   */
  private initializeRateLimiter(): void {
    if (!this.config.enableRateLimit) return;

    if (this.config.useRedisForRateLimit && this.config.redisUrl) {
      const redis = new Redis(this.config.redisUrl);
      this.rateLimiter = new RateLimiterRedis({
        storeClient: redis,
        keyPrefix: 'rl:',
        points: this.config.rateLimitRequests,
        duration: this.config.rateLimitWindow / 1000, // Convert to seconds
        blockDuration: 600, // Block for 10 minutes
      });
      logger.info('Rate limiter initialized with Redis backend');
    } else {
      this.rateLimiter = new RateLimiterMemory({
        points: this.config.rateLimitRequests,
        duration: this.config.rateLimitWindow / 1000,
        blockDuration: 600,
      });
      logger.info('Rate limiter initialized with memory backend');
    }
  }

  /**
   * Initialize IP whitelist
   */
  private initializeWhitelist(): void {
    // Add local/internal IPs to whitelist
    this.whitelistedIPs.add('127.0.0.1');
    this.whitelistedIPs.add('::1');
    this.whitelistedIPs.add('localhost');

    // Add configured whitelisted IPs
    const configuredWhitelist = config.security?.ipWhitelist || [];
    configuredWhitelist.forEach((ip) => this.whitelistedIPs.add(ip));
  }

  /**
   * Apply security middleware to Express app
   */
  public applyToApp(app: Application): void {
    // Add custom security middleware
    app.use(this.securityMiddleware.bind(this));

    // Add metrics endpoint (protected)
    app.get('/api/security/metrics', this.requireAdmin.bind(this), (req, res) => {
      res.json(this.getMetrics());
    });

    logger.info('Security manager applied to application');
  }

  /**
   * Main security middleware
   */
  private async securityMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      this.metrics.totalRequests++;

      const clientIp = securityHelpers.getClientIp(req);

      // Check if IP is whitelisted
      if (this.whitelistedIPs.has(clientIp)) {
        return next();
      }

      // Check if IP is suspicious
      if (this.suspiciousIPs.has(clientIp)) {
        this.metrics.blockedRequests++;
        logger.warn('Blocked request from suspicious IP', {
          ip: clientIp,
          url: req.url,
          method: req.method,
          body: req.body,
          suspiciousIPs: Array.from(this.suspiciousIPs),
        });
        return res.status(403).json({ error: 'Access denied' });
      }

      // Apply rate limiting
      if (this.rateLimiter) {
        try {
          await this.rateLimiter.consume(clientIp);
        } catch (rateLimiterRes) {
          this.metrics.rateLimitHits++;
          logger.warn('Rate limit exceeded', { ip: clientIp });

          // Add to suspicious IPs if hitting rate limit frequently
          if (this.metrics.rateLimitHits > 10) {
            this.markAsSuspicious(clientIp);
          }

          res.set('Retry-After', String(Math.round(rateLimiterRes.msBeforeNext / 1000)) || '60');
          return res.status(429).json({ error: 'Too many requests' });
        }
      }

      // Detect suspicious patterns
      this.detectSuspiciousActivity(req);

      next();
    } catch (error) {
      logger.error('Security middleware error', error);
      next();
    }
  }

  /**
   * Mark an IP as suspicious
   */
  public markAsSuspicious(ip: string): void {
    this.suspiciousIPs.add(ip);
    this.metrics.suspiciousActivities++;
    logger.warn('IP marked as suspicious', { ip });

    // Auto-remove from suspicious list after 1 hour
    setTimeout(() => {
      this.suspiciousIPs.delete(ip);
      logger.info('IP removed from suspicious list', { ip });
    }, 3600000);
  }

  /**
   * Detect suspicious activity patterns
   */
  private detectSuspiciousActivity(req: Request): void {
    // Skip suspicious pattern detection for certain safe endpoints
    const safeEndpoints = [
      '/api/access-requests',
      '/api/auth/register',
      '/api/auth/reset-password',
    ];

    if (safeEndpoints.some((endpoint) => req.url.startsWith(endpoint))) {
      return;
    }

    const suspiciousPatterns = [
      /\.\.\//, // Directory traversal
      /<script/i, // XSS attempt
      /union.*select/i, // SQL injection
      /\bor\b\s+\d+\s*=\s*\d+/, // SQL injection (more specific pattern)
      /\balert\s*\(/i, // XSS attempt
      /\beval\s*\(/i, // Code injection
    ];

    // Check URL separately from body to avoid false positives
    const urlToCheck = req.url;
    const bodyToCheck = req.body ? JSON.stringify(req.body) : '';

    // Check URL patterns
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(urlToCheck)) {
        const clientIp = securityHelpers.getClientIp(req);
        logger.warn('Suspicious pattern detected in URL', {
          ip: clientIp,
          pattern: pattern.toString(),
          url: req.url,
          matchedPart: urlToCheck.match(pattern)?.[0],
        });
        this.markAsSuspicious(clientIp);
        return;
      }
    }

    // For body, use more intelligent checking to avoid false positives
    if (bodyToCheck) {
      // Check for actual SQL injection attempts, not just field names
      const bodySqlPatterns = [
        /<script[^>]*>.*?<\/script>/gi, // Script tags
        /\bUNION\s+SELECT\b/i, // SQL UNION SELECT
        /\bDROP\s+TABLE\b/i, // SQL DROP TABLE
        /\bINSERT\s+INTO\b.*\bVALUES\s*\(/i, // SQL INSERT
        /\bDELETE\s+FROM\b/i, // SQL DELETE
        /\b(OR|AND)\s+\d+\s*=\s*\d+/i, // SQL injection with numeric comparison
        /['"]\s*(OR|AND)\s+['"]\w+['"]\s*=\s*['"]\w+['"]/i, // SQL injection with string comparison
      ];

      for (const pattern of bodySqlPatterns) {
        if (pattern.test(bodyToCheck)) {
          const clientIp = securityHelpers.getClientIp(req);
          logger.warn('Suspicious pattern detected in body', {
            ip: clientIp,
            pattern: pattern.toString(),
            body: req.body,
            matchedPart: bodyToCheck.match(pattern)?.[0],
          });
          this.markAsSuspicious(clientIp);
          return;
        }
      }
    }
  }

  /**
   * Record authentication failure
   */
  public recordAuthFailure(ip: string): void {
    this.metrics.authenticationFailures++;

    // Mark as suspicious after 5 failed attempts
    if (this.metrics.authenticationFailures % 5 === 0) {
      this.markAsSuspicious(ip);
    }
  }

  /**
   * Record CSRF violation
   */
  public recordCSRFViolation(ip: string): void {
    this.metrics.csrfViolations++;
    this.markAsSuspicious(ip);
  }

  /**
   * Get security metrics
   */
  public getMetrics(): SecurityMetrics & { suspiciousIPs: string[] } {
    return {
      ...this.metrics,
      suspiciousIPs: Array.from(this.suspiciousIPs),
    };
  }

  /**
   * Reset metrics (for testing)
   */
  public resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      blockedRequests: 0,
      rateLimitHits: 0,
      authenticationFailures: 0,
      csrfViolations: 0,
      suspiciousActivities: 0,
    };
    this.suspiciousIPs.clear();
  }

  /**
   * Require admin middleware
   */
  private requireAdmin(req: Request, res: Response, next: NextFunction): void {
    const user = (req as any).user;

    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  }

  /**
   * Add IP to whitelist
   */
  public addToWhitelist(ip: string): void {
    this.whitelistedIPs.add(ip);
    logger.info('IP added to whitelist', { ip });
  }

  /**
   * Remove IP from whitelist
   */
  public removeFromWhitelist(ip: string): void {
    this.whitelistedIPs.delete(ip);
    logger.info('IP removed from whitelist', { ip });
  }

  /**
   * Get security headers for a specific request
   */
  public getSecurityHeaders(req: Request): Record<string, string> {
    const headers: Record<string, string> = {};

    if (this.config.enableHSTS && req.secure) {
      headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
    }

    if (this.config.enableCSP) {
      const nonce = securityHelpers.generateNonce();
      headers['Content-Security-Policy'] = this.generateCSP(nonce);
    }

    headers['X-Frame-Options'] = 'DENY';
    headers['X-Content-Type-Options'] = 'nosniff';
    headers['X-XSS-Protection'] = '1; mode=block';
    headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';
    headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()';

    return headers;
  }

  /**
   * Generate CSP header
   */
  private generateCSP(nonce: string): string {
    const directives = [
      `default-src 'self'`,
      `script-src 'self' 'nonce-${nonce}'`,
      `style-src 'self' 'unsafe-inline'`,
      `img-src 'self' data: https:`,
      `font-src 'self' data:`,
      `connect-src 'self' ws: wss:`,
      `media-src 'self'`,
      `object-src 'none'`,
      `frame-ancestors 'none'`,
      `base-uri 'self'`,
      `form-action 'self'`,
    ];

    if (config.isDevelopment) {
      directives.push(`script-src 'self' 'nonce-${nonce}' 'unsafe-eval'`);
    }

    return directives.join('; ');
  }
}

// Export the class as named export
export { SecurityManager };

// Export singleton instance as default
export default SecurityManager;
