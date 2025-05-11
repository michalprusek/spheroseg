/**
 * Security Headers Middleware
 * This middleware adds various security headers to HTTP responses
 */
import { Request, Response, NextFunction } from 'express';

/**
 * Security headers configuration options
 */
export interface SecurityHeadersOptions {
  /** Whether to enable HSTS */
  hsts?: boolean;
  /** HSTS max age in seconds */
  hstsMaxAge?: number;
  /** Whether to include subdomains in HSTS */
  hstsIncludeSubdomains?: boolean;
  /** Whether to enable HSTS preload */
  hstsPreload?: boolean;
  /** Whether to enable X-Frame-Options */
  xFrame?: boolean;
  /** X-Frame-Options value */
  xFrameValue?: 'DENY' | 'SAMEORIGIN';
  /** Whether to enable X-Content-Type-Options */
  xContentType?: boolean;
  /** Whether to enable X-XSS-Protection */
  xXssProtection?: boolean;
  /** Whether to enable Referrer-Policy */
  referrerPolicy?: boolean;
  /** Referrer-Policy value */
  referrerPolicyValue?: string;
  /** Whether to enable Permissions-Policy */
  permissionsPolicy?: boolean;
  /** Permissions-Policy value */
  permissionsPolicyValue?: string;
  /** Whether to enable Cross-Origin-Embedder-Policy */
  coep?: boolean;
  /** Whether to enable Cross-Origin-Opener-Policy */
  coop?: boolean;
  /** Whether to enable Cross-Origin-Resource-Policy */
  corp?: boolean;
  /** Whether to enable Cache-Control */
  cacheControl?: boolean;
  /** Cache-Control value */
  cacheControlValue?: string;
  /** Whether to enable Expect-CT */
  expectCt?: boolean;
  /** Expect-CT max age in seconds */
  expectCtMaxAge?: number;
  /** Whether to enforce Expect-CT */
  expectCtEnforce?: boolean;
  /** Expect-CT report URI */
  expectCtReportUri?: string;
}

/**
 * Default security headers options
 */
const defaultOptions: SecurityHeadersOptions = {
  hsts: true,
  hstsMaxAge: 15552000, // 180 days
  hstsIncludeSubdomains: true,
  hstsPreload: false,
  xFrame: true,
  xFrameValue: 'DENY',
  xContentType: true,
  xXssProtection: true,
  referrerPolicy: true,
  referrerPolicyValue: 'strict-origin-when-cross-origin',
  permissionsPolicy: true,
  permissionsPolicyValue:
    'camera=(), microphone=(), geolocation=(), interest-cohort=(), accelerometer=(), ambient-light-sensor=(), autoplay=(), battery=(), document-domain=(), encrypted-media=(), fullscreen=(self), gamepad=(), gyroscope=(), layout-animations=(), magnetometer=(), midi=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), sync-xhr=(), usb=(), web-share=(), xr-spatial-tracking=()',
  coep: false, // Can break some integrations
  coop: true,
  corp: true,
  cacheControl: true,
  cacheControlValue: 'no-store, max-age=0',
  expectCt: false,
  expectCtMaxAge: 86400, // 1 day
  expectCtEnforce: false,
  expectCtReportUri: '',
};

/**
 * Security headers middleware
 * @param options Security headers configuration options
 * @returns Express middleware function
 */
export const securityHeadersMiddleware = (options: SecurityHeadersOptions = {}) => {
  const opts = { ...defaultOptions, ...options };

  return (req: Request, res: Response, next: NextFunction) => {
    // HTTP Strict Transport Security
    if (opts.hsts) {
      let hstsValue = `max-age=${opts.hstsMaxAge}`;
      if (opts.hstsIncludeSubdomains) {
        hstsValue += '; includeSubDomains';
      }
      if (opts.hstsPreload) {
        hstsValue += '; preload';
      }
      res.setHeader('Strict-Transport-Security', hstsValue);
    }

    // X-Frame-Options
    if (opts.xFrame) {
      res.setHeader('X-Frame-Options', opts.xFrameValue!);
    }

    // X-Content-Type-Options
    if (opts.xContentType) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }

    // X-XSS-Protection
    if (opts.xXssProtection) {
      res.setHeader('X-XSS-Protection', '1; mode=block');
    }

    // Referrer-Policy
    if (opts.referrerPolicy) {
      res.setHeader('Referrer-Policy', opts.referrerPolicyValue!);
    }

    // Permissions-Policy
    if (opts.permissionsPolicy) {
      res.setHeader('Permissions-Policy', opts.permissionsPolicyValue!);
    }

    // Cross-Origin-Embedder-Policy
    if (opts.coep) {
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    }

    // Cross-Origin-Opener-Policy
    if (opts.coop) {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    }

    // Cross-Origin-Resource-Policy
    if (opts.corp) {
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    }

    // Cache-Control
    if (opts.cacheControl) {
      res.setHeader('Cache-Control', opts.cacheControlValue!);
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }

    // Expect-CT
    if (opts.expectCt) {
      let expectCtValue = `max-age=${opts.expectCtMaxAge}`;
      if (opts.expectCtEnforce) {
        expectCtValue += ', enforce';
      }
      if (opts.expectCtReportUri) {
        expectCtValue += `, report-uri="${opts.expectCtReportUri}"`;
      }
      res.setHeader('Expect-CT', expectCtValue);
    }

    next();
  };
};

/**
 * Factory function to create security headers middleware for different environments
 * @param env Environment name
 * @returns Security headers middleware configured for the specified environment
 */
export const createSecurityHeadersMiddleware = (env: string) => {
  switch (env) {
    case 'development':
      return securityHeadersMiddleware({
        hsts: false,
        coep: false,
        coop: false,
        corp: false,
      });

    case 'production':
      return securityHeadersMiddleware({
        hsts: true,
        hstsMaxAge: 31536000, // 1 year
        hstsIncludeSubdomains: true,
        hstsPreload: true,
        xFrame: true,
        xFrameValue: 'DENY',
        xContentType: true,
        xXssProtection: true,
        referrerPolicy: true,
        referrerPolicyValue: 'strict-origin-when-cross-origin',
        permissionsPolicy: true,
        permissionsPolicyValue:
          'camera=(), microphone=(), geolocation=(), interest-cohort=(), accelerometer=(), ambient-light-sensor=(), autoplay=(), battery=(), document-domain=(), encrypted-media=(), fullscreen=(self), gamepad=(), gyroscope=(), layout-animations=(), magnetometer=(), midi=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), sync-xhr=(), usb=(), web-share=(), xr-spatial-tracking=()',
        coep: true,
        coop: true,
        corp: true,
        cacheControl: true,
        expectCt: true,
        expectCtEnforce: true,
        expectCtMaxAge: 86400,
        expectCtReportUri: '/api/security/report/ct',
      });

    default:
      return securityHeadersMiddleware();
  }
};

export default createSecurityHeadersMiddleware;
