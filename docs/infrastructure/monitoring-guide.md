# SpherosegV4 Monitoring Guide

This guide covers the comprehensive monitoring setup for SpherosegV4 using Prometheus and Grafana.

## Overview

The monitoring stack provides real-time insights into:
- Application performance metrics
- System resource utilization
- Database performance and replication
- WebSocket connection metrics
- ML service scaling and load distribution
- CDN cache performance
- GraphQL API performance

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Backend   │────▶│  Prometheus  │────▶│   Grafana   │
│  (Metrics)  │     │   (Storage)  │     │  (Visuals)  │
└─────────────┘     └──────────────┘     └─────────────┘
       │                     ▲
       │                     │
┌─────────────┐     ┌──────────────┐
│ ML Service  │────▶│  Exporters   │
│  (Metrics)  │     │ (Node, DB,   │
└─────────────┘     │  Redis, etc) │
                    └──────────────┘
```

## Quick Start

### 1. Start the Monitoring Stack

```bash
# Start all monitoring services
docker-compose -f docker-compose.monitoring.yml up -d

# Verify services are running
docker-compose -f docker-compose.monitoring.yml ps
```

### 2. Access Monitoring UIs

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (admin/spheroseg)
- **Node Exporter**: http://localhost:9100/metrics
- **Backend Metrics**: http://localhost:5001/api/metrics

### 3. Import Dashboards

1. Log into Grafana
2. Navigate to Dashboards → Import
3. Upload `/grafana/dashboards/spheroseg-overview.json`
4. Select Prometheus as the data source

## Metrics Categories

### 1. WebSocket Metrics

Monitor WebSocket performance and batching efficiency:

```promql
# Active connections by batching support
websocket_active_connections{supports_batching="true"}

# Message batching efficiency
rate(websocket_messages_total[5m]) / rate(websocket_batches_sent_total[5m])

# Compression savings
rate(websocket_compression_savings_bytes[5m])
```

### 2. GraphQL Metrics

Track GraphQL API performance:

```promql
# Request rate by operation
rate(graphql_request_duration_seconds_count[5m])

# 95th percentile response time
histogram_quantile(0.95, rate(graphql_request_duration_seconds_bucket[5m]))

# Error rate
rate(graphql_errors_total[5m])
```

### 3. Database Metrics

Monitor database performance and replication:

```promql
# Connection pool utilization
db_pool_connections{pool="write", state="active"} / 
(db_pool_connections{pool="write", state="active"} + 
 db_pool_connections{pool="write", state="idle"})

# Replication lag
db_replication_lag_seconds

# Query performance by pool
histogram_quantile(0.95, rate(db_query_duration_seconds_bucket[5m]))
```

### 4. ML Service Metrics

Track ML service scaling and performance:

```promql
# Tasks in queue
ml_tasks_queued

# Processing time by task type
histogram_quantile(0.95, rate(ml_task_duration_seconds_bucket[5m]))

# Load distribution across instances
rate(ml_load_balancer_requests_total[5m])
```

### 5. CDN Metrics

Monitor CDN cache effectiveness:

```promql
# Cache hit rate
rate(cdn_cache_hits_total[5m]) / 
(rate(cdn_cache_hits_total[5m]) + rate(cdn_cache_misses_total[5m]))

# Bandwidth saved
rate(cdn_bandwidth_saved_bytes[5m])

# Response time by cache status
histogram_quantile(0.95, rate(cdn_response_time_seconds_bucket[5m]))
```

## Key Performance Indicators (KPIs)

### Application Health

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| API Response Time (p95) | < 200ms | > 500ms |
| Error Rate | < 1% | > 5% |
| WebSocket Connections | - | > 1000 |
| Memory Usage | < 80% | > 90% |

### Database Performance

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Query Time (p95) | < 100ms | > 500ms |
| Connection Pool Usage | < 70% | > 90% |
| Replication Lag | < 1s | > 5s |

### ML Service Performance

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Queue Size | < 50 | > 100 |
| Processing Time | < 30s | > 60s |
| Instance CPU Usage | < 80% | > 95% |

## Custom Dashboards

### Creating a New Dashboard

1. In Grafana, click "+" → "Dashboard"
2. Add panels for your metrics
3. Save and export as JSON
4. Store in `/grafana/dashboards/`

### Example Panel Queries

**API Performance Panel:**
```promql
rate(http_request_duration_seconds_sum[5m]) / 
rate(http_request_duration_seconds_count[5m])
```

**WebSocket Efficiency Panel:**
```promql
(1 - (rate(websocket_batches_sent_total[5m]) / 
      rate(websocket_messages_total[5m]))) * 100
```

**Database Read/Write Split:**
```promql
sum by (pool) (rate(db_read_write_split_total[5m]))
```

## Alerting

### Setting Up Alerts

Create alert rules in `/prometheus/alerts/spheroseg.yml`:

```yaml
groups:
  - name: spheroseg
    interval: 30s
    rules:
      - alert: HighAPIResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High API response time"
          description: "95th percentile response time is {{ $value }}s"

      - alert: DatabaseReplicationLag
        expr: db_replication_lag_seconds > 5
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High database replication lag"
          description: "Replication lag is {{ $value }}s"

      - alert: MLQueueBacklog
        expr: ml_tasks_queued > 100
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "ML processing queue backlog"
          description: "{{ $value }} tasks in queue"
```

## Troubleshooting

### Common Issues

1. **Metrics not appearing in Prometheus**
   - Check service is exposing metrics endpoint
   - Verify Prometheus can reach the service
   - Check scrape configuration in `prometheus.yml`

2. **Grafana can't connect to Prometheus**
   - Verify Prometheus is running
   - Check data source configuration
   - Ensure network connectivity

3. **High memory usage in Prometheus**
   - Adjust retention period
   - Increase scrape interval
   - Add recording rules for frequently-used queries

### Useful Commands

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Test metric endpoint
curl http://localhost:5001/api/metrics

# View Prometheus configuration
docker exec spheroseg-prometheus cat /etc/prometheus/prometheus.yml

# Check Grafana logs
docker logs spheroseg-grafana
```

## Performance Optimization

### 1. Recording Rules

Add to `/prometheus/rules/recording.yml`:

```yaml
groups:
  - name: spheroseg_recording
    interval: 30s
    rules:
      - record: instance:api_request_rate
        expr: rate(http_request_duration_seconds_count[5m])
      
      - record: instance:websocket_efficiency
        expr: |
          1 - (rate(websocket_batches_sent_total[5m]) / 
               rate(websocket_messages_total[5m]))
```

### 2. Metric Cardinality

Keep cardinality low by:
- Limiting label values
- Using recording rules for complex queries
- Avoiding high-cardinality labels (e.g., user IDs)

### 3. Retention Settings

Adjust in `prometheus.yml`:
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  # Retention configuration
  storage.tsdb.retention.time: 15d
  storage.tsdb.retention.size: 10GB
```

## Integration with CI/CD

### Performance Testing

```bash
# Run performance tests and export metrics
npm run test:performance

# Query Prometheus for test results
curl -G http://localhost:9090/api/v1/query \
  --data-urlencode 'query=test_performance_score'
```

### Deployment Monitoring

Monitor deployments by adding annotations:

```bash
# Add deployment marker
curl -X POST http://localhost:9090/api/v1/admin/tsdb/create_snapshot

# Query deployment metrics
curl -G http://localhost:9090/api/v1/query_range \
  --data-urlencode 'query=deployment_success_rate[1h]'
```

## Best Practices

1. **Label Consistency**: Use consistent label names across metrics
2. **Metric Naming**: Follow Prometheus naming conventions
3. **Documentation**: Document custom metrics in code
4. **Testing**: Test alerts in staging before production
5. **Backup**: Regular backup of Prometheus data and Grafana dashboards

## Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [PromQL Cheat Sheet](https://promlabs.com/promql-cheat-sheet/)
- [Grafana Dashboard Examples](https://grafana.com/grafana/dashboards/)