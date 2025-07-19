# Health Check Endpoints Documentation

This document describes the health check endpoints available in the SpherosegV4 application for monitoring service health and readiness.

## Overview

All services in the SpherosegV4 stack expose health check endpoints that provide information about their operational status. These endpoints are used by:
- Docker health checks
- Kubernetes liveness and readiness probes
- Monitoring systems (Prometheus/Grafana)
- Load balancers

## Backend Service Health Checks

### Comprehensive Health Check
**Endpoint**: `GET /api/health`

Returns detailed health information about all backend components.

```json
{
  "status": "healthy",  // healthy, degraded, unhealthy
  "timestamp": "2025-07-19T12:00:00.000Z",
  "version": "1.0.0",
  "uptime": 3600,
  "environment": "production",
  "components": {
    "api": {
      "status": "healthy",
      "responseTime": 5
    },
    "database": {
      "status": "healthy",
      "message": "Database connected",
      "responseTime": 10
    },
    "mlService": {
      "status": "healthy",
      "message": "ML service available",
      "responseTime": 50
    },
    "memory": {
      "status": "healthy",
      "message": "Memory usage normal",
      "details": {
        "container": {
          "used": 512000000,
          "limit": 2147483648,
          "percentage": 23.84
        },
        "heap": {
          "used": 104857600,
          "total": 134217728,
          "percentage": 78.13
        }
      }
    },
    "fileSystem": {
      "status": "healthy",
      "message": "File system writable",
      "responseTime": 2
    },
    "configuration": {
      "status": "healthy",
      "message": "Configuration valid",
      "details": {
        "environment": "production",
        "jwtSecretConfigured": true,
        "dbSslEnabled": true,
        "secureCookies": true
      }
    }
  }
}
```

#### Query Parameters
- `details=true` - Include detailed information for each component

#### Response Codes
- `200` - Service is healthy or degraded
- `503` - Service is unhealthy

### Liveness Probe
**Endpoint**: `GET /api/health/live`

Simple endpoint to check if the service is alive.

```json
{
  "status": "alive",
  "timestamp": "2025-07-19T12:00:00.000Z",
  "pid": 1234
}
```

#### Response Codes
- `200` - Service is alive
- No response - Service is dead

### Readiness Probe
**Endpoint**: `GET /api/health/ready`

Checks if the service is ready to accept traffic.

```json
{
  "status": "ready",
  "timestamp": "2025-07-19T12:00:00.000Z"
}
```

#### Response Codes
- `200` - Service is ready
- `503` - Service is not ready

## ML Service Health Checks

### Comprehensive Health Check
**Endpoint**: `GET /health`

Returns detailed health information about the ML service.

```json
{
  "status": "healthy",
  "timestamp": "2025-07-19T12:00:00.000Z",
  "version": "1.0.0",
  "uptime": 1800.5,
  "components": {
    "model": {
      "status": "healthy",
      "path": "/ML/checkpoint_epoch_9.pth.tar",
      "exists": true
    },
    "rabbitmq": {
      "status": "healthy",
      "host": "rabbitmq",
      "port": 5672,
      "queue": "segmentation_tasks"
    },
    "memory": {
      "status": "healthy",
      "used_mb": 2048.5,
      "total_mb": 8192.0,
      "percentage": 25.0
    },
    "disk": {
      "status": "healthy",
      "free_gb": 45.2,
      "percentage": 55.3
    }
  },
  "issues": [],
  "environment": {
    "debug": false,
    "prefetch_count": 4
  }
}
```

### Liveness Probe
**Endpoint**: `GET /health/live`

```json
{
  "status": "alive",
  "timestamp": "2025-07-19T12:00:00.000Z",
  "pid": 5678
}
```

### Readiness Probe
**Endpoint**: `GET /health/ready`

```json
{
  "status": "ready",
  "timestamp": "2025-07-19T12:00:00.000Z"
}
```

## Docker Health Checks

All services include Docker health checks in their configurations:

### Backend Service
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:5001/api/health || exit 1
```

### ML Service
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD python -c "import requests; r = requests.get('http://localhost:5002/health'); exit(0 if r.status_code == 200 else 1)" || exit 1
```

### Frontend Service
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1
```

### Database
```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U postgres -d spheroseg"]
  interval: 10s
  timeout: 5s
  retries: 5
```

### Redis
```yaml
healthcheck:
  test: ["CMD", "redis-cli", "ping"]
  interval: 10s
  timeout: 5s
  retries: 5
```

### RabbitMQ
```yaml
healthcheck:
  test: ["CMD", "rabbitmq-diagnostics", "ping"]
  interval: 30s
  timeout: 10s
  retries: 5
  start_period: 10s
```

## Health Status Interpretation

### Status Values
- **healthy**: All components are functioning normally
- **degraded**: Some non-critical components have issues but service is operational
- **unhealthy**: Critical components have failed, service is not operational

### Component-Specific Thresholds

#### Memory
- **Healthy**: < 80% usage
- **Degraded**: 80-90% usage
- **Unhealthy**: > 90% usage

#### Database Response Time
- **Healthy**: < 100ms
- **Degraded**: 100-500ms
- **Unhealthy**: > 500ms or connection failed

#### ML Service
- **Healthy**: Model loaded and RabbitMQ connected
- **Degraded**: Service reachable but some components unavailable
- **Unhealthy**: Service unreachable

## Monitoring Integration

### Prometheus Metrics
The backend service exposes Prometheus metrics at `/api/metrics` including:
- Health check status for each component
- Response times
- Resource usage

### Grafana Dashboards
Pre-configured dashboards are available for:
- Service health overview
- Component status history
- Response time trends
- Resource usage patterns

## Best Practices

1. **Use appropriate endpoints**:
   - `/health/live` for crash detection
   - `/health/ready` for traffic routing
   - `/health` for detailed monitoring

2. **Configure appropriate timeouts**:
   - Liveness: Short timeout (3-5s)
   - Readiness: Medium timeout (10s)
   - Comprehensive: Longer timeout (30s)

3. **Set proper intervals**:
   - Liveness: 30s (frequent checks)
   - Readiness: 60s (less frequent)
   - Comprehensive: 5m (monitoring only)

4. **Handle degraded state**:
   - Continue serving traffic in degraded state
   - Alert operations team
   - Log detailed issues

5. **Secure health endpoints**:
   - Consider authentication for detailed health endpoints
   - Exclude sensitive information from responses
   - Rate limit health check endpoints

## Troubleshooting

### Service shows unhealthy
1. Check specific component status in `/health` response
2. Review service logs for errors
3. Verify external dependencies (database, ML service)
4. Check resource usage (memory, disk)

### Intermittent health check failures
1. Increase timeout values
2. Check network connectivity
3. Review resource constraints
4. Monitor for performance issues

### Configuration validation failures
1. Verify all required secrets are provided
2. Check environment variables
3. Ensure production settings are correct
4. Review startup logs for validation errors