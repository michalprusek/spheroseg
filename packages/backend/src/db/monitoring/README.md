# Database Monitoring Module

A comprehensive solution for monitoring database performance in the SpheroSeg application.

## Features

- **Query Performance Tracking**: Monitors and records all database queries
- **Slow Query Detection**: Identifies and logs queries that exceed performance thresholds
- **Query Pattern Analysis**: Groups similar queries and tracks execution patterns
- **Prometheus Integration**: Exposes metrics to Prometheus for visualization
- **Grafana Dashboard**: Includes pre-built Grafana dashboards for monitoring
- **Admin Interface**: Web-based dashboard to monitor database performance

## Integration Guide

### 1. Update `server.ts`

Add the following imports to the top of `server.ts`:

```typescript
import { setupDatabaseMonitoringComponents } from './server.monitoring.patch';
```

After the line `setupRoutes(app, io);`, add:

```typescript
// Setup database monitoring
setupDatabaseMonitoringComponents(app, io);
```

### 2. Update `routes/index.ts`

Add the following import:

```typescript
import dbMetricsRoutes from './dbMetrics';
```

In the `setupRoutes` function, add:

```typescript
// Database monitoring routes
app.use('/api/db-metrics', dbMetricsRoutes);
```

Also add `dbMetricsRoutes` to the exports list.

### 3. Update Prometheus Configuration

Ensure your Prometheus configuration is set up to scrape the `/api/metrics` endpoint:

```yaml
scrape_configs:
  - job_name: 'spheroseg-backend'
    metrics_path: '/api/metrics'
    static_configs:
      - targets: ['backend:5000']
```

### 4. Import the Grafana Dashboard

Navigate to your Grafana instance and import the dashboard JSON from:
`monitoring/grafana/dashboards/db_performance_dashboard.json`

## Configuration

You can configure the database monitoring module through environment variables:

- `DB_MONITORING_ENABLED`: Set to `true` to enable monitoring (default: `true`)
- `DB_SLOW_QUERY_THRESHOLD_MS`: Time in milliseconds after which a query is considered slow (default: `500`)
- `DB_METRICS_RETENTION_DAYS`: Number of days to retain metrics data (default: `7`)

## API Routes

The database monitoring module adds the following API routes:

- `GET /api/db-metrics/dashboard`: Web-based dashboard for database monitoring
- `GET /api/db-metrics`: Raw Prometheus metrics for database performance
- `GET /api/db-metrics/top-slow`: Get top slow queries
- `GET /api/db-metrics/by-table/:table`: Get queries by table
- `GET /api/db-metrics/frequency`: Get query frequency statistics
- `POST /api/db-metrics/export`: Export query patterns to JSON
- `POST /api/db-metrics/export-dashboard`: Export Grafana dashboard
- `POST /api/db-metrics/reset`: Reset all statistics

## Usage in Code

You can use the database monitoring module directly in your code:

```typescript
import dbMonitoring from '../db/monitoring';

// To execute a monitored query
const result = await dbMonitoring.query('SELECT * FROM users WHERE id = $1', [userId]);

// To execute a transaction with monitoring
const result = await dbMonitoring.withTransaction(async (client) => {
  // Perform transaction operations with client
  return result;
});
```

## Security

Admin routes (`/api/db-metrics/*`) require administrator privileges. Make sure your authentication and authorization middleware is properly set up.