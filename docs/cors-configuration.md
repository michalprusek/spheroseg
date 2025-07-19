# CORS Configuration Guide

## Overview

SpherosegV4 implements a strict CORS (Cross-Origin Resource Sharing) configuration with whitelist validation to ensure only trusted origins can access the API. The system provides comprehensive security while maintaining flexibility for different deployment environments.

## Features

- **Strict Origin Whitelist**: Only explicitly allowed origins can make cross-origin requests
- **Pattern-Based Matching**: Support for regex patterns to match multiple subdomains
- **Environment-Specific Configuration**: Different rules for development, staging, and production
- **Origin Validation**: Validates origin structure to prevent malformed requests
- **Request Logging**: All CORS requests are logged for security monitoring
- **Dynamic Configuration**: Additional origins can be added via environment variables
- **Preflight Caching**: Optimized preflight request handling

## Configuration

### Environment Variables

```bash
# Production domain (required in production)
PRODUCTION_DOMAIN=example.com

# Staging domain (optional)
STAGING_DOMAIN=staging.example.com

# Additional allowed origins (comma-separated)
CORS_ALLOWED_ORIGINS=https://app.example.com,https://mobile.example.com

# CORS settings (optional)
CORS_MAX_AGE=86400              # Preflight cache duration (seconds)
CORS_ALLOW_CREDENTIALS=true     # Allow credentials in CORS requests
```

### Default Whitelist

The following origins are allowed by default:

#### Development
- `http://localhost` (any port)
- `http://127.0.0.1` (any port)

#### Production
- `https://${PRODUCTION_DOMAIN}`
- `https://www.${PRODUCTION_DOMAIN}`

#### Staging
- `https://${STAGING_DOMAIN}`

### Adding Custom Origins

1. **Via Environment Variable** (Recommended)
   ```bash
   CORS_ALLOWED_ORIGINS=https://partner.com,https://mobile.example.com
   ```

2. **In Code** (Not recommended for production)
   ```typescript
   // In cors.enhanced.ts
   const ORIGIN_WHITELIST: OriginPattern[] = [
     // ... existing patterns
     {
       pattern: /^https:\/\/custom\.domain\.com$/,
       description: 'Custom partner domain',
       allowCredentials: true,
     },
   ];
   ```

## Origin Validation Rules

All origins must meet the following criteria:

1. **Valid Protocol**: Only `http://` or `https://` allowed
2. **No Credentials**: Origins with username/password are rejected
3. **No Path**: Origins must not include paths (e.g., `/api`)
4. **Valid Structure**: Must be a properly formatted URL

### Valid Origins
- ✅ `https://example.com`
- ✅ `https://www.example.com`
- ✅ `http://localhost:3000`
- ✅ `https://api.example.com`

### Invalid Origins
- ❌ `https://example.com/path` (contains path)
- ❌ `ftp://example.com` (invalid protocol)
- ❌ `https://user:pass@example.com` (contains credentials)
- ❌ `example.com` (missing protocol)

## Security Headers

The CORS middleware sets the following headers:

### Allowed Headers (Request)
- `Content-Type`
- `Authorization`
- `X-CSRF-Token`
- `X-Request-ID`
- `X-RateLimit-*` (rate limit headers)

### Exposed Headers (Response)
- `X-Total-Count` (pagination)
- `X-Page` (pagination)
- `X-Per-Page` (pagination)
- `X-Request-ID` (request tracking)
- `X-RateLimit-*` (rate limit info)

### Methods
- `GET`
- `POST`
- `PUT`
- `DELETE`
- `PATCH`
- `OPTIONS` (preflight)

## API Endpoints

### Get CORS Configuration
```http
GET /api/cors/config
Authorization: Bearer <admin-token>

Response:
{
  "success": true,
  "data": {
    "whitelist": [
      {
        "pattern": "/^http:\\/\\/localhost(:\\d+)?$/",
        "description": "Local development",
        "allowCredentials": true
      }
    ],
    "additionalOrigins": ["https://app.example.com"],
    "environment": "production",
    "settings": {
      "maxAge": 86400,
      "credentials": true,
      "methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
    }
  }
}
```

### Validate Configuration
```http
POST /api/cors/validate
Authorization: Bearer <admin-token>

Response:
{
  "success": true,
  "message": "CORS configuration is valid",
  "data": {
    "validatedAt": "2024-01-19T12:00:00.000Z"
  }
}
```

### Test Origin
```http
POST /api/cors/test
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "origin": "https://app.example.com"
}

Response:
{
  "success": true,
  "data": {
    "origin": "https://app.example.com",
    "allowed": true,
    "pattern": "Additional allowed origin",
    "allowCredentials": true,
    "testedAt": "2024-01-19T12:00:00.000Z"
  }
}
```

### Get CORS Statistics
```http
GET /api/cors/stats?startTime=2024-01-19T00:00:00Z
Authorization: Bearer <admin-token>

Response:
{
  "success": true,
  "data": {
    "stats": {
      "totalRequests": 10000,
      "allowedRequests": 9950,
      "blockedRequests": 50,
      "uniqueOrigins": ["https://app.example.com", "https://www.example.com"],
      "topOrigins": [
        { "origin": "https://app.example.com", "count": 8000 },
        { "origin": "https://www.example.com", "count": 1950 }
      ],
      "blockedOrigins": [
        { "origin": "https://evil.com", "count": 50 }
      ]
    }
  }
}
```

## Implementation Example

### Frontend Configuration

```typescript
// Frontend API client configuration
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  withCredentials: true, // Important for CORS with credentials
  headers: {
    'Content-Type': 'application/json',
  },
});

// Handle CORS errors
apiClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 0) {
      // CORS error - origin not allowed
      console.error('CORS error: Origin not allowed');
    }
    return Promise.reject(error);
  }
);
```

### Testing CORS Locally

1. **Test with curl**:
   ```bash
   # Test preflight request
   curl -X OPTIONS http://localhost:5001/api/users \
     -H "Origin: https://example.com" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Authorization" \
     -v
   
   # Test actual request
   curl http://localhost:5001/api/users \
     -H "Origin: https://example.com" \
     -H "Authorization: Bearer token" \
     -v
   ```

2. **Test with browser console**:
   ```javascript
   fetch('http://localhost:5001/api/users', {
     method: 'GET',
     credentials: 'include',
     headers: {
       'Authorization': 'Bearer token'
     }
   }).then(r => r.json()).then(console.log);
   ```

## Troubleshooting

### Common Issues

1. **"Origin not allowed by CORS policy"**
   - Check if origin is in whitelist
   - Verify origin format (no trailing slash, no path)
   - Check environment variables are loaded

2. **"Invalid origin format"**
   - Ensure origin has protocol (http:// or https://)
   - Remove any paths from origin
   - Remove credentials from URL

3. **Preflight requests failing**
   - Check allowed methods include the request method
   - Verify allowed headers include all request headers
   - Check max age setting for preflight caching

4. **Credentials not working**
   - Ensure `withCredentials: true` in frontend
   - Verify origin allows credentials in whitelist
   - Check cookies have correct SameSite settings

### Debug Mode

Enable CORS debug logging:

```bash
# In backend .env
LOG_LEVEL=debug
CORS_DEBUG=true
```

This will log:
- All CORS requests with origins
- Whitelist matching results
- Blocked requests with reasons

## Security Best Practices

1. **Never use wildcard (*) origins in production**
   - Always explicitly whitelist trusted origins
   - Use pattern matching for subdomains if needed

2. **Validate origin structure**
   - Reject malformed origins immediately
   - Log suspicious requests for monitoring

3. **Use HTTPS in production**
   - Only allow HTTPS origins in production
   - HTTP should only be used for local development

4. **Limit exposed headers**
   - Only expose headers that frontend needs
   - Avoid exposing sensitive server information

5. **Monitor CORS violations**
   - Set up alerts for repeated CORS failures
   - Track blocked origins for security analysis

6. **Regular audits**
   - Review allowed origins periodically
   - Remove unused origins
   - Check for overly permissive patterns

## Migration from Old CORS

If migrating from a less restrictive CORS setup:

1. **Audit current origins**:
   ```bash
   # Check access logs for Origin headers
   grep "Origin:" /var/log/nginx/access.log | sort | uniq
   ```

2. **Add origins gradually**:
   - Start with known production domains
   - Add partner domains as needed
   - Monitor for blocked legitimate origins

3. **Test thoroughly**:
   - Test all frontend environments
   - Verify mobile apps if applicable
   - Check third-party integrations

4. **Implement monitoring**:
   - Set up alerts for CORS blocks
   - Track metrics for analysis
   - Plan for gradual rollout

## Performance Considerations

1. **Preflight Caching**
   - Set appropriate max-age (86400 for production)
   - Reduces OPTIONS requests

2. **Origin Validation**
   - Pattern matching is fast with RegExp
   - Structure validation prevents complex parsing

3. **Logging Impact**
   - Use debug level for detailed logs
   - Aggregate logs for analysis
   - Consider sampling in high-traffic scenarios