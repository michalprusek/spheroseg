/**
 * Content Security Policy (CSP) middleware
 * This middleware adds CSP headers to HTTP responses to mitigate XSS attacks
 */
import { Request, Response, NextFunction } from 'express';

/**
 * CSP configuration options
 */
export interface CSPOptions {
  /** Whether to enable the CSP in report-only mode */
  reportOnly?: boolean;
  /** URL to send CSP violation reports to */
  reportUri?: string;
  /** Whether to include the nonce in the CSP */
  useNonce?: boolean;
  /** Additional directives to add to the CSP */
  additionalDirectives?: Record<string, string[]>;
}

/**
 * Default CSP options
 */
const defaultOptions: CSPOptions = {
  reportOnly: false,
  useNonce: true,
  additionalDirectives: {},
};

/**
 * Generate a random nonce
 * @returns A random Base64 nonce
 */
const generateNonce = (): string => {
  const buffer = new Uint8Array(16);
  crypto.getRandomValues(buffer);
  return Buffer.from(buffer).toString('base64');
};

/**
 * Content Security Policy middleware
 * @param options CSP configuration options
 * @returns Express middleware function
 */
export const cspMiddleware = (options: CSPOptions = {}) => {
  const opts = { ...defaultOptions, ...options };
  
  return (req: Request, res: Response, next: NextFunction) => {
    // Generate a nonce for this request
    const nonce = opts.useNonce ? generateNonce() : '';
    
    // Make the nonce available to the templates
    if (opts.useNonce) {
      res.locals.cspNonce = nonce;
    }
    
    // Base CSP directives
    const directives: Record<string, string[]> = {
      'default-src': ["'self'"],
      'script-src': ["'self'", opts.useNonce ? `'nonce-${nonce}'` : '', "'strict-dynamic'"],
      'style-src': ["'self'", opts.useNonce ? `'nonce-${nonce}'` : '', "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'blob:'],
      'font-src': ["'self'"],
      'connect-src': ["'self'"],
      'media-src': ["'self'"],
      'object-src': ["'none'"],
      'frame-src': ["'none'"],
      'worker-src': ["'self'", 'blob:'],
      'frame-ancestors': ["'none'"],
      'form-action': ["'self'"],
      'base-uri': ["'self'"],
      'manifest-src': ["'self'"],
      'upgrade-insecure-requests': [],
      'block-all-mixed-content': [],
    };
    
    // Add report-uri if specified
    if (opts.reportUri) {
      directives['report-uri'] = [opts.reportUri];
      directives['report-to'] = ['csp-endpoint'];
    }
    
    // Add additional directives
    if (opts.additionalDirectives) {
      Object.entries(opts.additionalDirectives).forEach(([key, value]) => {
        if (directives[key]) {
          directives[key] = [...directives[key], ...value];
        } else {
          directives[key] = value;
        }
      });
    }
    
    // Build the CSP header value
    const cspValue = Object.entries(directives)
      .map(([key, value]) => `${key} ${value.join(' ')}`)
      .join('; ');
    
    // Set the CSP header
    const headerName = opts.reportOnly
      ? 'Content-Security-Policy-Report-Only'
      : 'Content-Security-Policy';
    
    res.setHeader(headerName, cspValue);
    
    // If report-uri is specified, add the Report-To header
    if (opts.reportUri) {
      const reportTo = JSON.stringify({
        group: 'csp-endpoint',
        max_age: 10886400,
        endpoints: [{ url: opts.reportUri }],
      });
      
      res.setHeader('Report-To', reportTo);
    }
    
    next();
  };
};

/**
 * Factory function to create a CSP middleware for different environments
 * @param env Environment name
 * @returns CSP middleware configured for the specified environment
 */
export const createCSPMiddleware = (env: string) => {
  switch (env) {
    case 'development':
      return cspMiddleware({
        reportOnly: true,
        useNonce: true,
        additionalDirectives: {
          'script-src': ["'unsafe-eval'"], // Allow eval for development tools
          'connect-src': ['ws:', 'wss:'], // Allow WebSocket for hot reload
        },
      });
    
    case 'production':
      return cspMiddleware({
        reportOnly: false,
        useNonce: true,
        reportUri: '/api/security/report/csp',
        additionalDirectives: {
          'connect-src': ["'self'", 'wss:', 'ws:'],
          'upgrade-insecure-requests': [],
          'block-all-mixed-content': [],
        },
      });
    
    default:
      return cspMiddleware();
  }
};

export default createCSPMiddleware;
