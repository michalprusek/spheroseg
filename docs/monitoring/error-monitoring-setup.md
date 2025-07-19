# Error Monitoring Setup Guide

This guide explains how to set up and configure error monitoring in SpherosegV4.

## Overview

SpherosegV4 includes comprehensive error monitoring capabilities that can track both client-side and server-side errors. The system supports:

- Client-side JavaScript error tracking
- Server-side error logging
- Optional database storage for error reports
- Integration with external monitoring services
- Error statistics and analytics

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│   Frontend  │────►│   Backend   │────►│   Database   │
│  (Browser)  │     │ /api/errors │     │ error_reports│
└─────────────┘     └─────────────┘     └──────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │External Service│
                    │(Sentry, etc.) │
                    └───────────────┘
```

## Configuration

### Frontend Configuration

Add these environment variables to `packages/frontend/.env`:

```bash
# Enable error monitoring
VITE_ENABLE_ERROR_MONITORING=true

# Optional: Configure error sampling rate (0.0 to 1.0)
# VITE_ERROR_SAMPLE_RATE=1.0  # Report all errors

# Optional: Configure error endpoint (defaults to /api/errors)
# VITE_ERROR_ENDPOINT=/api/errors
```

### Backend Configuration

Add these environment variables to `packages/backend/.env`:

```bash
# Enable database storage for error reports
STORE_ERROR_REPORTS=true

# Optional: External monitoring service integration
ERROR_MONITORING_SERVICE_URL=https://your-sentry-instance.com/api/store/
ERROR_MONITORING_API_KEY=your-api-key-here

# Optional: Error retention period (days)
ERROR_RETENTION_DAYS=30
```

## Database Setup

If you enable database storage (`STORE_ERROR_REPORTS=true`), create the error_reports table:

```sql
-- Create error_reports table
CREATE TABLE IF NOT EXISTS error_reports (
    id SERIAL PRIMARY KEY,
    message TEXT NOT NULL,
    stack TEXT,
    source TEXT,
    lineno INTEGER,
    colno INTEGER,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    server_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_agent TEXT NOT NULL,
    url TEXT NOT NULL,
    user_id INTEGER REFERENCES users(id),
    session_id TEXT,
    error_type TEXT,
    severity VARCHAR(20) DEFAULT 'error',
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_error_reports_timestamp ON error_reports(server_timestamp);
CREATE INDEX idx_error_reports_user_id ON error_reports(user_id);
CREATE INDEX idx_error_reports_severity ON error_reports(severity);
CREATE INDEX idx_error_reports_error_type ON error_reports(error_type);

-- Create cleanup function (optional)
CREATE OR REPLACE FUNCTION cleanup_old_error_reports() RETURNS void AS $$
BEGIN
    DELETE FROM error_reports 
    WHERE server_timestamp < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;
```

## Frontend Integration

### Automatic Error Catching

The error monitoring system automatically catches:
- Unhandled JavaScript errors
- Promise rejections
- React error boundaries

### Manual Error Reporting

You can manually report errors from your code:

```typescript
import { reportError } from '@/utils/errorReporting';

try {
    // Your code here
} catch (error) {
    reportError(error, {
        severity: 'error',
        metadata: {
            context: 'user_action',
            action: 'upload_image'
        }
    });
}
```

### React Error Boundary

Wrap your components with error boundaries:

```tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';

function App() {
    return (
        <ErrorBoundary>
            <YourComponent />
        </ErrorBoundary>
    );
}
```

## Backend Integration

### Express Error Handler

The backend automatically logs errors through the Express error handler:

```typescript
// Errors are automatically logged and can be reported
app.use(errorHandler);
```

### Manual Error Reporting

Report errors manually in your routes:

```typescript
import logger from '../utils/logger';

router.post('/api/some-endpoint', async (req, res) => {
    try {
        // Your code
    } catch (error) {
        logger.error('Operation failed', {
            error: error.message,
            stack: error.stack,
            userId: req.userId,
            endpoint: req.path
        });
        
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
```

## Testing Error Monitoring

### 1. Test Environment Variables

```bash
node scripts/test-env-vars.cjs
```

### 2. Test Error Endpoint

```bash
node scripts/test-error-reporting.cjs
```

### 3. Test Frontend Error Reporting

Enable error monitoring and trigger a test error:

```javascript
// In browser console
window.onerror('Test error', 'test.js', 1, 1, new Error('Test error'));
```

### 4. Check Error Stats

```bash
curl http://localhost:5001/api/errors/stats
```

## Monitoring Dashboard

### Error Statistics Endpoint

Access error statistics at `/api/errors/stats`:

```json
{
    "success": true,
    "data": {
        "counts": [
            {
                "severity": "error",
                "error_type": "TypeError",
                "count": 15,
                "unique_users": 5,
                "unique_pages": 3
            }
        ],
        "recent": [...],
        "total24h": 42,
        "total1h": 5,
        "timestamp": "2025-07-19T10:00:00Z"
    }
}
```

### Grafana Integration (Optional)

You can visualize error data using Grafana:

1. Add PostgreSQL data source
2. Create dashboard with queries:

```sql
-- Errors over time
SELECT 
    date_trunc('hour', server_timestamp) as time,
    COUNT(*) as errors
FROM error_reports
WHERE server_timestamp > NOW() - INTERVAL '24 hours'
GROUP BY time
ORDER BY time;

-- Errors by severity
SELECT 
    severity,
    COUNT(*) as count
FROM error_reports
WHERE server_timestamp > NOW() - INTERVAL '24 hours'
GROUP BY severity;
```

## External Service Integration

### Sentry Integration

To integrate with Sentry:

1. Install Sentry SDK:
```bash
npm install @sentry/node @sentry/react
```

2. Configure in your environment:
```bash
ERROR_MONITORING_SERVICE_URL=https://your-project.ingest.sentry.io/api/YOUR_PROJECT_ID/store/
ERROR_MONITORING_API_KEY=your-sentry-dsn
```

3. Initialize in your application:
```typescript
import * as Sentry from '@sentry/react';

Sentry.init({
    dsn: process.env.VITE_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    integrations: [
        new Sentry.BrowserTracing(),
    ],
    tracesSampleRate: 1.0,
});
```

### Other Services

The error reporting endpoint can integrate with:
- Rollbar
- Bugsnag
- LogRocket
- Custom logging services

## Best Practices

### 1. Error Context

Always include context when reporting errors:
- User ID
- Session ID  
- Current URL
- User actions
- Component state

### 2. Error Severity

Use appropriate severity levels:
- `error`: Application errors that need attention
- `warning`: Degraded functionality
- `info`: Informational messages

### 3. PII Protection

Never log sensitive information:
- Passwords
- Credit card numbers
- Personal identification numbers
- API keys

### 4. Rate Limiting

Implement client-side rate limiting to prevent error flooding:

```typescript
const errorCache = new Set();
const ERROR_CACHE_SIZE = 100;

function shouldReportError(error: Error): boolean {
    const key = `${error.message}-${error.stack?.split('\n')[0]}`;
    
    if (errorCache.has(key)) {
        return false;
    }
    
    if (errorCache.size >= ERROR_CACHE_SIZE) {
        errorCache.clear();
    }
    
    errorCache.add(key);
    return true;
}
```

### 5. Error Aggregation

Group similar errors together:
- By error message
- By stack trace similarity
- By error type
- By affected component

## Troubleshooting

### Errors Not Being Reported

1. Check environment variables:
   - Frontend: `VITE_ENABLE_ERROR_MONITORING=true`
   - Backend: Routes properly configured

2. Verify network requests:
   - Check browser DevTools Network tab
   - Look for POST requests to `/api/errors`

3. Check server logs:
   ```bash
   docker-compose logs -f backend | grep error
   ```

### Database Storage Issues

1. Verify table exists:
   ```sql
   \d error_reports
   ```

2. Check environment variable:
   ```bash
   STORE_ERROR_REPORTS=true
   ```

3. Check database permissions

### High Error Volume

1. Implement error sampling:
   ```typescript
   // Only report 10% of errors
   if (Math.random() > 0.1) return;
   ```

2. Add deduplication:
   - Client-side caching
   - Server-side deduplication

3. Set up alerts for error spikes

## Security Considerations

### 1. Authentication

Consider requiring authentication for error reporting:

```typescript
router.post('/api/errors', authenticate, async (req, res) => {
    // Only authenticated users can report errors
});
```

### 2. Rate Limiting

Implement rate limiting to prevent abuse:

```typescript
const errorRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 errors per minute per IP
});

router.post('/api/errors', errorRateLimit, ...);
```

### 3. Input Validation

Validate all error report fields:
- Sanitize error messages
- Validate URLs
- Check timestamp formats
- Limit payload size

### 4. Access Control

Restrict access to error statistics:
- Admin-only access
- API key authentication
- IP whitelisting

## Performance Impact

### Client-Side

- Minimal overhead (~5KB gzipped)
- Asynchronous reporting
- Local caching for offline support
- Batch reporting option

### Server-Side

- Non-blocking error logging
- Efficient database writes
- Background processing for external services
- Automatic cleanup of old errors

## Maintenance

### Regular Tasks

1. **Weekly**: Review error trends
2. **Monthly**: Clean up old errors
3. **Quarterly**: Analyze error patterns
4. **Yearly**: Archive historical data

### Automation

Set up cron jobs for maintenance:

```bash
# Cleanup old errors daily
0 2 * * * psql -U postgres -d spheroseg -c "SELECT cleanup_old_error_reports();"

# Generate weekly reports
0 9 * * 1 node scripts/generate-error-report.js
```

## Conclusion

Error monitoring is a critical component of maintaining application health. By following this guide, you can:

1. Track errors in real-time
2. Identify and fix issues quickly
3. Improve user experience
4. Maintain application stability

Remember to regularly review error reports and act on the insights they provide.