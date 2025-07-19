# Auto-Scaling Configuration System

Comprehensive auto-scaling solution for SpherosegV4 with metric-based scaling policies, Docker Compose integration, and monitoring capabilities.

## Overview

The auto-scaling system provides:

- **Metric-Based Scaling**: CPU, memory, request rate, queue length, and error rate monitoring
- **Docker Compose Integration**: Seamless scaling of containerized services
- **Policy Management**: Configurable scaling policies with safety mechanisms
- **Real-Time Monitoring**: Dashboard and API endpoints for monitoring scaling status
- **Safety Features**: Cooldown periods, minimum/maximum replica limits, and rollback capabilities

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Metrics       │    │   Auto-Scaler   │    │   Docker        │
│   Collection    │────│   Engine        │────│   Compose       │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Redis         │    │   Policy        │    │   Service       │
│   Storage       │    │   Evaluation    │    │   Instances     │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Components

1. **AutoScaler Class**: Core scaling engine with policy evaluation
2. **Business Metrics Integration**: Real-time metric collection and storage
3. **Docker Compose Interface**: Service scaling via Docker Compose commands
4. **API Endpoints**: REST API for policy management and monitoring
5. **Configuration System**: JSON-based policy and threshold configuration

## Quick Start

### 1. Setup Auto-Scaling Infrastructure

```bash
# Run the setup script
./scripts/setup-autoscaling.sh

# Start services with auto-scaling configuration
docker-compose -f docker-compose.yml -f docker-compose.autoscale.yml up -d

# Enable auto-scaling
./scripts/autoscaling-control.sh enable
```

### 2. Monitor Scaling Activity

```bash
# Real-time monitoring
./scripts/monitor-autoscaling.sh

# Check scaling status
./scripts/autoscaling-control.sh status

# View scaling history
./scripts/autoscaling-control.sh history backend
```

### 3. Access API Endpoints

```bash
# Get scaling status
curl -H "Authorization: Bearer $TOKEN" http://localhost:5001/api/autoscaling/status

# Get scaling policies
curl -H "Authorization: Bearer $TOKEN" http://localhost:5001/api/autoscaling/policies

# Get scaling recommendations
curl -H "Authorization: Bearer $TOKEN" http://localhost:5001/api/autoscaling/recommendations
```

## Configuration

### Scaling Policies

Policies are defined in `config/autoscaling/policies.json`:

```json
{
  "policies": [
    {
      "name": "backend-production-scaling",
      "service": "backend",
      "minReplicas": 2,
      "maxReplicas": 8,
      "metrics": [
        {
          "name": "cpu_usage",
          "type": "cpu",
          "source": "system",
          "aggregation": "avg",
          "window": 5,
          "weight": 0.4
        }
      ],
      "thresholds": [
        {
          "metric": "cpu_usage",
          "scaleUp": 70,
          "scaleDown": 25,
          "comparison": "greater_than"
        }
      ],
      "cooldownPeriod": 300,
      "evaluationInterval": 120,
      "enabled": false
    }
  ]
}
```

### Environment Configuration

Configure via `config/autoscaling/.env.autoscaling`:

```bash
# Global settings
AUTOSCALING_ENABLED=false
AUTOSCALING_LOG_LEVEL=info

# Safety limits
MAX_TOTAL_REPLICAS=20
MIN_AVAILABLE_MEMORY_MB=512

# Notification settings
SCALING_NOTIFICATIONS_ENABLED=true
SCALING_WEBHOOK_URL=https://your-webhook-url.com
```

### Docker Compose Configuration

The `docker-compose.autoscale.yml` file provides:

- Resource limits for scaling decisions
- Health checks for service availability
- Load balancing configuration
- Logging for scaling analysis

## Metrics and Monitoring

### Available Metrics

| Metric | Type | Source | Description |
|--------|------|--------|-------------|
| `cpu_usage` | System | Docker Stats | CPU usage percentage |
| `memory_usage` | System | Docker Stats | Memory usage percentage |
| `request_rate` | Business | Application | Requests per minute |
| `error_rate` | Business | Application | Error percentage |
| `queue_length` | Business | Database | Processing queue size |
| `response_time_p95` | Business | Application | 95th percentile response time |

### Metric Sources

1. **System Metrics**: Collected from Docker container stats
2. **Business Metrics**: Collected from application and database
3. **Prometheus Metrics**: Integration with Prometheus (if available)
4. **Custom Metrics**: SQL queries or custom calculators

### Scaling Thresholds

```typescript
interface ScalingThreshold {
  metric: string;
  scaleUp: number;      // Threshold to trigger scale up
  scaleDown: number;    // Threshold to trigger scale down
  comparison: 'greater_than' | 'less_than' | 'percentage_change';
}
```

## API Reference

### Authentication

All auto-scaling API endpoints require admin authentication:

```bash
# Get authentication token
TOKEN=$(curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}' | \
  jq -r '.token')
```

### Endpoints

#### GET /api/autoscaling/status

Get current auto-scaling status and policy information.

**Response:**
```json
{
  "success": true,
  "status": {
    "enabled": true,
    "policies": [
      {
        "name": "backend-auto-scale",
        "service": "backend",
        "enabled": true,
        "currentReplicas": 3,
        "lastEvaluation": "2025-01-19T10:30:00Z",
        "lastScaling": "2025-01-19T10:15:00Z"
      }
    ]
  }
}
```

#### POST /api/autoscaling/enable

Enable or disable auto-scaling globally.

**Request:**
```json
{
  "enabled": true
}
```

#### GET /api/autoscaling/policies

List all scaling policies.

#### POST /api/autoscaling/policies

Create a new scaling policy.

**Request:**
```json
{
  "name": "custom-policy",
  "service": "backend",
  "minReplicas": 1,
  "maxReplicas": 5,
  "metrics": [...],
  "thresholds": [...],
  "enabled": false
}
```

#### GET /api/autoscaling/history/:service

Get scaling history for a specific service.

**Parameters:**
- `service`: Service name (backend, ml, etc.)
- `limit`: Number of events to return (default: 50)

#### GET /api/autoscaling/recommendations

Get scaling recommendations based on current metrics.

**Response:**
```json
{
  "success": true,
  "recommendations": [
    {
      "service": "backend",
      "currentReplicas": 2,
      "recommendedReplicas": 3,
      "reason": "High CPU usage (85%) and request rate increasing",
      "confidence": 0.8,
      "priority": "high"
    }
  ]
}
```

## Scaling Policies

### Policy Structure

```typescript
interface ScalingPolicy {
  name: string;                    // Unique policy identifier
  service: string;                 // Docker service name
  minReplicas: number;            // Minimum number of replicas
  maxReplicas: number;            // Maximum number of replicas
  metrics: ScalingMetric[];       // Metrics to monitor
  thresholds: ScalingThreshold[]; // Scaling decision thresholds
  cooldownPeriod: number;         // Minutes between scaling actions
  scaleUpBy: number;              // Replicas to add when scaling up
  scaleDownBy: number;            // Replicas to remove when scaling down
  evaluationInterval: number;     // Minutes between policy evaluations
  enabled: boolean;               // Whether policy is active
}
```

### Default Policies

#### Backend Service Policy

- **Min Replicas**: 1, **Max Replicas**: 5
- **Scale Up**: CPU > 70%, Memory > 80%, Request Rate > 100/min
- **Scale Down**: CPU < 20%, Memory < 30%, Request Rate < 20/min
- **Cooldown**: 5 minutes
- **Evaluation**: Every 2 minutes

#### ML Service Policy

- **Min Replicas**: 1, **Max Replicas**: 3
- **Scale Up**: Queue Length > 10, Failure Rate > 5%
- **Scale Down**: Queue Length < 2, Failure Rate < 1%
- **Cooldown**: 10 minutes
- **Evaluation**: Every 5 minutes

### Creating Custom Policies

1. **Define Metrics**: Choose relevant metrics for your service
2. **Set Thresholds**: Determine appropriate scale up/down thresholds
3. **Configure Safety**: Set min/max replicas and cooldown periods
4. **Test Policy**: Use test mode to validate scaling behavior
5. **Enable Policy**: Activate policy for production use

## Safety Mechanisms

### Cooldown Periods

Prevent rapid scaling oscillations by enforcing minimum time between scaling actions.

### Replica Limits

- **Minimum Replicas**: Ensure service availability
- **Maximum Replicas**: Prevent resource exhaustion
- **Global Limits**: System-wide maximum replica constraints

### Confidence Scoring

Scaling decisions include confidence scores (0.0-1.0) based on:
- Number of triggered thresholds
- Metric value severity
- Historical scaling success

### Rollback Capabilities

- Automatic rollback on scaling failures
- Manual rollback via API endpoints
- Scaling event audit trail

## Monitoring and Alerting

### Real-Time Monitoring

```bash
# Continuous monitoring display
./scripts/monitor-autoscaling.sh

# Get current scaling status
./scripts/autoscaling-control.sh status
```

### Scaling Events

All scaling events are logged and stored with:
- Timestamp and duration
- Before/after replica counts
- Triggering metrics and values
- Success/failure status
- Error details (if failed)

### Alerting Integration

Configure alerts for:
- Scaling events (successful/failed)
- Policy evaluation errors
- Resource exhaustion warnings
- Service unavailability

### Dashboard Integration

Monitor auto-scaling through:
- Real-time replica count graphs
- Metric trend visualization
- Scaling event timeline
- Performance impact analysis

## Troubleshooting

### Common Issues

#### Auto-Scaling Not Working

1. **Check if enabled**: `./scripts/autoscaling-control.sh status`
2. **Verify policies**: `./scripts/autoscaling-control.sh policies`
3. **Check metrics**: Ensure metric collection is working
4. **Review logs**: Check backend logs for auto-scaler errors

#### Rapid Scaling Oscillations

1. **Increase cooldown periods**: Add more time between scaling actions
2. **Adjust thresholds**: Create larger gaps between scale up/down thresholds
3. **Review metric weights**: Balance metric importance in decisions

#### Scaling Commands Failing

1. **Check Docker**: Ensure Docker daemon is running
2. **Verify permissions**: User must have Docker access
3. **Check service names**: Ensure service names match Docker Compose
4. **Review resource limits**: Check system resources are available

### Debug Mode

Enable debug logging:

```bash
# Set debug level in environment
export AUTOSCALING_LOG_LEVEL=debug

# Enable dry run mode for testing
export AUTOSCALING_DRY_RUN=true
```

### Manual Testing

Test scaling manually:

```bash
# Test scaling a service
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:5001/api/autoscaling/test/backend \
  -d '{"replicas": 3}'

# Check current replica count
docker-compose ps backend
```

## Performance Considerations

### Resource Requirements

- **CPU**: Minimal overhead (~1-2% per service)
- **Memory**: ~50MB for auto-scaler process
- **Storage**: Redis for metrics storage (~100MB)
- **Network**: Minimal - only Docker API calls

### Scaling Performance

- **Scale Up Time**: ~30-60 seconds per replica
- **Scale Down Time**: ~15-30 seconds per replica
- **Evaluation Frequency**: Configurable (default: 2-5 minutes)
- **Metric Collection**: Every 1-2 minutes

### Best Practices

1. **Start Conservative**: Begin with higher thresholds and longer cooldowns
2. **Monitor First**: Collect baseline metrics before enabling auto-scaling
3. **Test Thoroughly**: Use dry-run mode and test environments
4. **Gradual Rollout**: Enable one service at a time
5. **Regular Review**: Analyze scaling patterns and adjust policies

## Production Deployment

### Pre-Production Checklist

- [ ] Configure resource limits in Docker Compose
- [ ] Set appropriate scaling thresholds
- [ ] Configure monitoring and alerting
- [ ] Test scaling policies in staging
- [ ] Set up backup and rollback procedures
- [ ] Configure notification webhooks
- [ ] Review security settings

### Production Configuration

```bash
# Enable auto-scaling for production
export AUTOSCALING_ENABLED=true
export AUTOSCALING_LOG_LEVEL=info
export MAX_TOTAL_REPLICAS=50

# Start with auto-scaling configuration
docker-compose -f docker-compose.yml -f docker-compose.autoscale.yml up -d
```

### Monitoring in Production

- Set up alerts for scaling failures
- Monitor scaling frequency and patterns
- Track resource utilization trends
- Review scaling effectiveness regularly

## Contributing

### Adding New Metrics

1. **Define Metric**: Add metric definition to business metrics service
2. **Configure Collection**: Set collection interval and storage
3. **Update Policies**: Include metric in scaling policies
4. **Test Integration**: Verify metric collection and scaling decisions

### Adding New Services

1. **Service Configuration**: Add service to Docker Compose files
2. **Health Checks**: Define health check endpoints
3. **Resource Limits**: Set appropriate CPU/memory limits
4. **Scaling Policy**: Create policy with service-specific metrics

### Testing Changes

```bash
# Run auto-scaling tests
npm run test:autoscaling

# Test configuration validation
./scripts/setup-autoscaling.sh --validate

# Test API endpoints
npm run test:api:autoscaling
```

## Support

For issues or questions:

1. Check the troubleshooting section
2. Review auto-scaling logs
3. Test with dry-run mode enabled
4. Create an issue with configuration and logs

---

**Note**: Auto-scaling is disabled by default for safety. Always test thoroughly in a staging environment before enabling in production.