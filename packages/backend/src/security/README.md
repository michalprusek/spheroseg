# Security Module Documentation

## Overview

The security module provides a centralized, comprehensive security solution for the SpherosegV4 backend. It consolidates all security-related functionality into a single, maintainable module.

## Structure

```
security/
├── index.ts                    # Main entry point and configuration
├── SecurityManager.ts          # Advanced security management class
├── middleware/
│   ├── security.ts            # Core security middleware (headers, CORS, CSRF)
│   ├── auth.ts                # Authentication and authorization middleware
│   └── rateLimitMiddleware.ts # Rate limiting middleware
└── utils/
    └── securityHelpers.ts     # Security utility functions
```

## Features

### 1. Security Headers
- **HSTS (HTTP Strict Transport Security)**: Forces HTTPS connections
- **X-Frame-Options**: Prevents clickjacking attacks
- **X-Content-Type-Options**: Prevents MIME type sniffing
- **X-XSS-Protection**: Legacy XSS protection
- **CSP (Content Security Policy)**: Controls resource loading
- **CORS**: Cross-Origin Resource Sharing configuration

### 2. Authentication & Authorization
- JWT token validation
- Role-based access control (RBAC)
- Resource ownership verification
- Socket.IO authentication
- Development mode bypass

### 3. Rate Limiting
- Hierarchical rate limiting (standard, auth, sensitive)
- IP-based and user-based limiting
- Redis support for distributed systems
- Automatic blocking of suspicious IPs
- Advanced rate limiting with multiple tiers
- Burst protection and sliding window algorithm
- Dynamic rate limits based on user roles
- IP and path whitelisting

### 4. Security Manager
- Centralized security metrics
- Suspicious activity detection
- IP whitelisting/blacklisting
- Real-time security monitoring
- CSRF protection
- XSS prevention

## Usage

### Basic Setup

```typescript
import { configureSecurity } from './security';
import express from 'express';

const app = express();

// Apply all security middleware
configureSecurity(app);
```

### Authentication Middleware

```typescript
import { authenticateUser, requireAdmin } from './security';

// Protect route with authentication
router.get('/api/protected', authenticateUser, (req, res) => {
  res.json({ message: 'Authenticated!' });
});

// Require admin role
router.delete('/api/users/:id', authenticateUser, requireAdmin, (req, res) => {
  // Admin only endpoint
});
```

### Rate Limiting

#### Basic Rate Limiting
```typescript
import { standardLimiter, authLimiter, sensitiveOperationsLimiter } from './security';

// Standard rate limit (100 requests per 15 minutes)
router.use('/api', standardLimiter);

// Strict limit for auth endpoints (10 requests per 15 minutes)
router.use('/api/auth', authLimiter);

// Very strict for sensitive operations (5 requests per hour)
router.post('/api/users/delete-account', sensitiveOperationsLimiter);
```

#### Advanced Hierarchical Rate Limiting
```typescript
import { 
  publicRateLimit, 
  authenticatedRateLimit, 
  authRateLimit,
  uploadRateLimit,
  HierarchicalRateLimiter 
} from './security';

// Public endpoints (100 req/15min + 20 req/min burst protection)
router.use('/api/public', publicRateLimit);

// Authenticated endpoints (300 req/15min + 50 req/min burst)
router.use('/api/user', authenticate, authenticatedRateLimit);

// Auth endpoints with strict limits (10 attempts/15min + 3 attempts/5min)
router.post('/auth/login', authRateLimit, loginHandler);

// File upload endpoints (20 uploads/hour)
router.post('/api/upload', uploadRateLimit, uploadHandler);

// Custom rate limiter for API endpoints
const apiRateLimiter = new HierarchicalRateLimiter({
  tiers: [
    { name: 'api-minute', points: 60, duration: 60 },
    { name: 'api-hour', points: 1000, duration: 3600 },
    { name: 'api-day', points: 10000, duration: 86400 }
  ],
  useRedis: true,
  redisClient: redisClient,
  whitelistedIPs: ['10.0.0.1', '192.168.1.100'],
  customKeyGenerator: (req) => {
    const apiKey = req.headers['x-api-key'];
    return apiKey ? `api:${apiKey}` : `ip:${req.ip}`;
  }
});

router.use('/api/v2', apiRateLimiter.middleware(['api-minute', 'api-hour', 'api-day']));
```

### Security Manager

```typescript
import { securityManager } from './security';

// Get security metrics
const metrics = securityManager.getMetrics();

// Mark IP as suspicious
securityManager.markAsSuspicious('192.168.1.100');

// Add IP to whitelist
securityManager.addToWhitelist('10.0.0.1');
```

### Security Helpers

```typescript
import { securityHelpers } from './security';

// Generate secure tokens
const token = securityHelpers.generateSecureToken(32);

// Validate password strength
const { isValid, message } = securityHelpers.validatePasswordStrength(password);

// Sanitize user input
const sanitized = securityHelpers.sanitizeInput(userInput);

// Get client IP
const clientIp = securityHelpers.getClientIp(req);
```

## Configuration

Security configuration is managed through environment variables and config files:

```typescript
// config/index.ts
security: {
  enableRateLimit: process.env.ENABLE_RATE_LIMIT !== 'false',
  rateLimitRequests: parseInt(process.env.RATE_LIMIT_REQUESTS || '100'),
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900'), // seconds
  ipWhitelist: process.env.IP_WHITELIST?.split(',') || [],
  tokenSecret: process.env.TOKEN_SECRET || 'default-secret',
  useRedis: process.env.USE_REDIS_RATE_LIMIT === 'true',
}
```

## Security Best Practices

1. **Always use HTTPS in production**
   - HSTS is automatically enabled in production
   - SSL/TLS certificates should be properly configured

2. **Keep dependencies updated**
   - Regularly run `npm audit` to check for vulnerabilities
   - Update dependencies promptly

3. **Use strong JWT secrets**
   - Generate cryptographically secure secrets
   - Rotate secrets periodically

4. **Monitor security metrics**
   - Check `/api/security/metrics` endpoint regularly
   - Set up alerts for suspicious activities

5. **Configure CORS properly**
   - Only allow trusted origins
   - Avoid using wildcard (*) in production

6. **Implement proper error handling**
   - Never expose sensitive information in error messages
   - Log security events for audit trails

## Testing

```bash
# Run security tests
npm test src/security

# Test rate limiting
for i in {1..150}; do curl http://localhost:5001/api/test; done

# Check security headers
curl -I http://localhost:5001
```

## Monitoring

The security module provides real-time metrics:

```json
GET /api/security/metrics

{
  "totalRequests": 10000,
  "blockedRequests": 50,
  "rateLimitHits": 25,
  "authenticationFailures": 10,
  "csrfViolations": 2,
  "suspiciousActivities": 5,
  "suspiciousIPs": ["192.168.1.100", "10.0.0.50"]
}
```

## Troubleshooting

### Rate Limiting Issues
- Check if IP is whitelisted
- Verify rate limit configuration
- Check Redis connection if using distributed rate limiting

### CORS Errors
- Verify allowed origins in configuration
- Check request headers
- Ensure credentials are properly handled

### Authentication Failures
- Verify JWT secret is consistent
- Check token expiration
- Ensure proper header format (Bearer token)

### CSP Violations
- Check browser console for CSP reports
- Adjust CSP directives as needed
- Use nonces for inline scripts