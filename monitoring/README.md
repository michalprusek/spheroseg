# SpherosegV4 Monitoring & Alerting

This directory contains the complete monitoring and alerting setup for SpherosegV4 using Prometheus, Grafana, and AlertManager.

## Overview

The monitoring stack includes:
- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboards
- **AlertManager**: Alert routing and notifications
- **Node Exporter**: System metrics
- **PostgreSQL Exporter**: Database metrics

## Quick Start

1. Start the monitoring stack:
```bash
docker-compose -f docker-compose.monitoring.yml up -d
```

2. Access the services:
- Grafana: http://localhost:3001 (admin/admin)
- Prometheus: http://localhost:9090
- AlertManager: http://localhost:9093

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Backend   │────▶│ Prometheus  │────▶│   Grafana   │
│  /metrics   │     │    :9090    │     │    :3001    │
└─────────────┘     └─────────────┘     └─────────────┘
                            │
                            ▼
                    ┌─────────────┐
                    │AlertManager │
                    │    :9093    │
                    └─────────────┘
                            │
                    ┌───────┴───────┐
                    ▼               ▼
                 Slack          PagerDuty
```

## Metrics Exposed

### Application Metrics
- **HTTP Requests**: Rate, duration, error rate
- **WebSocket**: Active connections, message batching
- **ML Processing**: Queue size, processing time
- **Cache Performance**: Hit rates for Redis, memory, CDN
- **Database**: Query performance, connection pools

### Infrastructure Metrics
- **System**: CPU, memory, disk usage
- **Containers**: Resource usage, restarts
- **PostgreSQL**: Connections, slow queries, replication lag
- **Network**: Request rates, bandwidth

## Dashboards

### SpherosegV4 Application Metrics
- Request rate and error rate
- Response time percentiles
- WebSocket connections
- ML task queue
- Cache hit rates

### SpherosegV4 Infrastructure
- System resource usage
- Service health status
- Database performance
- Container metrics

## Alerts

### Critical Alerts
- Service down
- Database down
- High error rate (>5%)
- Database connection pool exhaustion
- Database replication lag >5s
- Disk space <15%

### Warning Alerts
- High response time (>2s)
- Memory pressure events
- ML queue buildup (>100 tasks)
- API rate limiting active
- Cache hit rate <60%
- High CPU/Memory usage (>80%)

## Configuration

### Adding New Metrics

1. Export metrics from your application:
```typescript
import { Counter, Histogram } from 'prom-client';

export const myMetric = new Counter({
  name: 'my_metric_total',
  help: 'Description of my metric',
  labelNames: ['label1', 'label2']
});

// Use in code
myMetric.labels('value1', 'value2').inc();
```

2. The metrics will automatically be scraped by Prometheus at `/api/metrics`

### Adding New Alerts

1. Create a new alert rule in `prometheus/alerts/`:
```yaml
groups:
  - name: my_alerts
    rules:
      - alert: MyAlert
        expr: my_metric > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "My metric is high"
          description: "Current value: {{ $value }}"
```

2. Restart Prometheus to load the new rules

### Configuring Notifications

1. Update `alertmanager/config.yml` with your notification channels:
   - Set `SLACK_WEBHOOK_URL` environment variable
   - Configure PagerDuty service key if needed
   - Add email recipients

2. Restart AlertManager to apply changes

## Environment Variables

```bash
# Grafana
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=your-secure-password

# AlertManager
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
PAGERDUTY_SERVICE_KEY=your-pagerduty-key
```

## Maintenance

### Backup Grafana Dashboards
```bash
docker exec spheroseg-grafana grafana-cli admin export-dashboard
```

### Update Prometheus Retention
Edit `docker-compose.monitoring.yml` and change:
```yaml
command:
  - '--storage.tsdb.retention.time=30d'  # Change to desired retention
```

### View Prometheus Targets
Visit http://localhost:9090/targets to see all scrape targets and their status.

## Troubleshooting

### Prometheus Not Scraping Metrics
1. Check target status at http://localhost:9090/targets
2. Verify backend is exposing metrics at `/api/metrics`
3. Check network connectivity between containers

### Alerts Not Firing
1. Check alert rules at http://localhost:9090/alerts
2. Verify AlertManager is receiving alerts at http://localhost:9093
3. Check AlertManager logs: `docker logs spheroseg-alertmanager`

### Grafana Can't Connect to Prometheus
1. Verify Prometheus is running: `docker ps | grep prometheus`
2. Check datasource configuration in Grafana
3. Test connection from Grafana UI

## Production Recommendations

1. **Persistence**: Ensure volumes are backed up regularly
2. **Security**: Change default passwords, use HTTPS
3. **High Availability**: Consider running multiple Prometheus instances
4. **Long-term Storage**: Use Thanos or Cortex for long-term metric storage
5. **Alert Tuning**: Adjust thresholds based on your specific workload