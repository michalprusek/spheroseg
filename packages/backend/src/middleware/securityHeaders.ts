/**
 * Security Headers Middleware
 *
 * Implements comprehensive security headers to protect against common attacks
 */

import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { securityConfig } from '../config/security';

/**
 * Configure Content Security Policy
 */
function getCSPConfig() {
  const directives = securityConfig.headers.contentSecurityPolicy.directives;

  // Add WebSocket support if needed
  if (process.env["ENABLE_WEBSOCKETS"] === 'true') {
    directives.connectSrc.push('ws:', 'wss:');
  }

  // Add CDN support if configured
  if (process.env["CDN_URL"]) {
    directives.scriptSrc.push(process.env["CDN_URL"]);
    directives.styleSrc.push(process.env["CDN_URL"]);
    directives.imgSrc.push(process.env["CDN_URL"]);
    directives.fontSrc.push(process.env["CDN_URL"]);
  }

  return {
    directives,
    reportOnly: process.env["CSP_REPORT_ONLY"] === 'true',
  };
}

/**
 * Security headers middleware using Helmet
 */
export const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: getCSPConfig(),

  // Strict Transport Security (HSTS)
  hsts: securityConfig.headers.strictTransportSecurity,

  // X-Content-Type-Options
  noSniff: true,

  // X-Frame-Options
  frameguard: { action: securityConfig.headers.xFrameOptions.toLowerCase() as 'deny' },

  // X-XSS-Protection (legacy but still useful)
  xssFilter: true,

  // Referrer Policy
  referrerPolicy: { policy: securityConfig.headers.referrerPolicy as any },

  // Permissions Policy (replacing Feature Policy)
  permittedCrossDomainPolicies: false,
});

/**
 * Additional security headers not covered by Helmet
 */
export function additionalSecurityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Permissions Policy
  const permissionsPolicy = Object.entries(securityConfig.headers.permissionsPolicy.features)
    .map(([feature, value]) => `${feature}=${value.join(' ')}`)
    .join(', ');
  res.setHeader('Permissions-Policy', permissionsPolicy);

  // Cache Control for sensitive endpoints
  if (req.path.includes('/api/auth') || req.path.includes('/api/user')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  // Remove potentially dangerous headers
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');

  // Add custom security headers
  res.setHeader('X-Content-Security-Policy', "default-src 'self'");
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  next();
}

/**
 * HTTPS enforcement middleware
 */
export function httpsEnforcement(req: Request, res: Response, next: NextFunction): void {
  // Skip in development
  if (process.env["NODE_ENV"] !== 'production') {
    return next();
  }

  // Skip if HTTPS enforcement is disabled
  if (!securityConfig.api.requireHttps) {
    return next();
  }

  // Check if request is already HTTPS
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';

  if (!isHttps) {
    // Redirect to HTTPS
    const httpsUrl = `https://${req.headers.host}${req.url}`;
    return res.redirect(301, httpsUrl);
  }

  next();
}

/**
 * API key validation middleware
 */
export function apiKeyValidation(req: Request, res: Response, next: NextFunction): void {
  // Skip if API keys are not enabled
  if (!securityConfig.api.enableApiKeys) {
    return next();
  }

  // Skip for public endpoints
  const publicPaths = ['/health', '/health/live', '/health/ready'];
  if (publicPaths.some((path) => req.path.includes(path))) {
    return next();
  }

  // Check for API key in header
  const apiKey = req.headers[securityConfig.api.apiKeyHeader.toLowerCase()] as string;

  if (!apiKey) {
    res.status(401).json({
      error: 'API key required',
      code: 'API_KEY_MISSING',
    });
    return;
  }

  // Validate API key (implement your validation logic)
  // This is a placeholder - implement actual API key validation
  const isValidApiKey = validateApiKey(apiKey);

  if (!isValidApiKey) {
    res.status(401).json({
      error: 'Invalid API key',
      code: 'API_KEY_INVALID',
    });
    return;
  }

  next();
}

/**
 * Placeholder for API key validation
 * TODO: Implement actual API key validation logic
 */
function validateApiKey(apiKey: string): boolean {
  // This should check against a database or cache of valid API keys
  // For now, return true if API key is present
  return apiKey.length > 0;
}

/**
 * Combined security middleware
 */
export function applySecurity(app: any): void {
  // HTTPS enforcement (should be first)
  app.use(httpsEnforcement);

  // Helmet security headers
  app.use(securityHeaders);

  // Additional security headers
  app.use(additionalSecurityHeaders);

  // API key validation (if enabled)
  if (securityConfig.api.enableApiKeys) {
    app.use('/api', apiKeyValidation);
  }
}

export default {
  securityHeaders,
  additionalSecurityHeaders,
  httpsEnforcement,
  apiKeyValidation,
  applySecurity,
};
