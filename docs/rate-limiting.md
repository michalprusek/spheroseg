# Dynamic Rate Limiting System

## Overview

SpherosegV4 implements an advanced dynamic rate limiting system that adapts to user behavior patterns. Instead of fixed rate limits, the system analyzes user behavior and adjusts limits accordingly, providing better protection against abuse while accommodating legitimate power users.

## Features

- **Dynamic User Categorization**: Users are automatically categorized based on behavior
- **Sliding Window Algorithm**: Accurate request counting with Redis sorted sets
- **Endpoint-Specific Limits**: Different limits for sensitive endpoints
- **Behavior Analysis**: Tracks error rates, failed auth attempts, and request patterns
- **Graceful Degradation**: Falls back to in-memory limiting if Redis is unavailable
- **Admin Controls**: Monitor and manage rate limits through API endpoints

## User Categories

### 1. NEW (New Users)
- **Criteria**: Account age < 24 hours or unauthenticated
- **Base Limit**: 30 requests/minute
- **Block Duration**: 5 minutes
- **Purpose**: Limit potential abuse from new accounts

### 2. NORMAL (Regular Users)
- **Criteria**: Authenticated users with normal behavior
- **Base Limit**: 60 requests/minute
- **Block Duration**: 5 minutes
- **Purpose**: Standard usage for most users

### 3. POWER (Power Users)
- **Criteria**: 
  - Account age > 30 days
  - Successful requests > 1000
  - Error rate < 5%
- **Base Limit**: 120 requests/minute
- **Block Duration**: 3 minutes
- **Purpose**: Accommodate heavy but legitimate usage

### 4. SUSPICIOUS
- **Criteria**: Abnormal behavior patterns detected
- **Base Limit**: 15 requests/minute
- **Block Duration**: 10 minutes
- **Purpose**: Limit potentially malicious users

### 5. BLOCKED
- **Criteria**: Severe violations or repeated offenses
- **Base Limit**: 0 requests
- **Block Duration**: 1 hour
- **Purpose**: Temporary ban for abusive behavior

## Endpoint Multipliers

Sensitive endpoints have additional restrictions:

| Endpoint | Multiplier | Example Limit (Normal User) |
|----------|------------|----------------------------|
| `/api/auth/login` | 0.5 | 30 req/min |
| `/api/auth/register` | 0.3 | 18 req/min |
| `/api/auth/forgot-password` | 0.2 | 12 req/min |
| `/api/ml/segment` | 0.5 | 30 req/min |
| `/api/images/upload` | 0.7 | 42 req/min |
| `/api/export` | 0.5 | 30 req/min |
| `/api/health` | 2.0 | 120 req/min |

## Behavior Tracking

The system tracks various metrics to determine user behavior:

### 1. Rapid Requests
- Requests made in the last 10 seconds
- High values indicate potential automated abuse

### 2. Failed Authentication Attempts
- Failed login attempts in the last hour
- Used to detect brute force attacks

### 3. Error Rate
- Ratio of 4xx/5xx responses to total requests
- High error rates may indicate malicious probing

### 4. Unique Endpoints
- Number of different endpoints accessed
- Helps identify crawlers or scanners

### 5. Account Age
- Days since registration
- New accounts have stricter limits

### 6. Successful Requests
- Total successful requests in the last day
- Used to identify power users

## Dynamic Adjustments

The system adjusts limits based on behavior:

### Error Rate Adjustments
- Error rate > 30%: Reduce limit by 50%
- Multiple adjustments can stack

### Failed Auth Attempts
- \> 5 attempts: Reduce limit by 70%
- \> 10 attempts: Automatic blocking

### Rapid Request Detection
- \> 10 rapid requests: Reduce limit by 30%
- \> 50 rapid requests: Automatic blocking

## API Endpoints

### Get Current User Status
```http
GET /api/rate-limit/status
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "identifier": "user123",
    "category": "normal",
    "behavior": {
      "rapidRequests": 5,
      "failedAuthAttempts": 0,
      "errorRate": 0.02,
      "uniqueEndpoints": 12,
      "accountAge": 45,
      "successfulRequests": 1523
    },
    "blocked": false,
    "limits": {
      "windowMs": 60000,
      "maxRequests": 60,
      "blockDuration": 300
    }
  }
}
```

### Admin: Check Any User Status
```http
GET /api/rate-limit/status/:identifier
Authorization: Bearer <admin-token>
```

### Admin: Reset User Limits
```http
POST /api/rate-limit/reset/:identifier
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "reason": "User reported false positive"
}
```

### Admin: Get Configuration
```http
GET /api/rate-limit/config
Authorization: Bearer <admin-token>
```

### Admin: Get Metrics
```http
GET /api/rate-limit/metrics?startTime=2024-01-19T00:00:00Z&endTime=2024-01-19T23:59:59Z
Authorization: Bearer <admin-token>
```

## Response Headers

All responses include rate limit information:

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 2024-01-19T12:34:56.789Z
X-RateLimit-Retry-After: 42 (only when rate limited)
```

## Error Responses

When rate limited:

```json
{
  "success": false,
  "error": {
    "code": "SYS_9003",
    "message": "Rate limit exceeded",
    "timestamp": "2024-01-19T12:34:56.789Z",
    "requestId": "req_abc123",
    "context": {
      "userId": "user123",
      "metadata": {
        "retryAfter": 42,
        "category": "normal"
      }
    }
  }
}
```

## Implementation Details

### Redis Data Structure

```
# Request tracking (sorted set)
ratelimit:requests:{identifier}:{endpoint} -> timestamp scores

# User behavior (hash)
ratelimit:behavior:{identifier} -> {
  rapidRequests: number
  failedAuthAttempts: number
  errorRate: float
  totalRequests: number
  errorRequests: number
  successfulRequests: number
}

# Blocked users (string with TTL)
ratelimit:blocked:{identifier} -> "1"

# User data (hash)
ratelimit:user:{userId} -> {
  registeredAt: timestamp
  category: string
}
```

### Fallback Strategy

When Redis is unavailable:
1. Switch to in-memory store
2. Basic rate limiting without behavior tracking
3. No cross-instance synchronization
4. Automatic recovery when Redis returns

## Best Practices

### For Users

1. **Handle Rate Limit Errors**: Check for 429 status and retry after the specified time
2. **Use Caching**: Reduce requests by caching responses client-side
3. **Batch Operations**: Use batch endpoints when available
4. **Monitor Usage**: Check `/api/rate-limit/status` to see your current limits

### For Developers

1. **Implement Exponential Backoff**: When rate limited, wait progressively longer
2. **Add Request Queuing**: Queue requests to stay within limits
3. **Use Webhooks**: For long operations, use webhooks instead of polling
4. **Optimize Endpoints**: Reduce the number of requests needed

### Example: Handling Rate Limits in Code

```typescript
async function makeRequestWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);
    
    if (response.status !== 429) {
      return response;
    }
    
    // Get retry delay from header
    const retryAfter = parseInt(response.headers.get('X-RateLimit-Retry-After') || '60');
    
    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
  }
  
  throw new Error('Max retries exceeded');
}
```

## Monitoring and Alerts

### Metrics Tracked

1. **Total Requests**: Overall system load
2. **Blocked Requests**: Users hitting rate limits
3. **Category Distribution**: User category breakdown
4. **Endpoint Usage**: Most accessed endpoints
5. **Top Offenders**: Users with highest request rates

### Alert Thresholds

- Blocked requests > 100/hour: Potential DDoS
- Single user > 1000 requests/hour: Investigate behavior
- Error rate > 50% for any user: Possible attack
- Power user downgraded: Check for issues

## Configuration

### Environment Variables

```bash
# Redis connection for rate limiting
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password

# Rate limit overrides (optional)
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=60
RATE_LIMIT_BLOCK_DURATION=300
```

### Custom Configuration

To customize rate limits, modify `rateLimiter.enhanced.ts`:

```typescript
export const RATE_LIMITS = {
  [UserCategory.NORMAL]: {
    windowMs: 60000,      // 1 minute
    maxRequests: 60,      // Your custom limit
    blockDuration: 300,   // 5 minutes
  },
  // ... other categories
};
```

## Security Considerations

1. **IP Spoofing**: Use proper proxy configuration to get real IPs
2. **Distributed Attacks**: Monitor for coordinated attacks from multiple IPs
3. **Account Takeover**: Failed auth attempts trigger stricter limits
4. **API Key Rotation**: Implement API keys for service-to-service calls

## Future Enhancements

1. **Machine Learning**: Use ML to detect attack patterns
2. **Geographic Limits**: Different limits based on location
3. **Time-Based Limits**: Adjust limits based on time of day
4. **Service Tiers**: Different limits for paid tiers
5. **GraphQL Support**: Rate limiting for GraphQL queries