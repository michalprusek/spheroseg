# Performance Monitoring Guide

Comprehensive guide for monitoring and optimizing SpherosegV4 application performance.

## Overview

SpherosegV4 includes built-in performance monitoring capabilities that track:

- **Frontend Performance**: React rendering, component updates, resource loading
- **Backend Performance**: API response times, database queries, memory usage
- **Core Web Vitals**: LCP, FID, CLS, TTFB, FCP
- **Custom Metrics**: Business-specific performance indicators

## Performance Metrics Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────┐
│    Frontend     │────►│    Backend      │────►│   Database   │
│  Web Vitals     │     │ /api/metrics    │     │   Metrics    │
│  React Metrics  │     │ Performance API │     │   Storage    │
└─────────────────┘     └─────────────────┘     └──────────────┘
         │                        │                      │
         └────────────────────────┴──────────────────────┘
                                 │
                         ┌───────▼────────┐
                         │   Monitoring   │
                         │   Dashboard    │
                         └────────────────┘
```

## Configuration

### Frontend Performance Monitoring

Configure in `packages/frontend/.env`:

```bash
# Enable performance monitoring
VITE_ENABLE_PERFORMANCE_METRICS=true

# Enable specific metric types
VITE_ENABLE_FRONTEND_METRICS=true    # React component metrics
VITE_ENABLE_WEB_VITALS_METRICS=true  # Core Web Vitals
VITE_ENABLE_IMAGE_METRICS=true       # Image loading performance

# Performance thresholds (optional)
VITE_PERF_LCP_THRESHOLD=2500         # Largest Contentful Paint (ms)
VITE_PERF_FID_THRESHOLD=100          # First Input Delay (ms)
VITE_PERF_CLS_THRESHOLD=0.1          # Cumulative Layout Shift
VITE_PERF_TTFB_THRESHOLD=800         # Time to First Byte (ms)
```

### Backend Performance Monitoring

Configure in `packages/backend/.env`:

```bash
# Enable performance monitoring
ENABLE_PERFORMANCE_MONITORING=true
PERFORMANCE_LOG_LEVEL=info           # debug, info, warn, error

# Performance thresholds
SLOW_QUERY_THRESHOLD=100             # Log queries slower than 100ms
SLOW_REQUEST_THRESHOLD=1000          # Log requests slower than 1s
MEMORY_WARNING_THRESHOLD=400         # Warn at 400MB memory usage
MEMORY_CRITICAL_THRESHOLD=450        # Critical at 450MB

# Monitoring intervals
METRICS_COLLECTION_INTERVAL=60000    # Collect metrics every minute
HEALTH_CHECK_INTERVAL=30000          # Health check every 30s
```

## Core Web Vitals

### What are Core Web Vitals?

Core Web Vitals are Google's metrics for measuring user experience:

1. **LCP (Largest Contentful Paint)**: Loading performance
   - Good: < 2.5s
   - Needs Improvement: 2.5s - 4s
   - Poor: > 4s

2. **FID (First Input Delay)**: Interactivity
   - Good: < 100ms
   - Needs Improvement: 100ms - 300ms
   - Poor: > 300ms

3. **CLS (Cumulative Layout Shift)**: Visual stability
   - Good: < 0.1
   - Needs Improvement: 0.1 - 0.25
   - Poor: > 0.25

4. **Additional Metrics**:
   - **TTFB**: Time to First Byte (server response)
   - **FCP**: First Contentful Paint (first render)

### Collecting Web Vitals

Web Vitals are automatically collected when enabled. The data is sent to `/api/metrics/vitals`.

Example data structure:
```json
{
    "name": "LCP",
    "value": 2341.5,
    "id": "v2-1234567890-123456789",
    "delta": 2341.5,
    "entries": [...],
    "navigationType": "navigate",
    "rating": "good"
}
```

## Frontend Performance Tracking

### React Component Performance

Track component render performance:

```typescript
import { usePerformanceTracking } from '@/services/performanceMetrics';

function MyComponent() {
    const { trackEvent } = usePerformanceTracking('MyComponent');
    
    const handleClick = () => {
        const startTime = performance.now();
        
        // Expensive operation
        processData();
        
        trackEvent('data_processing', performance.now() - startTime);
    };
    
    return <div>...</div>;
}
```

### Resource Loading Performance

Monitor image and asset loading:

```typescript
import { useImageLoadPerformance } from '@/utils/performance';

function ImageGallery({ images }) {
    const trackImageLoad = useImageLoadPerformance();
    
    return (
        <div>
            {images.map(img => (
                <img
                    key={img.id}
                    src={img.url}
                    onLoad={trackImageLoad(img.url)}
                />
            ))}
        </div>
    );
}
```

### Custom Performance Metrics

Track business-specific metrics:

```typescript
import performanceMetrics from '@/services/performanceMetrics';

// Track segmentation processing time
const startTime = performance.now();
await processSegmentation(imageId);
const duration = performance.now() - startTime;

performanceMetrics.track({
    name: 'segmentation_processing',
    value: duration,
    unit: 'ms',
    timestamp: Date.now(),
    metadata: {
        imageId,
        imageSize: file.size,
        algorithm: 'resnet'
    }
});
```

## Backend Performance Tracking

### API Endpoint Performance

Automatic tracking via middleware:

```typescript
// Automatically tracks all routes
app.use(performanceMiddleware());

// Custom tracking in routes
router.post('/api/process', async (req, res) => {
    const timer = startTimer();
    
    try {
        const result = await heavyProcessing();
        
        // Track custom metric
        trackMetric('processing_time', timer.end(), {
            operation: 'heavy_processing',
            dataSize: req.body.length
        });
        
        res.json({ success: true, result });
    } catch (error) {
        timer.end(); // Still track failed operations
        throw error;
    }
});
```

### Database Query Performance

Monitor query performance:

```typescript
// Automatic query tracking
const result = await db.query(
    'SELECT * FROM images WHERE project_id = $1',
    [projectId]
);
// Query time automatically logged if > SLOW_QUERY_THRESHOLD

// Manual tracking for complex operations
const timer = startTimer();
await db.withTransaction(async (client) => {
    // Multiple queries
});
trackMetric('transaction_time', timer.end());
```

### Memory Usage Monitoring

Track memory usage and garbage collection:

```typescript
// Automatic memory monitoring
if (memoryUsage > MEMORY_WARNING_THRESHOLD) {
    logger.warn('High memory usage detected', {
        heapUsed: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal,
        external: process.memoryUsage().external
    });
}

// Manual garbage collection (if needed)
if (global.gc && memoryPressure) {
    global.gc();
    trackMetric('gc_triggered', 1);
}
```

## Performance Testing

### 1. Load Testing

Test with realistic load:

```bash
# Run performance tests
npm run test:performance

# Load test with k6
k6 run scripts/load-test.js
```

Example k6 script:
```javascript
import http from 'k6/http';
import { check } from 'k6';

export let options = {
    stages: [
        { duration: '30s', target: 20 },
        { duration: '1m', target: 20 },
        { duration: '30s', target: 0 },
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'],
    },
};

export default function() {
    let response = http.get('http://localhost:5001/api/health');
    check(response, {
        'status is 200': (r) => r.status === 200,
        'response time < 500ms': (r) => r.timings.duration < 500,
    });
}
```

### 2. Frontend Performance Testing

Use Lighthouse CI:

```bash
# Install Lighthouse CI
npm install -g @lhci/cli

# Run Lighthouse
lhci autorun
```

Configuration (`.lighthouserc.js`):
```javascript
module.exports = {
    ci: {
        collect: {
            url: ['http://localhost:3000'],
            numberOfRuns: 3,
        },
        assert: {
            assertions: {
                'categories:performance': ['warn', { minScore: 0.9 }],
                'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
                'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
                'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
            },
        },
    },
};
```

### 3. Database Performance Testing

Test query performance:

```sql
-- Enable query timing
\timing on

-- Test with EXPLAIN ANALYZE
EXPLAIN ANALYZE
SELECT 
    i.*,
    COUNT(c.id) as cell_count
FROM images i
LEFT JOIN cells c ON c.image_id = i.id
WHERE i.project_id = 1
GROUP BY i.id;

-- Check for missing indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY schemaname, tablename;
```

## Performance Dashboards

### 1. Built-in Monitoring Dashboard

Access at `/api/monitoring/dashboard`:

```json
{
    "performance": {
        "avgResponseTime": 87.5,
        "p95ResponseTime": 145.2,
        "p99ResponseTime": 487.3,
        "requestsPerSecond": 24.5
    },
    "resources": {
        "cpuUsage": 34.2,
        "memoryUsage": 287.4,
        "activeConnections": 12
    },
    "database": {
        "activeQueries": 3,
        "avgQueryTime": 12.4,
        "connectionPool": {
            "active": 5,
            "idle": 15,
            "waiting": 0
        }
    }
}
```

### 2. Grafana Integration

Create Grafana dashboards with these queries:

```sql
-- API Response Times
SELECT 
    date_trunc('minute', timestamp) as time,
    AVG(response_time) as avg_response_time,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time) as p95,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time) as p99
FROM api_metrics
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY time
ORDER BY time;

-- Web Vitals
SELECT 
    date_trunc('hour', timestamp) as time,
    metric_name,
    AVG(value) as avg_value,
    COUNT(*) as sample_count
FROM web_vitals
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY time, metric_name
ORDER BY time, metric_name;
```

### 3. Real User Monitoring (RUM)

Collect real user performance data:

```typescript
// Collect and send RUM data
window.addEventListener('load', () => {
    // Navigation timing
    const navTiming = performance.getEntriesByType('navigation')[0];
    
    // Paint timing
    const paintTiming = performance.getEntriesByType('paint');
    
    // Send to analytics
    sendMetrics({
        pageLoad: navTiming.loadEventEnd - navTiming.fetchStart,
        domReady: navTiming.domContentLoadedEventEnd - navTiming.fetchStart,
        firstPaint: paintTiming.find(p => p.name === 'first-paint')?.startTime,
        firstContentfulPaint: paintTiming.find(p => p.name === 'first-contentful-paint')?.startTime
    });
});
```

## Performance Optimization Techniques

### 1. Frontend Optimizations

#### Code Splitting
```typescript
// Route-based splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));

// Component-based splitting
const HeavyComponent = lazy(() => 
    import(/* webpackChunkName: "heavy-component" */ './components/HeavyComponent')
);
```

#### Memoization
```typescript
// Memoize expensive computations
const expensiveValue = useMemo(() => {
    return computeExpensiveValue(data);
}, [data]);

// Memoize components
const MemoizedComponent = React.memo(Component, (prevProps, nextProps) => {
    return prevProps.id === nextProps.id;
});
```

#### Virtual Scrolling
```typescript
import { VirtualList } from '@/components/VirtualList';

function LargeList({ items }) {
    return (
        <VirtualList
            items={items}
            itemHeight={50}
            renderItem={(item) => <ListItem item={item} />}
        />
    );
}
```

### 2. Backend Optimizations

#### Query Optimization
```typescript
// Use CTEs for complex queries
const optimizedQuery = `
    WITH project_stats AS (
        SELECT 
            project_id,
            COUNT(*) as image_count
        FROM images
        GROUP BY project_id
    )
    SELECT p.*, ps.image_count
    FROM projects p
    JOIN project_stats ps ON p.id = ps.project_id
    WHERE p.user_id = $1
`;

// Use proper indexes
await db.query(`
    CREATE INDEX CONCURRENTLY idx_images_project_status 
    ON images(project_id, segmentation_status)
`);
```

#### Caching Strategy
```typescript
// Cache frequently accessed data
const cachedUser = await cache.get(`user:${userId}`);
if (!cachedUser) {
    const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    await cache.set(`user:${userId}`, user, 300); // 5 minutes
}

// Cache API responses
router.get('/api/stats', cache.middleware(300), async (req, res) => {
    const stats = await calculateStats();
    res.json(stats);
});
```

#### Connection Pooling
```typescript
// Optimize database connections
const pool = new Pool({
    max: 20,                  // Maximum connections
    idleTimeoutMillis: 30000, // Close idle connections
    connectionTimeoutMillis: 2000,
});

// Reuse connections
const client = await pool.connect();
try {
    await client.query('BEGIN');
    // Multiple queries using same connection
    await client.query('COMMIT');
} finally {
    client.release();
}
```

### 3. Image Optimization

#### Lazy Loading
```typescript
function ImageGallery({ images }) {
    return (
        <div>
            {images.map(img => (
                <img
                    key={img.id}
                    data-src={img.url}
                    className="lazyload"
                    loading="lazy"
                />
            ))}
        </div>
    );
}
```

#### Responsive Images
```typescript
<picture>
    <source
        srcSet={`${img.url}?w=400 400w, ${img.url}?w=800 800w`}
        sizes="(max-width: 600px) 400px, 800px"
    />
    <img src={img.url} alt={img.alt} />
</picture>
```

## Performance Budgets

Set performance budgets to maintain standards:

```javascript
// webpack.config.js
module.exports = {
    performance: {
        hints: 'warning',
        maxEntrypointSize: 512000,  // 500KB
        maxAssetSize: 256000,       // 250KB
        assetFilter: (assetFilename) => {
            return assetFilename.endsWith('.js');
        },
    },
};
```

## Alerts and Notifications

### Setting Up Alerts

Configure alerts for performance degradation:

```typescript
// Backend alert configuration
if (avgResponseTime > 500) {
    sendAlert({
        type: 'performance',
        severity: 'warning',
        message: `High average response time: ${avgResponseTime}ms`,
        threshold: 500,
        current: avgResponseTime
    });
}

// Frontend alert
if (webVitals.LCP > 4000) {
    reportToMonitoring({
        metric: 'LCP',
        value: webVitals.LCP,
        severity: 'critical',
        page: window.location.pathname
    });
}
```

### Alert Channels

1. **Email Alerts**: Critical performance issues
2. **Slack Notifications**: Warning-level alerts
3. **Dashboard Warnings**: Real-time visual indicators
4. **Log Aggregation**: Centralized performance logs

## Best Practices

### 1. Continuous Monitoring

- Monitor in production, not just development
- Set up automated performance tests
- Track performance trends over time
- Establish performance budgets

### 2. User-Centric Metrics

Focus on metrics that matter to users:
- Page load time
- Time to interactive
- Response to user input
- Visual stability

### 3. Progressive Enhancement

- Start with a fast baseline
- Add features without degrading performance
- Use feature flags to test impact
- Roll back if performance degrades

### 4. Regular Audits

Schedule regular performance audits:
- Weekly: Review performance dashboards
- Monthly: Run Lighthouse audits
- Quarterly: Comprehensive performance review
- Yearly: Review and update performance budgets

## Troubleshooting Performance Issues

### High Memory Usage

1. Check for memory leaks:
```bash
node --inspect app.js
# Use Chrome DevTools Memory Profiler
```

2. Analyze heap dumps:
```javascript
const v8 = require('v8');
v8.writeHeapSnapshot('heap.heapsnapshot');
```

3. Monitor garbage collection:
```bash
node --trace-gc app.js
```

### Slow API Responses

1. Enable query logging:
```sql
SET log_min_duration_statement = 100; -- Log queries over 100ms
```

2. Use query explain plans:
```sql
EXPLAIN (ANALYZE, BUFFERS) SELECT ...;
```

3. Check for N+1 queries:
```typescript
// Bad: N+1 queries
const projects = await getProjects();
for (const project of projects) {
    project.images = await getImagesByProject(project.id);
}

// Good: Single query with join
const projectsWithImages = await getProjectsWithImages();
```

### Frontend Performance Issues

1. Use React DevTools Profiler
2. Check for unnecessary re-renders
3. Analyze bundle size:
```bash
npm run build -- --stats
webpack-bundle-analyzer stats.json
```

## Conclusion

Performance monitoring is essential for maintaining a fast, responsive application. By implementing comprehensive monitoring:

1. **Detect Issues Early**: Before users complain
2. **Make Data-Driven Decisions**: Based on real metrics
3. **Maintain Standards**: Through performance budgets
4. **Improve User Experience**: By focusing on what matters

Remember: Performance is a feature, not an afterthought. Monitor continuously, optimize iteratively, and always measure the impact of changes.