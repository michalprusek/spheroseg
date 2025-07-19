# Session Management Documentation

This document describes the Redis-based session management implementation for SpherosegV4.

## Overview

The application now supports both JWT token-based and session-based authentication, providing:
- Better security with server-side session storage
- Session invalidation capabilities
- Multi-device session management
- Automatic session cleanup
- Session analytics and monitoring

## Architecture

### Session Storage
- **Store**: Redis with connect-redis adapter
- **Prefix**: `spheroseg:sess:`
- **TTL**: Configurable (default 1 hour, extended with activity)
- **Serialization**: JSON format

### Session Components

1. **Express Session Middleware** (`express-session`)
   - Manages session lifecycle
   - Handles cookie management
   - Integrates with Redis store

2. **Redis Store** (`connect-redis`)
   - Persistent session storage
   - Automatic TTL management
   - Distributed session support

3. **Session Service** (`sessionService.ts`)
   - User session tracking
   - Session analytics
   - Multi-device management

4. **Session Security Middleware**
   - Fingerprint validation
   - IP tracking
   - Session timeout enforcement

## Configuration

### Environment Variables

```bash
# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_DB=0
ENABLE_REDIS_CACHE=true

# Session Configuration
SESSION_SECRET=your-session-secret  # Falls back to JWT_SECRET
SESSION_TIMEOUT=3600               # Seconds (1 hour default)
SECURE_COOKIES=true               # HTTPS only in production
TRUST_PROXY=true                  # When behind nginx/proxy
```

### Session Cookie Options

```javascript
{
  name: 'spheroseg.sid',         // Custom cookie name
  secure: true,                  // HTTPS only
  httpOnly: true,                // No JS access
  maxAge: 3600000,              // 1 hour
  sameSite: 'strict',           // CSRF protection
  rolling: true                 // Reset on activity
}
```

## Implementation Details

### Hybrid Authentication

The system supports both JWT and session authentication simultaneously:

1. **JWT + Session**: Login creates both for backward compatibility
2. **Session Only**: New `/session/login` endpoint for session-only auth
3. **Either/Or**: Most endpoints accept either authentication method

### Session Lifecycle

1. **Creation**
   ```
   POST /api/auth/login → Creates JWT + Session
   POST /api/auth/session/login → Creates Session only
   ```

2. **Validation**
   - Automatic on each request
   - Fingerprint verification
   - Timeout checking
   - Activity tracking

3. **Renewal**
   - Automatic with `rolling: true`
   - Manual via `POST /api/auth/session/extend`

4. **Destruction**
   - Logout: `POST /api/auth/logout`
   - Timeout: Automatic after inactivity
   - Manual: Invalidate specific sessions

### Session Data Structure

```typescript
interface SessionData {
  // User identification
  userId: string;
  email: string;
  role: string;
  
  // Timestamps
  loginTime: Date;
  lastActivity: Date;
  createdAt: Date;
  renewedAt: Date;
  expiresAt: Date;
  
  // Security
  fingerprint: string;    // Browser fingerprint
  ipAddress: string;      // Client IP
  userAgent: string;      // User agent string
  
  // Flags
  isVerified: boolean;
  requiresReauth: boolean;
  
  // CSRF
  csrfSecret?: string;
}
```

## API Endpoints

### Session Authentication

#### Login with Session
```http
POST /api/auth/session/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password",
  "remember_me": true
}
```

Response:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "User Name"
    },
    "sessionId": "session-id",
    "authMethod": "session"
  }
}
```

#### Get Session Info
```http
GET /api/auth/session/info
Cookie: spheroseg.sid=...
```

#### List User Sessions
```http
GET /api/auth/session/list
Cookie: spheroseg.sid=...
```

Response:
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "sessionId": "abc123",
        "createdAt": "2024-01-01T00:00:00Z",
        "lastActivity": "2024-01-01T01:00:00Z",
        "ipAddress": "192.168.1.1",
        "userAgent": "Mozilla/5.0...",
        "isActive": true
      }
    ],
    "currentSessionId": "abc123"
  }
}
```

#### Invalidate Other Sessions
```http
POST /api/auth/session/invalidate-others
Cookie: spheroseg.sid=...
```

#### Extend Session
```http
POST /api/auth/session/extend
Cookie: spheroseg.sid=...
```

### Admin Endpoints

#### Session Statistics
```http
GET /api/auth/session/stats
Cookie: spheroseg.sid=...
```

Response:
```json
{
  "success": true,
  "data": {
    "totalSessions": 150,
    "activeSessions": 45,
    "uniqueUsers": 30,
    "averageSessionDuration": 1800000
  }
}
```

## Security Features

### Session Fingerprinting
- Combines user-agent, accept headers
- Detects potential session hijacking
- Triggers re-authentication on mismatch

### IP Tracking
- Records initial login IP
- Monitors for suspicious changes
- Supports proxy headers

### Automatic Cleanup
- Hourly job removes expired sessions
- Prevents session accumulation
- Maintains Redis performance

### Session Limits
- Maximum 5 concurrent sessions per user
- Oldest sessions auto-invalidated
- Configurable per deployment

## Scheduled Jobs

### Session Cleanup (Hourly)
```javascript
// Runs every hour
'0 * * * *' → cleanupExpiredSessions()
```

### Session Statistics (Daily)
```javascript
// Runs at midnight
'0 0 * * *' → reportSessionStatistics()
```

## Monitoring

### Metrics Available
- Total active sessions
- Sessions per user
- Average session duration
- Session creation/destruction rate
- Authentication method distribution

### Health Checks
Redis connectivity is included in health endpoint:
```http
GET /health
```

## Migration from JWT

### Gradual Migration Path

1. **Phase 1**: Both JWT and sessions work (current)
2. **Phase 2**: Prefer sessions, JWT fallback
3. **Phase 3**: Session-only for new features
4. **Phase 4**: Deprecate JWT support

### Client Migration

```javascript
// Old: JWT in Authorization header
headers: {
  'Authorization': `Bearer ${token}`
}

// New: Session cookie (automatic)
credentials: 'include'
```

## Troubleshooting

### Common Issues

1. **Sessions not persisting**
   - Check Redis connectivity
   - Verify cookie settings
   - Ensure `credentials: 'include'` in requests

2. **Frequent logouts**
   - Increase SESSION_TIMEOUT
   - Check for fingerprint changes
   - Verify Redis memory limits

3. **CSRF errors**
   - Ensure CSRF token is included
   - Check cookie domain settings
   - Verify same-site configuration

### Debug Commands

```bash
# Check Redis sessions
docker-compose exec redis redis-cli
> KEYS spheroseg:sess:*
> TTL spheroseg:sess:session-id

# Monitor session creation
docker-compose logs -f backend | grep -i session

# Check session cleanup
docker-compose exec backend npm run session:stats
```

## Best Practices

1. **Security**
   - Use strong session secrets
   - Enable secure cookies in production
   - Implement proper logout functionality
   - Monitor for anomalous session patterns

2. **Performance**
   - Set appropriate TTLs
   - Limit concurrent sessions
   - Use session touch() sparingly
   - Monitor Redis memory usage

3. **User Experience**
   - Provide session management UI
   - Show active devices/sessions
   - Allow selective session invalidation
   - Implement "remember me" properly

## Future Enhancements

1. **Device Management**
   - Device naming and identification
   - Push notifications for new logins
   - Trusted device management

2. **Advanced Security**
   - Geo-location tracking
   - Anomaly detection
   - Risk-based authentication
   - Session encryption

3. **Analytics**
   - Session replay capabilities
   - User journey tracking
   - Engagement metrics
   - A/B testing support