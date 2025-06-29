# Rate Limiting Migration Guide

This guide explains how to migrate from the simple rate limiting to the new hierarchical rate limiting system.

## Overview

The new rate limiting system provides:
- Hierarchical rate limits (multiple tiers per endpoint)
- Redis support for distributed systems
- IP whitelisting
- Dynamic rate limits based on user roles
- Better monitoring and metrics
- More granular control

## Key Differences

### Old System
```typescript
// Simple rate limiter with single tier
import { standardLimiter, authLimiter } from './security';

router.get('/api/data', standardLimiter, handler);
```

### New System
```typescript
// Hierarchical rate limiter with multiple tiers
import { publicRateLimit, authenticatedRateLimit } from './security';

// For public endpoints
router.get('/api/public/data', publicRateLimit, handler);

// For authenticated endpoints
router.get('/api/user/data', authenticate, authenticatedRateLimit, handler);
```

## Migration Steps

### 1. Replace Basic Rate Limiters

#### Public Endpoints
```typescript
// Old
router.use(standardLimiter);

// New
router.use(publicRateLimit);
```

#### Authentication Endpoints
```typescript
// Old
router.post('/auth/login', authLimiter, loginHandler);

// New
router.post('/auth/login', authRateLimit, loginHandler);
```

#### Sensitive Operations
```typescript
// Old
router.post('/account/delete', sensitiveOperationsLimiter, deleteHandler);

// New
router.post('/account/delete', sensitiveRateLimit, deleteHandler);
```

### 2. Use Appropriate Rate Limiters

The new system provides specialized rate limiters for different use cases:

| Use Case | Old Limiter | New Limiter | Limits |
|----------|-------------|-------------|---------|
| Public API | `standardLimiter` | `publicRateLimit` | 100 req/15min + 20 req/min burst |
| Authenticated API | `standardLimiter` | `authenticatedRateLimit` | 300 req/15min + 50 req/min burst |
| Auth Endpoints | `authLimiter` | `authRateLimit` | 10 attempts/15min + 3 attempts/5min |
| Sensitive Ops | `sensitiveOperationsLimiter` | `sensitiveRateLimit` | 5 req/hour + 1 req/5min |
| File Uploads | - | `uploadRateLimit` | 20 uploads/hour |

### 3. Create Custom Rate Limiters

For endpoints with specific requirements:

```typescript
import { HierarchicalRateLimiter, RATE_LIMIT_TIERS } from './security';

// Custom rate limiter for API endpoints
const customApiLimiter = new HierarchicalRateLimiter({
  tiers: [
    { name: 'api-minute', points: 60, duration: 60 },
    { name: 'api-hour', points: 1000, duration: 3600 },
    { name: 'api-day', points: 10000, duration: 86400 }
  ],
  useRedis: true,
  redisClient: redisClient,
  keyPrefix: 'rl:custom-api',
  customKeyGenerator: (req) => {
    // Use API key if available
    const apiKey = req.headers['x-api-key'];
    return apiKey ? `api:${apiKey}` : `ip:${req.ip}`;
  }
});

// Apply to routes
router.use('/api/v2', customApiLimiter.middleware(['api-minute', 'api-hour', 'api-day']));
```

### 4. Configure Redis (Optional)

For distributed systems, enable Redis support:

```typescript
// In config
export default {
  security: {
    useRedis: true,
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  }
};
```

### 5. Add IP Whitelisting

Whitelist trusted IPs or services:

```typescript
import { publicRateLimiter } from './security';

// Add IPs to whitelist
publicRateLimiter.addToWhitelist('10.0.0.100'); // Internal service
publicRateLimiter.addToWhitelist('192.168.1.50'); // Admin IP

// Add paths to whitelist
publicRateLimiter.addPathToWhitelist('/health');
publicRateLimiter.addPathToWhitelist('/metrics');
```

### 6. Monitor Rate Limiting

Use the new monitoring capabilities:

```typescript
import { publicRateLimiter } from './security';

// Check current consumption
const consumption = await publicRateLimiter.getConsumption('user:123', 'public-default');
console.log(`Remaining points: ${consumption?.remainingPoints}`);

// Reset rate limit for a user
await publicRateLimiter.reset('user:123');

// Handle rate limit events
const customLimiter = new HierarchicalRateLimiter({
  tiers: [...],
  onLimitReached: (req, rateLimiterRes) => {
    // Log to monitoring system
    logger.warn('Rate limit reached', {
      userId: req.user?.id,
      ip: req.ip,
      endpoint: req.path
    });
    
    // Send alert for suspicious activity
    if (req.path.startsWith('/auth/')) {
      alertService.sendAlert('Possible brute force attempt', {
        ip: req.ip,
        attempts: rateLimiterRes.consumedPoints
      });
    }
  }
});
```

## Testing

### Unit Tests
```typescript
describe('Rate Limiting', () => {
  it('should apply hierarchical limits', async () => {
    // Test burst protection
    for (let i = 0; i < 20; i++) {
      const res = await request(app).get('/api/public/data');
      expect(res.status).toBe(200);
    }
    
    // 21st request within a minute should fail
    const res = await request(app).get('/api/public/data');
    expect(res.status).toBe(429);
    expect(res.body.error.limits).toHaveLength(1);
    expect(res.body.error.limits[0].tier).toBe('public-burst');
  });
});
```

### Load Testing
```bash
# Test rate limits with k6
k6 run --vus 50 --duration 30s rate-limit-test.js
```

## Rollback Plan

If you need to rollback to the old system:

1. Keep both imports available during migration
2. Use feature flags to switch between systems
3. Monitor error rates and performance

```typescript
const useNewRateLimiter = process.env.USE_NEW_RATE_LIMITER === 'true';

router.get('/api/data', 
  useNewRateLimiter ? publicRateLimit : standardLimiter,
  handler
);
```

## Common Issues

### 1. Redis Connection Failed
- Fallback to memory-based rate limiting automatically
- Check Redis connection string and network access

### 2. Too Restrictive Limits
- Adjust tier configurations in RATE_LIMIT_TIERS
- Consider user feedback and actual usage patterns

### 3. Performance Impact
- Enable Redis for better performance
- Use appropriate key generation strategy
- Consider caching rate limit checks

## Next Steps

1. Start with non-critical endpoints
2. Monitor metrics and adjust limits
3. Gradually migrate all endpoints
4. Remove old rate limiting code
5. Document custom configurations