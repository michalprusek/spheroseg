# Deployment Guide for Scalability Improvements

This guide provides step-by-step instructions for deploying the scalability improvements to SpherosegV4.

## Prerequisites

- Docker and Docker Compose installed
- Access to production database
- Redis service available
- Environment variables configured

## Deployment Steps

### 1. Update Environment Variables

Create or update the `.env` file in the backend directory:

```bash
# Database Configuration
DATABASE_URL=postgresql://postgres:password@db:5432/spheroseg
DB_POOL_MAX=20
DB_POOL_IDLE_TIMEOUT=30000

# Redis Configuration
REDIS_URL=redis://redis:6379
ENABLE_REDIS_CACHE=true

# Queue Configuration
QUEUE_CONCURRENCY=5
ENABLE_MESSAGE_QUEUE=true

# ML Service Configuration
ML_SERVICE_URL=http://ml:5002
ML_SERVICE_TIMEOUT=300000
ENABLE_CIRCUIT_BREAKER=true
```

### 2. Run Database Migrations

Apply the Bull queue tracking tables:

```bash
# Connect to the database container
docker-compose exec db psql -U postgres -d spheroseg

# Run the migration
\i /path/to/migrations/011_add_bull_queue_tables.sql

# Verify tables were created
\dt queue_*
```

### 3. Update Docker Compose Configuration

Ensure Redis is configured in `docker-compose.yml`:

```yaml
services:
  redis:
    profiles: ["dev", "prod"]
    image: redis:7-alpine
    container_name: spheroseg-redis
    restart: always
    ports:
      - "6379:6379"
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M
    volumes:
      - redis-data:/data
    networks:
      - spheroseg-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  redis-data:
```

### 4. Update Backend Service

Replace the old server.ts with the enhanced version:

```bash
# Backup the original
cp packages/backend/src/server.ts packages/backend/src/server.ts.backup

# Use the enhanced version
cp packages/backend/src/server.enhanced.ts packages/backend/src/server.ts
```

### 5. Update Segmentation Routes

Replace the old segmentation routes:

```bash
# Backup the original
cp packages/backend/src/routes/segmentation.ts packages/backend/src/routes/segmentation.ts.backup

# Use the enhanced version
cp packages/backend/src/routes/segmentation.enhanced.ts packages/backend/src/routes/segmentation.ts
```

### 6. Build and Deploy

```bash
# Stop existing services
docker-compose down

# Pull latest changes
git pull

# Build services with new changes
docker-compose build backend

# Start services with new configuration
docker-compose --profile prod up -d
```

### 7. Verify Deployment

#### Check Service Health

```bash
# Check overall health
curl http://localhost:5001/api/health

# Check detailed health
curl http://localhost:5001/api/health/detailed

# Check individual services
curl http://localhost:5001/api/health/services/database
curl http://localhost:5001/api/health/services/redis
curl http://localhost:5001/api/health/services/queue
curl http://localhost:5001/api/health/services/ml
```

#### Monitor Queue Status

```bash
# Check queue metrics
curl -H "Authorization: Bearer <token>" http://localhost:5001/api/segmentation/queue/status

# Monitor logs
docker-compose logs -f backend | grep -E "(Queue|Worker|Circuit)"
```

#### Test Segmentation

```bash
# Trigger single image segmentation
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"priority": 5}' \
  http://localhost:5001/api/images/<image-id>/segmentation

# Check job status
curl -H "Authorization: Bearer <token>" \
  http://localhost:5001/api/segmentation/job/<job-id>
```

### 8. Performance Tuning

#### Adjust Worker Concurrency

Based on your server capacity, adjust the number of concurrent workers:

```bash
# Update environment variable
QUEUE_CONCURRENCY=10  # Increase for more parallel processing

# Restart backend
docker-compose restart backend
```

#### Monitor Memory Usage

```bash
# Check container stats
docker stats backend

# Check detailed metrics
curl http://localhost:5001/api/performance/metrics
```

#### Database Pool Tuning

Monitor pool usage and adjust if needed:

```bash
# Check pool stats via health endpoint
curl http://localhost:5001/api/health/services/database

# Adjust pool size if needed
DB_POOL_MAX=30  # Increase if seeing connection exhaustion
```

## Rollback Procedure

If issues arise, follow these steps to rollback:

### 1. Stop Services

```bash
docker-compose stop backend
```

### 2. Restore Original Files

```bash
# Restore server.ts
cp packages/backend/src/server.ts.backup packages/backend/src/server.ts

# Restore segmentation routes
cp packages/backend/src/routes/segmentation.ts.backup packages/backend/src/routes/segmentation.ts
```

### 3. Rollback Database

```bash
# Connect to database
docker-compose exec db psql -U postgres -d spheroseg

# Run rollback script
\i /path/to/migrations/rollback/011_add_bull_queue_tables_rollback.sql
```

### 4. Restart Services

```bash
# Rebuild without new changes
docker-compose build backend

# Start services
docker-compose --profile prod up -d
```

## Monitoring and Maintenance

### Daily Checks

1. **Queue Health**: Monitor queue depth and processing rate
2. **Circuit Breaker**: Check ML service availability
3. **Database Pool**: Monitor connection usage
4. **Error Rates**: Check logs for failures

### Weekly Maintenance

1. **Clean Old Jobs**: Remove completed jobs older than 7 days
2. **Analyze Metrics**: Review performance trends
3. **Update Priorities**: Adjust user priorities based on usage

### Alerts to Configure

1. **Queue Depth Alert**: When waiting jobs > 100
2. **Circuit Open Alert**: When ML service circuit opens
3. **Pool Exhaustion**: When idle connections < 2
4. **High Error Rate**: When failure rate > 10%

## Troubleshooting

### Common Issues

#### Redis Connection Failed
```bash
# Check Redis is running
docker-compose ps redis

# Test connection
docker-compose exec redis redis-cli ping
```

#### Queue Not Processing
```bash
# Check worker logs
docker-compose logs backend | grep "Segmentation worker"

# Restart workers
docker-compose restart backend
```

#### Circuit Breaker Open
```bash
# Check ML service health
curl http://ml:5002/health

# Check circuit status
curl http://localhost:5001/api/segmentation/queue/status
```

#### Database Pool Exhausted
```bash
# Increase pool size
DB_POOL_MAX=40

# Check for connection leaks
docker-compose logs backend | grep "pool"
```

## Performance Expectations

After deployment, expect the following improvements:

- **ML Throughput**: 5-10x increase (from 1 to 5-10 concurrent)
- **Response Time**: <100ms for queue submission (was 5+ minutes)
- **Availability**: 99.9% with circuit breaker protection
- **User Experience**: Real-time status updates via WebSocket

## Support

For issues or questions:
1. Check logs: `docker-compose logs -f backend`
2. Review health endpoints
3. Contact DevOps team with error details