# Business Metrics and Alerting System

## Overview

SpherosegV4 includes a comprehensive business metrics collection and alerting system that monitors key performance indicators (KPIs) and sends alerts when thresholds are exceeded or anomalies are detected.

## Features

- **Real-time Metric Collection**: Automatic collection of business metrics at configurable intervals
- **Multiple Alert Channels**: Email, Slack, webhook, and console alerts
- **Threshold Monitoring**: Warning and critical thresholds for each metric
- **Trend Analysis**: Detect significant increases or decreases over time
- **Anomaly Detection**: Statistical anomaly detection using z-score analysis
- **Alert Management**: Dashboard for viewing and acknowledging alerts
- **Metric History**: Historical data storage for trend analysis

## Default Metrics

### Processing Metrics

1. **Processing Failure Rate** (`processing_failure_rate`)
   - Description: Percentage of failed image processing jobs
   - Unit: Percentage
   - Thresholds: Warning at 5%, Critical at 10%
   - Collection: Every 5 minutes

2. **Average Processing Time** (`avg_processing_time`)
   - Description: Average time to process an image
   - Unit: Seconds
   - Thresholds: Warning at 300s (5 min), Critical at 600s (10 min)
   - Collection: Every 10 minutes

3. **Queue Backlog** (`queue_backlog`)
   - Description: Number of items waiting in processing queue
   - Unit: Count
   - Thresholds: Warning at 100, Critical at 500
   - Collection: Every 5 minutes

4. **Segmentation Accuracy** (`segmentation_accuracy`)
   - Description: Average segmentation accuracy score
   - Unit: Percentage
   - Thresholds: Warning below 85%
   - Collection: Every 30 minutes

### User Metrics

5. **User Error Rate** (`user_error_rate`)
   - Description: Number of user errors per hour
   - Unit: Count
   - Thresholds: Warning at 50/hour, Critical at 100/hour
   - Collection: Every 5 minutes

6. **Active Users** (`active_users`)
   - Description: Number of active users in the last hour
   - Unit: Count
   - Trend Alert: 50% decrease triggers warning
   - Collection: Every 15 minutes

### Infrastructure Metrics

7. **Storage Usage** (`storage_usage`)
   - Description: Total storage used by images
   - Unit: Gigabytes
   - Thresholds: Warning at 1TB, Critical at 2TB
   - Collection: Every hour

8. **API Response Time P95** (`api_response_time_p95`)
   - Description: 95th percentile API response time
   - Unit: Milliseconds
   - Thresholds: Warning at 1000ms, Critical at 3000ms
   - Collection: Every 5 minutes

## Alert Types

### 1. Threshold Alerts
Triggered when a metric exceeds configured warning or critical thresholds.

### 2. Trend Alerts
Triggered when a metric changes significantly over a time window:
- Increase alerts: When metric increases by configured percentage
- Decrease alerts: When metric decreases by configured percentage

### 3. Anomaly Alerts
Triggered when a metric value is statistically anomalous (z-score > 3).

## Configuration

### Environment Variables

```bash
# Email Alerts
ALERT_EMAIL_ENABLED=true
ALERT_EMAIL_RECIPIENTS=admin@example.com,ops@example.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=alerts@example.com
SMTP_PASS=your-password
EMAIL_FROM=alerts@spheroseg.com

# Slack Alerts
ALERT_SLACK_ENABLED=true
ALERT_SLACK_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
ALERT_SLACK_CHANNEL=#alerts
ALERT_SLACK_USERNAME=SpherosegV4 Alerts

# Webhook Alerts
ALERT_WEBHOOK_ENABLED=true
ALERT_WEBHOOK_URL=https://your-webhook-endpoint.com/alerts
ALERT_WEBHOOK_HEADERS={"Authorization": "Bearer your-token"}

# Console Alerts (Development)
ALERT_CONSOLE_ENABLED=true
```

## API Endpoints

### Get Dashboard Data
```
GET /api/metrics/dashboard/data
Authorization: Bearer <token>
```

Returns all metrics with current values, statistics, and active alerts.

### Get Metric Value
```
GET /api/metrics/:metricName
Authorization: Bearer <token>
```

### Get Metric History
```
GET /api/metrics/:metricName/history?start=2025-01-01T00:00:00Z&end=2025-01-02T00:00:00Z
Authorization: Bearer <token>
```

### Get Active Alerts
```
GET /api/metrics/alerts/active?severity=warning
Authorization: Bearer <token>
```

### Acknowledge Alert
```
POST /api/metrics/alerts/:alertId/acknowledge
Authorization: Bearer <token>
```

### Manually Collect Metric
```
POST /api/metrics/:metricName/collect
Authorization: Bearer <token>
```

## Alert Format Examples

### Email Alert
```
Subject: [WARNING] processing_failure_rate: Percentage of failed image processing jobs exceeded warning threshold

Metric: processing_failure_rate
Severity: WARNING
Type: threshold
Message: Percentage of failed image processing jobs exceeded warning threshold
Value: 7.5
Threshold: 5
Timestamp: 2025-01-19T10:30:00Z

View in Dashboard: https://your-app.com/admin/metrics?alert=12345
```

### Slack Alert
```
🚨 processing_failure_rate: Percentage of failed image processing jobs exceeded warning threshold

Severity: WARNING
Type: threshold
Value: 7.5
Threshold: 5

[View Dashboard] [Acknowledge]
```

## Alert Throttling

To prevent alert spam, alerts are throttled:
- Same metric/severity/type combination: 15-minute throttle window
- After acknowledging an alert, similar alerts are suppressed for the throttle window

## Custom Metrics

To add custom metrics, register them in the startup module:

```typescript
metricsService.registerMetric({
  name: 'custom_metric',
  description: 'Description of your metric',
  query: 'SELECT COUNT(*) as value FROM your_table WHERE condition',
  unit: 'count',
  aggregation: 'sum',
  interval: 10, // minutes
  thresholds: {
    warning: 100,
    critical: 200,
    trend: {
      increase: 50, // 50% increase triggers alert
      window: 60, // 60 minute window
    },
  },
  tags: ['custom', 'business'],
});
```

## Database Tables

The system uses several tables for metric collection:

- `error_logs`: Tracks user errors and system errors
- `user_activity_logs`: Tracks user activity for active user metrics
- `api_request_logs`: Tracks API performance metrics
- `business_metric_alerts`: Stores alert history

## Maintenance

### Log Cleanup

Old logs can be cleaned up using the provided function:

```sql
-- Clean up logs older than 30 days
SELECT cleanup_old_logs(30);

-- Clean up logs older than 7 days
SELECT cleanup_old_logs(7);
```

### Redis Storage

Metrics are stored in Redis with the following key patterns:
- Current value: `metric:<name>:current`
- Statistics: `stats:metric:<name>`
- History: `history:metric:<name>` (sorted set)
- Alerts: `alert:<metric>:<id>`

## Troubleshooting

### No Metrics Being Collected

1. Check Redis connection:
   - Ensure Redis is running and accessible
   - Check Redis configuration in environment variables

2. Check database queries:
   - Verify the metric queries are valid
   - Check that required tables exist

3. Check logs:
   - Look for errors in application logs
   - Check for metric collection failures

### Alerts Not Being Sent

1. Check alert configuration:
   - Verify environment variables are set correctly
   - Test SMTP/Slack/webhook endpoints manually

2. Check alert throttling:
   - Alerts may be throttled if sent recently
   - Check throttle window configuration

3. Check alert handlers:
   - Look for errors in alert handler logs
   - Verify credentials and permissions

### High Memory Usage

1. Adjust metric retention:
   - Reduce history retention period
   - Clean up old metrics more frequently

2. Optimize queries:
   - Ensure metric queries are efficient
   - Add appropriate database indexes

## Security Considerations

1. **Access Control**: Metrics endpoints require admin or manager role
2. **Sensitive Data**: Don't include PII in metric values or alerts
3. **Alert Channels**: Secure webhook URLs and SMTP credentials
4. **Rate Limiting**: Metric collection endpoints are rate-limited

## Performance Impact

The business metrics system has minimal performance impact:
- Metric queries run asynchronously
- Collection intervals prevent excessive database load
- Redis caching reduces repeated calculations
- Alert throttling prevents notification spam

## Future Enhancements

1. **Grafana Integration**: Export metrics to Prometheus format
2. **Custom Dashboards**: User-configurable metric dashboards
3. **Predictive Alerts**: ML-based anomaly detection
4. **Mobile App**: Push notifications for critical alerts
5. **Metric Correlations**: Detect related metric anomalies