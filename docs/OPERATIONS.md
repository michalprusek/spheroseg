# SpherosegV4 Operations Runbook

This runbook provides step-by-step procedures for common operational tasks, troubleshooting guides, and emergency response procedures for SpherosegV4 production operations.

## Table of Contents

1. [Daily Operations](#daily-operations)
2. [Monitoring Checks](#monitoring-checks)
3. [Common Tasks](#common-tasks)
4. [Troubleshooting Guide](#troubleshooting-guide)
5. [Performance Tuning](#performance-tuning)
6. [Security Operations](#security-operations)
7. [Incident Response](#incident-response)
8. [Disaster Recovery](#disaster-recovery)
9. [Maintenance Windows](#maintenance-windows)
10. [Escalation Procedures](#escalation-procedures)

## Daily Operations

### Morning Checklist

```bash
# 1. Check service health
./scripts/health-check.sh

# 2. Review overnight alerts
docker-compose -f monitoring/docker-compose.monitoring.yml logs alertmanager | grep -i alert

# 3. Check backup status
docker-compose -f docker-compose.prod.yml exec backup cat /backup/last_backup_timestamp

# 4. Review error logs
docker-compose -f docker-compose.prod.yml logs --since "12 hours ago" | grep -E "(ERROR|CRITICAL)"

# 5. Check disk space
df -h | grep -E "(^/|docker)"

# 6. Review performance metrics
curl -s http://localhost:3001/api/dashboards/uid/system-overview | jq '.dashboard.panels[].title'
```

### Service Health Verification

```bash
#!/bin/bash
# scripts/health-check.sh

echo "Checking SpherosegV4 Service Health..."

# Function to check service
check_service() {
    local service=$1
    local url=$2
    local expected=$3
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    if [ "$response" == "$expected" ]; then
        echo "✅ $service: Healthy"
    else
        echo "❌ $service: Unhealthy (HTTP $response)"
    fi
}

# Check all services
check_service "Frontend" "https://your-domain.com" "200"
check_service "Backend API" "https://api.your-domain.com/health" "200"
check_service "ML Service" "http://localhost:5002/health" "200"
check_service "Database" "http://localhost:5432" "000"  # Connection refused is expected
check_service "Redis" "http://localhost:6379" "000"    # Connection refused is expected

# Check Docker containers
echo -e "\nDocker Container Status:"
docker-compose -f docker-compose.prod.yml ps
```

## Monitoring Checks

### Key Metrics to Monitor

#### Application Metrics
```promql
# Request rate (last 5 minutes)
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])

# Response time (95th percentile)
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Active users
spheroseg_active_users

# Image processing rate
rate(spheroseg_images_processed_total[1h])
```

#### Infrastructure Metrics
```promql
# CPU usage by container
rate(container_cpu_usage_seconds_total[5m]) * 100

# Memory usage
container_memory_usage_bytes / container_spec_memory_limit_bytes * 100

# Disk I/O
rate(container_fs_reads_bytes_total[5m])
rate(container_fs_writes_bytes_total[5m])

# Network traffic
rate(container_network_receive_bytes_total[5m])
rate(container_network_transmit_bytes_total[5m])
```

### Alert Response

When alerts fire, follow these steps:

1. **Acknowledge Alert**
   ```bash
   # Via AlertManager UI
   http://your-domain.com:9093
   
   # Via CLI
   amtool alert add alertname="HighErrorRate" --alertmanager.url=http://localhost:9093
   ```

2. **Investigate Root Cause**
   ```bash
   # Check recent logs
   docker-compose -f docker-compose.prod.yml logs --tail 100 backend
   
   # Check metrics
   curl http://localhost:9090/api/v1/query?query=up
   ```

3. **Take Action** (see troubleshooting guide below)

4. **Document Incident**
   - Create incident report
   - Update runbook if needed

## Common Tasks

### Scaling Services

```bash
# Scale backend during high load
docker-compose -f docker-compose.prod.yml up -d --scale backend=3

# Scale ML service (check GPU availability first)
nvidia-smi  # Check GPU status
docker-compose -f docker-compose.prod.yml up -d --scale ml=2

# Verify scaling
docker-compose -f docker-compose.prod.yml ps | grep backend
```

### Database Operations

```bash
# Connect to database
docker-compose -f docker-compose.prod.yml exec db psql -U postgres -d spheroseg

# Common queries
-- Check active connections
SELECT pid, usename, application_name, client_addr, state 
FROM pg_stat_activity 
WHERE state = 'active';

-- Find slow queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
FROM pg_stat_activity 
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';

-- Table sizes
SELECT schemaname AS table_schema,
       tablename AS table_name,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Vacuum and analyze
VACUUM ANALYZE;
```

### Cache Management

```bash
# Redis operations
docker-compose -f docker-compose.prod.yml exec redis redis-cli

# Common Redis commands
INFO memory          # Memory usage
DBSIZE              # Number of keys
KEYS *              # List all keys (careful in production!)
FLUSHDB             # Clear cache (requires confirmation)
CONFIG GET maxmemory # Check memory limit
```

### Log Management

```bash
# View logs by service
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f --tail 100 ml

# Search logs
docker-compose -f docker-compose.prod.yml logs | grep -i error
docker-compose -f docker-compose.prod.yml logs --since "1 hour ago" | grep user@example.com

# Export logs for analysis
docker-compose -f docker-compose.prod.yml logs > logs_$(date +%Y%m%d_%H%M%S).txt

# Rotate logs manually
docker-compose -f docker-compose.prod.yml exec backend sh -c 'kill -USR1 1'
```

## Troubleshooting Guide

### Service Not Starting

```bash
# 1. Check Docker status
systemctl status docker

# 2. Check disk space
df -h

# 3. Check container logs
docker-compose -f docker-compose.prod.yml logs [service-name]

# 4. Check resource limits
docker stats

# 5. Try recreating container
docker-compose -f docker-compose.prod.yml up -d --force-recreate [service-name]
```

### High Memory Usage

```bash
# 1. Identify memory-hungry processes
docker stats --no-stream

# 2. Check for memory leaks
docker-compose -f docker-compose.prod.yml exec backend sh
ps aux | sort -k 6 -n -r | head -10

# 3. Force garbage collection (Node.js services)
docker-compose -f docker-compose.prod.yml exec backend kill -USR2 1

# 4. Restart service if needed
docker-compose -f docker-compose.prod.yml restart backend
```

### Database Connection Issues

```bash
# 1. Check PostgreSQL status
docker-compose -f docker-compose.prod.yml exec db pg_isready

# 2. Check connection limit
docker-compose -f docker-compose.prod.yml exec db psql -U postgres -c "SHOW max_connections;"

# 3. Kill idle connections
docker-compose -f docker-compose.prod.yml exec db psql -U postgres -d spheroseg -c "
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'idle' 
AND query_start < now() - interval '10 minutes';"

# 4. Increase connection limit if needed
docker-compose -f docker-compose.prod.yml exec db psql -U postgres -c "ALTER SYSTEM SET max_connections = 200;"
docker-compose -f docker-compose.prod.yml restart db
```

### ML Service Issues

```bash
# 1. Check GPU availability
nvidia-smi

# 2. Check model file
docker-compose -f docker-compose.prod.yml exec ml ls -la /app/checkpoint_epoch_9.pth.tar

# 3. Test ML endpoint
curl -X POST http://localhost:5002/health

# 4. Check Python dependencies
docker-compose -f docker-compose.prod.yml exec ml pip list

# 5. Restart with debug mode
docker-compose -f docker-compose.prod.yml exec ml sh
export FLASK_ENV=development
python app.py
```

## Performance Tuning

### Database Optimization

```sql
-- Update statistics
ANALYZE;

-- Find missing indexes
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
AND n_distinct > 100
AND correlation < 0.1
ORDER BY n_distinct DESC;

-- Create suggested indexes
CREATE INDEX CONCURRENTLY idx_images_user_status 
ON images(user_id, segmentation_status) 
WHERE deleted_at IS NULL;

-- Monitor index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
ORDER BY idx_scan;
```

### Application Optimization

```bash
# Enable Node.js profiling
docker-compose -f docker-compose.prod.yml exec backend sh
NODE_OPTIONS="--prof" node dist/server.js

# Analyze profile
node --prof-process isolate-*.log > profile.txt

# Enable memory profiling
NODE_OPTIONS="--expose-gc --trace-gc" node dist/server.js
```

### Network Optimization

```nginx
# Update nginx configuration for better caching
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# Enable HTTP/2 push
location / {
    http2_push /static/css/main.css;
    http2_push /static/js/main.js;
}
```

## Security Operations

### Security Checklist

```bash
# 1. Check for security updates
docker-compose -f docker-compose.prod.yml exec backend npm audit
docker-compose -f docker-compose.prod.yml exec frontend npm audit

# 2. Review access logs for suspicious activity
docker-compose -f docker-compose.prod.yml logs nginx | grep -E "(POST|PUT|DELETE)" | grep -v "/api"

# 3. Check failed login attempts
docker-compose -f docker-compose.prod.yml logs backend | grep "Failed login"

# 4. Verify SSL certificate
echo | openssl s_client -servername your-domain.com -connect your-domain.com:443 2>/dev/null | openssl x509 -noout -dates

# 5. Run security scan
docker run --rm -v "$PWD":/src aquasec/trivy fs /src
```

### Rotate Secrets

```bash
# 1. Generate new secrets
NEW_JWT_SECRET=$(openssl rand -base64 64)
NEW_SESSION_SECRET=$(openssl rand -base64 64)

# 2. Update Docker secrets
echo $NEW_JWT_SECRET | docker secret create jwt_secret_v2 -
echo $NEW_SESSION_SECRET | docker secret create session_secret_v2 -

# 3. Update docker-compose.prod.yml to use new secrets

# 4. Rolling restart
docker-compose -f docker-compose.prod.yml up -d --no-deps backend

# 5. Remove old secrets after verification
docker secret rm jwt_secret
docker secret rm session_secret
```

## Incident Response

### Severity Levels

- **P1 (Critical)**: Complete service outage, data loss risk
- **P2 (High)**: Major feature unavailable, significant performance degradation
- **P3 (Medium)**: Minor feature issues, moderate performance impact
- **P4 (Low)**: Cosmetic issues, minimal user impact

### Response Procedures

#### P1 Incident Response

1. **Immediate Actions** (0-5 minutes)
   ```bash
   # Create incident channel/call
   # Notify on-call engineer
   # Start incident log
   echo "[$(date)] P1 Incident Started: [Description]" >> incidents.log
   ```

2. **Assessment** (5-15 minutes)
   ```bash
   # Check all services
   ./scripts/health-check.sh
   
   # Review recent changes
   git log --oneline -10
   docker-compose -f docker-compose.prod.yml ps
   ```

3. **Mitigation** (15-30 minutes)
   - Rollback if recent deployment
   - Scale up healthy services
   - Enable maintenance mode
   - Redirect traffic if needed

4. **Resolution** (30+ minutes)
   - Fix root cause
   - Test thoroughly
   - Deploy fix
   - Monitor closely

5. **Post-Incident** (Next business day)
   - Write incident report
   - Conduct post-mortem
   - Update runbook
   - Implement preventive measures

## Disaster Recovery

### Backup Restoration

```bash
# 1. Stop application services
docker-compose -f docker-compose.prod.yml stop backend ml frontend

# 2. Restore database from backup
# From S3
aws s3 cp s3://your-backup-bucket/database-backups/spheroseg_backup_20240710_020000.sql.gz .
gunzip spheroseg_backup_20240710_020000.sql.gz

# 3. Drop and recreate database
docker-compose -f docker-compose.prod.yml exec db psql -U postgres <<EOF
DROP DATABASE IF EXISTS spheroseg;
CREATE DATABASE spheroseg;
EOF

# 4. Restore data
docker-compose -f docker-compose.prod.yml exec -T db psql -U postgres -d spheroseg < spheroseg_backup_20240710_020000.sql

# 5. Verify restoration
docker-compose -f docker-compose.prod.yml exec db psql -U postgres -d spheroseg -c "SELECT COUNT(*) FROM users;"

# 6. Restart services
docker-compose -f docker-compose.prod.yml start backend ml frontend
```

### Full System Recovery

1. **Infrastructure Recovery**
   ```bash
   # Provision new server
   # Install Docker and dependencies
   curl -fsSL https://get.docker.com | sh
   
   # Clone repository
   git clone https://github.com/your-org/spheroseg.git
   cd spheroseg/spheroseg
   ```

2. **Restore Configuration**
   ```bash
   # Copy backed up .env.production
   # Restore SSL certificates
   # Re-create Docker secrets
   ```

3. **Deploy Application**
   ```bash
   ./scripts/deploy-production.sh
   ```

4. **Restore Data**
   - Follow backup restoration procedure
   - Verify all data integrity

5. **Update DNS**
   - Point domain to new server
   - Verify SSL certificates

## Maintenance Windows

### Planning Maintenance

1. **Schedule Window**
   - Announce 48 hours in advance
   - Choose low-traffic period
   - Duration: typically 2-4 hours

2. **Preparation Checklist**
   ```bash
   - [ ] Backup database
   - [ ] Test changes in staging
   - [ ] Prepare rollback plan
   - [ ] Notify users
   - [ ] Update status page
   ```

### Maintenance Procedures

```bash
# 1. Enable maintenance mode
docker-compose -f docker-compose.prod.yml exec frontend sh -c 'touch /usr/share/nginx/html/maintenance.html'

# 2. Perform updates
git pull origin main
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml run --rm backend npm run db:migrate

# 3. Rolling update
for service in backend ml frontend; do
    docker-compose -f docker-compose.prod.yml up -d --no-deps $service
    sleep 30
    ./scripts/health-check.sh
done

# 4. Disable maintenance mode
docker-compose -f docker-compose.prod.yml exec frontend sh -c 'rm /usr/share/nginx/html/maintenance.html'

# 5. Verify services
./scripts/health-check.sh
```

## Escalation Procedures

### Escalation Matrix

| Severity | Initial Response | Escalation Time | Escalate To |
|----------|-----------------|-----------------|-------------|
| P1 | On-call Engineer | 15 minutes | Team Lead → CTO |
| P2 | On-call Engineer | 30 minutes | Team Lead |
| P3 | Support Team | 2 hours | Senior Engineer |
| P4 | Support Team | Next business day | Engineer |

### Contact Information

```yaml
# On-Call Rotation
Primary: +1-XXX-XXX-XXXX
Secondary: +1-XXX-XXX-XXXX

# Escalation Contacts
Team Lead: lead@spheroseg.com
CTO: cto@spheroseg.com
Security: security@spheroseg.com

# External Contacts
AWS Support: [Account ID]
Domain Registrar: [Support URL]
SSL Provider: Let's Encrypt Community
```

### Communication Templates

**Incident Start**
```
Subject: [P1] SpherosegV4 Service Disruption

We are currently experiencing issues with SpherosegV4.
Impact: [Description of impact]
Start Time: [Time]
Status: Investigating

Updates will be provided every 30 minutes.
```

**Incident Update**
```
Subject: [P1] SpherosegV4 Service Disruption - Update

Current Status: [Investigating/Identified/Monitoring]
Actions Taken: [List of actions]
Next Steps: [Planned actions]
ETA: [Estimated resolution time]

Next update in 30 minutes.
```

**Incident Resolution**
```
Subject: [RESOLVED] SpherosegV4 Service Disruption

The issue has been resolved.
Resolution: [What fixed it]
Duration: [Total downtime]
Impact: [Final impact assessment]

A post-mortem will be conducted and shared within 48 hours.
```

---

Last Updated: 2025-07-19
Version: 1.0.0