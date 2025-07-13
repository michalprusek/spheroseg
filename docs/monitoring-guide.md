# Performance Monitoring Guide

## Overview

This guide provides instructions for monitoring the performance improvements implemented in SpherosegV4. It covers database performance, API response times, frontend metrics, and image processing efficiency.

## Monitoring Stack

### 1. Built-in Monitoring Endpoints

#### Performance Metrics Endpoint
```bash
GET /api/performance/metrics
```

Returns comprehensive performance data:
```json
{
  "memory": {
    "used": 245,
    "limit": 1024,
    "percentage": 23.9
  },
  "database": {
    "activeConnections": 5,
    "idleConnections": 15,
    "queryStats": {
      "averageTime": 45,
      "slowQueries": 2
    }
  },
  "api": {
    "requestsPerMinute": 120,
    "averageResponseTime": 85,
    "errorRate": 0.02
  },
  "imageProcessing": {
    "queueLength": 12,
    "processingRate": 3.5,
    "averageProcessingTime": 2800
  }
}
```

#### Health Check Endpoint
```bash
GET /api/health
```

### 2. Database Performance Monitoring

#### Query Performance Analysis
```sql
-- Check index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Find slow queries
SELECT 
    query,
    mean_exec_time,
    calls,
    total_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Check table statistics
SELECT 
    schemaname,
    tablename,
    n_live_tup,
    n_dead_tup,
    last_vacuum,
    last_autovacuum
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
```

#### Monitor Index Effectiveness
```sql
-- Check if new indexes are being used
SELECT 
    indexrelname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE indexrelname IN (
    'idx_users_email',
    'idx_users_storage',
    'idx_images_storage_filename',
    'idx_images_name',
    'idx_images_project_name'
)
ORDER BY idx_scan DESC;
```

### 3. Frontend Performance Monitoring

#### Bundle Size Analysis
```bash
# Generate bundle analysis
cd packages/frontend
npm run build -- --analyze

# Check bundle sizes
ls -lah dist/assets/*.js | awk '{print $5, $9}' | sort -h
```

#### Lighthouse CI Setup
```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI
on: [push, pull_request]
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Lighthouse
        uses: treosh/lighthouse-ci-action@v9
        with:
          urls: |
            http://localhost:3000
            http://localhost:3000/projects
          budgetPath: ./lighthouse-budget.json
          temporaryPublicStorage: true
```

#### Performance Budget
```json
// lighthouse-budget.json
{
  "budgets": [
    {
      "resourceSizes": [
        {
          "resourceType": "script",
          "budget": 300
        },
        {
          "resourceType": "total",
          "budget": 1200
        }
      ],
      "resourceCounts": [
        {
          "resourceType": "third-party",
          "budget": 10
        }
      ]
    }
  ]
}
```

### 4. Image Processing Monitoring

#### Queue Statistics
```typescript
// Monitor image processing queue
const queueStats = imageProcessingQueue.getStats();
console.log('Queue Statistics:', {
  pending: queueStats.pending,
  processing: queueStats.processing,
  completed: queueStats.completed,
  failed: queueStats.failed,
  throughput: queueStats.completed / (Date.now() - startTime) * 1000 * 60 // per minute
});
```

#### WebP Conversion Metrics
```typescript
// Track format conversion savings
interface ConversionMetrics {
  originalSize: number;
  webpSize: number;
  savingsPercent: number;
  conversionTime: number;
}

// Log conversion metrics
logger.info('Image conversion metrics', {
  format: 'webp',
  originalSize: originalStats.size,
  optimizedSize: optimizedStats.size,
  savings: ((1 - optimizedStats.size / originalStats.size) * 100).toFixed(2) + '%',
  time: conversionTime
});
```

### 5. Docker Container Monitoring

#### Real-time Resource Usage
```bash
# Monitor all containers
docker stats

# Monitor specific service
docker stats spheroseg_backend_1 spheroseg_ml_1 spheroseg_db_1

# Export metrics in JSON
docker stats --no-stream --format "table {{json .}}" > docker-stats.json
```

#### Container Health Checks
```yaml
# docker-compose.yml additions
services:
  backend:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### 6. Grafana + Prometheus Setup

#### Prometheus Configuration
```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'spheroseg-backend'
    static_configs:
      - targets: ['backend:5001']
    metrics_path: '/api/metrics'
    
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
```

#### Key Metrics to Track

1. **Database Performance**
   - Query execution time (p50, p95, p99)
   - Connection pool utilization
   - Index scan rate
   - Cache hit ratio

2. **API Performance**
   - Request rate
   - Response time distribution
   - Error rate by endpoint
   - Concurrent connections

3. **Image Processing**
   - Queue length over time
   - Processing time by image size
   - Format conversion savings
   - Memory usage during processing

4. **Frontend Performance**
   - Page load time
   - Time to Interactive (TTI)
   - First Contentful Paint (FCP)
   - Bundle cache hit rate

### 7. Alerting Rules

#### Prometheus Alert Rules
```yaml
groups:
  - name: spheroseg
    rules:
      - alert: HighQueryTime
        expr: pg_stat_statements_mean_exec_time_seconds > 0.5
        for: 5m
        annotations:
          summary: "Database query taking too long"
          
      - alert: ImageQueueBacklog
        expr: spheroseg_queue_pending > 100
        for: 10m
        annotations:
          summary: "Image processing queue backing up"
          
      - alert: HighMemoryUsage
        expr: process_resident_memory_bytes / spheroseg_memory_limit > 0.9
        for: 5m
        annotations:
          summary: "Container approaching memory limit"
```

### 8. Performance Testing Scripts

#### Load Testing with k6
```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 50 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.1'],
  },
};

export default function() {
  // Test image upload
  let response = http.get('http://localhost:5001/api/health');
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  sleep(1);
}
```

### 9. Logging Best Practices

#### Structured Logging
```typescript
// Use structured logging for metrics
logger.info('performance.metric', {
  category: 'database',
  operation: 'user_query',
  duration: queryTime,
  query: queryName,
  resultCount: results.length,
  cached: false
});
```

#### Log Aggregation
```bash
# Parse performance logs
grep "performance.metric" app.log | \
  jq -r '. | select(.category == "database") | .duration' | \
  awk '{sum+=$1; count++} END {print "Average:", sum/count, "ms"}'
```

### 10. Continuous Monitoring Checklist

#### Daily Checks
- [ ] Review error rates in logs
- [ ] Check queue processing times
- [ ] Monitor memory usage trends
- [ ] Verify cache hit rates

#### Weekly Reviews
- [ ] Analyze slow query logs
- [ ] Review bundle size changes
- [ ] Check index usage statistics
- [ ] Evaluate WebP conversion rates

#### Monthly Analysis
- [ ] Performance regression testing
- [ ] Database vacuum and reindex
- [ ] Update performance budgets
- [ ] Review and adjust alert thresholds

## Troubleshooting Guide

### High Database Query Times
1. Check index usage with `pg_stat_user_indexes`
2. Run `EXPLAIN ANALYZE` on slow queries
3. Verify connection pool settings
4. Check for lock contention

### Frontend Performance Issues
1. Run Lighthouse audit
2. Check for render-blocking resources
3. Verify lazy loading is working
4. Analyze network waterfall

### Image Processing Bottlenecks
1. Check queue concurrency settings
2. Monitor memory during processing
3. Verify GPU utilization (ML service)
4. Check for disk I/O bottlenecks

## Reporting

Generate monthly performance reports including:
- Query performance improvements
- Bundle size trends
- Image processing throughput
- Error rate analysis
- Cost savings from optimizations

Store reports in `/docs/performance-reports/YYYY-MM.md`