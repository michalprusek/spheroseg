# SpherosegV4 Rollback Procedures

This document provides detailed procedures for rolling back deployments, database changes, and configuration updates in case of issues.

## Table of Contents

1. [Rollback Scenarios](#rollback-scenarios)
2. [Pre-Rollback Checklist](#pre-rollback-checklist)
3. [Application Rollback](#application-rollback)
4. [Database Rollback](#database-rollback)
5. [Infrastructure Rollback](#infrastructure-rollback)
6. [Configuration Rollback](#configuration-rollback)
7. [Emergency Procedures](#emergency-procedures)
8. [Post-Rollback Actions](#post-rollback-actions)

## Rollback Scenarios

### Scenario 1: Minor Issue (< 5 min downtime)
- Application errors but data intact
- Configuration issues
- Service startup failures

### Scenario 2: Major Issue (< 30 min downtime)
- Database migration problems
- Data corruption in non-critical tables
- Infrastructure changes causing instability

### Scenario 3: Critical Issue (> 30 min downtime)
- Complete system failure
- Critical data corruption
- Security breach

## Pre-Rollback Checklist

Before initiating rollback:

```bash
# 1. Document the issue
echo "Issue: [Description]" > rollback_$(date +%Y%m%d_%H%M%S).log
echo "Affected services: [List]" >> rollback_*.log
echo "Error messages: [Paste errors]" >> rollback_*.log

# 2. Capture current state
docker-compose ps >> rollback_*.log
docker-compose logs --tail=100 >> rollback_*.log

# 3. Notify stakeholders
# Send notification to team about rollback initiation

# 4. Create safety backup
docker-compose exec db pg_dump -U postgres spheroseg > emergency_backup_$(date +%Y%m%d_%H%M%S).sql
```

## Application Rollback

### Quick Rollback (Docker)

```bash
#!/bin/bash
# rollback-app.sh

# Set variables
PREVIOUS_VERSION="v3.9.0"  # Change to your previous version
ROLLBACK_TIME=$(date +%Y%m%d_%H%M%S)

# Step 1: Stop current services
echo "Stopping current services..."
docker-compose stop

# Step 2: Tag current images for potential recovery
echo "Tagging current images..."
docker tag spheroseg_backend:latest spheroseg_backend:rollback_$ROLLBACK_TIME
docker tag spheroseg_frontend:latest spheroseg_frontend:rollback_$ROLLBACK_TIME
docker tag spheroseg_ml:latest spheroseg_ml:rollback_$ROLLBACK_TIME

# Step 3: Checkout previous version
echo "Checking out previous version: $PREVIOUS_VERSION"
git fetch --tags
git checkout $PREVIOUS_VERSION

# Step 4: Rebuild with previous version
echo "Building previous version..."
docker-compose build --no-cache

# Step 5: Start services
echo "Starting services..."
docker-compose up -d

# Step 6: Verify services
echo "Verifying services..."
sleep 10
docker-compose ps
curl -f http://localhost:5001/api/health || echo "Backend health check failed!"
```

### Rollback with Zero Downtime (Blue-Green)

```bash
#!/bin/bash
# blue-green-rollback.sh

# Assumes you have blue and green environments

# Step 1: Verify green (old) environment is ready
docker-compose -f docker-compose.green.yml ps

# Step 2: Run health checks on green
curl -f http://localhost:5002/api/health || exit 1

# Step 3: Switch load balancer to green
cat > nginx/upstream.conf << EOF
upstream backend {
    server backend-green:5001;
}
EOF

# Step 4: Reload nginx
docker-compose exec nginx nginx -s reload

# Step 5: Stop blue (problematic) environment
docker-compose -f docker-compose.blue.yml down

echo "Rollback completed. Now running on green environment."
```

## Database Rollback

### Rollback Individual Migration

```sql
-- Connect to database
docker-compose exec db psql -U postgres -d spheroseg

-- Check migration history
SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 10;

-- Rollback specific migration
\i scripts/rollback/012_session_management_rollback.sql
\i scripts/rollback/011_monitoring_tables_rollback.sql
\i scripts/rollback/010_performance_indexes_rollback.sql

-- Verify rollback
\dt
\di
```

### Full Database Restoration

```bash
#!/bin/bash
# restore-database.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: ./restore-database.sh <backup_file>"
    exit 1
fi

# Step 1: Stop application services (keep db running)
docker-compose stop backend ml frontend-prod

# Step 2: Create restore point
docker-compose exec db pg_dump -U postgres spheroseg > pre_restore_$(date +%Y%m%d_%H%M%S).sql

# Step 3: Drop and recreate database
docker-compose exec db psql -U postgres << EOF
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'spheroseg';
DROP DATABASE IF EXISTS spheroseg;
CREATE DATABASE spheroseg OWNER postgres;
EOF

# Step 4: Restore from backup
docker-compose exec -T db psql -U postgres -d spheroseg < $BACKUP_FILE

# Step 5: Verify restoration
docker-compose exec db psql -U postgres -d spheroseg -c "\dt"

# Step 6: Restart services
docker-compose up -d backend ml frontend-prod

echo "Database restored from $BACKUP_FILE"
```

### Rollback Database Schema Only

```bash
# Create schema-only backup before changes
pg_dump -U postgres -h localhost -d spheroseg --schema-only > schema_backup.sql

# Rollback schema
psql -U postgres -h localhost -d spheroseg < schema_backup.sql
```

## Infrastructure Rollback

### Docker Compose Rollback

```bash
#!/bin/bash
# rollback-infrastructure.sh

# Step 1: Backup current compose file
cp docker-compose.yml docker-compose.yml.failed

# Step 2: Restore previous compose file
cp docker-compose.yml.backup docker-compose.yml

# Step 3: Restore environment files
cp .env.backup packages/backend/.env
cp .env.frontend.backup packages/frontend/.env

# Step 4: Remove new services
docker-compose down --remove-orphans

# Step 5: Remove new volumes (careful!)
# docker volume rm spheroseg_redis_data  # Only if safe

# Step 6: Start with old configuration
docker-compose up -d

# Step 7: Verify services
docker-compose ps
```

### Rollback Monitoring Stack

```bash
# Stop monitoring services
docker-compose -f monitoring/docker-compose.monitoring.yml down

# Remove monitoring data (if needed)
docker volume rm monitoring_prometheus_data
docker volume rm monitoring_grafana_data

# Restore previous monitoring (if any)
docker-compose -f monitoring/docker-compose.monitoring.old.yml up -d
```

## Configuration Rollback

### Environment Variables

```bash
#!/bin/bash
# rollback-config.sh

# Backend configuration
cat > packages/backend/.env << 'EOF'
NODE_ENV=production
PORT=5001
DATABASE_URL=postgresql://postgres:postgres@db:5432/spheroseg
JWT_SECRET=your-old-jwt-secret
SESSION_SECRET=your-old-session-secret
ALLOWED_ORIGINS=http://localhost:3000,http://localhost
EOF

# Frontend configuration
cat > packages/frontend/.env << 'EOF'
VITE_API_URL=http://localhost:5001
VITE_API_BASE_URL=/api
VITE_ASSETS_URL=http://localhost:8080
EOF

# Restart services to apply
docker-compose restart backend frontend-prod
```

### Nginx Configuration Rollback

```bash
# Restore old nginx config
cp nginx/nginx.conf.backup nginx/nginx.conf

# Test configuration
docker-compose exec nginx nginx -t

# Reload if valid
docker-compose exec nginx nginx -s reload
```

### SSL Certificate Rollback

```bash
# Restore previous certificates
cp -r ./certbot/conf.backup/* ./certbot/conf/

# Update nginx to use old certificates
sed -i 's/new-cert.pem/old-cert.pem/g' nginx/prod.conf

# Restart nginx
docker-compose restart nginx-prod
```

## Emergency Procedures

### Complete System Failure

```bash
#!/bin/bash
# emergency-recovery.sh

echo "EMERGENCY RECOVERY INITIATED"

# 1. Stop everything
docker-compose down
docker stop $(docker ps -q)

# 2. Clean Docker system
docker system prune -f

# 3. Restore from full backup
./scripts/restore-full-backup.sh /backups/full_backup_latest.tar.gz

# 4. Start core services only
docker-compose up -d db
sleep 30
docker-compose up -d backend
sleep 10
docker-compose up -d frontend-prod nginx-prod

# 5. Verify core functionality
curl http://localhost/api/health || echo "System still down!"
```

### Data Corruption Recovery

```sql
-- Identify corrupted data
SELECT * FROM images WHERE created_at > '2024-01-19'::timestamp;

-- Create backup of corrupted table
CREATE TABLE images_corrupted AS SELECT * FROM images;

-- Restore from backup (partial)
BEGIN;
DELETE FROM images WHERE created_at > '2024-01-19'::timestamp;
INSERT INTO images SELECT * FROM backup.images WHERE created_at > '2024-01-19'::timestamp;
COMMIT;

-- Verify data integrity
SELECT COUNT(*) FROM images;
```

### Security Breach Response

```bash
#!/bin/bash
# security-rollback.sh

# 1. Isolate system
iptables -I INPUT -j DROP
iptables -I OUTPUT -j DROP
iptables -I INPUT -s 127.0.0.1 -j ACCEPT

# 2. Stop all services
docker-compose down

# 3. Rotate all secrets
echo "$(openssl rand -base64 32)" > ./secrets/jwt_secret.txt
echo "$(openssl rand -base64 32)" > ./secrets/session_secret.txt

# 4. Reset all passwords
docker-compose exec db psql -U postgres -d spheroseg << EOF
UPDATE users SET password_hash = NULL, must_reset_password = true;
EOF

# 5. Restore from secure backup
./scripts/restore-secure-backup.sh

# 6. Apply security patches
git checkout security-patch-branch
docker-compose build --no-cache

# 7. Restart with new security measures
docker-compose up -d
```

## Post-Rollback Actions

### 1. Verification Checklist

```bash
#!/bin/bash
# verify-rollback.sh

echo "=== Rollback Verification ==="

# Check services
echo "1. Checking services..."
docker-compose ps

# Check database
echo "2. Checking database..."
docker-compose exec db psql -U postgres -d spheroseg -c "SELECT COUNT(*) FROM users;"

# Check API
echo "3. Checking API..."
curl -s http://localhost:5001/api/health | jq .

# Check frontend
echo "4. Checking frontend..."
curl -I http://localhost

# Check logs for errors
echo "5. Checking for errors..."
docker-compose logs --tail=50 | grep -i error

echo "=== Verification Complete ==="
```

### 2. Communication

```markdown
## Rollback Notification Template

**Subject**: System Rollback Completed - [Date/Time]

**Status**: Rollback completed successfully

**Affected Services**: 
- Backend: Rolled back to v3.9.0
- Frontend: Rolled back to v3.9.0
- Database: Schema reverted to previous version

**Impact**:
- Downtime: 15 minutes
- Data Loss: None
- Affected Users: All

**Root Cause**: [Brief description]

**Next Steps**:
1. Monitor system for 24 hours
2. Fix identified issues
3. Plan re-deployment

**Contact**: DevOps Team - devops@company.com
```

### 3. Lessons Learned

Create a post-mortem document:

```markdown
# Post-Mortem: Deployment Rollback [Date]

## Summary
- **Date**: 2024-01-19
- **Duration**: 15 minutes
- **Impact**: Service unavailable

## Timeline
- 14:00 - Deployment started
- 14:15 - Errors detected
- 14:20 - Rollback initiated
- 14:35 - Service restored

## Root Cause
[Detailed explanation]

## Lessons Learned
1. Need better pre-deployment testing
2. Staging environment didn't match production
3. Missing monitoring alerts

## Action Items
- [ ] Add integration tests for [feature]
- [ ] Update staging environment
- [ ] Implement canary deployments
```

## Rollback Automation

### Automated Rollback Script

```bash
#!/bin/bash
# auto-rollback.sh

# Configuration
MAX_ERROR_RATE=5
HEALTH_CHECK_URL="http://localhost:5001/api/health"
ROLLBACK_TIMEOUT=300

# Monitor deployment
start_time=$(date +%s)

while true; do
    current_time=$(date +%s)
    elapsed=$((current_time - start_time))
    
    if [ $elapsed -gt $ROLLBACK_TIMEOUT ]; then
        echo "Monitoring timeout reached"
        break
    fi
    
    # Check health
    if ! curl -f $HEALTH_CHECK_URL > /dev/null 2>&1; then
        echo "Health check failed! Initiating rollback..."
        ./rollback-app.sh
        exit 1
    fi
    
    # Check error rate
    error_rate=$(docker-compose logs --tail=100 backend | grep -c ERROR)
    if [ $error_rate -gt $MAX_ERROR_RATE ]; then
        echo "High error rate detected! Initiating rollback..."
        ./rollback-app.sh
        exit 1
    fi
    
    sleep 10
done

echo "Deployment monitoring completed successfully"
```

## Testing Rollback Procedures

Regularly test rollback procedures:

```bash
# Monthly rollback drill
./scripts/rollback-drill.sh

# Test specific scenarios
./scripts/test-db-rollback.sh
./scripts/test-app-rollback.sh
./scripts/test-config-rollback.sh
```

## Important Notes

1. **Always test rollback procedures in staging first**
2. **Keep rollback scripts version-controlled**
3. **Document any manual steps required**
4. **Maintain backup retention policy**
5. **Regular drills ensure readiness**

## Quick Reference

| Issue Type | Rollback Script | Estimated Time |
|------------|----------------|----------------|
| App Error | `./rollback-app.sh` | 5 minutes |
| DB Error | `./restore-database.sh` | 15 minutes |
| Config Error | `./rollback-config.sh` | 2 minutes |
| Complete Failure | `./emergency-recovery.sh` | 30 minutes |

## Support Contacts

- **DevOps Lead**: devops-lead@company.com
- **Database Admin**: dba@company.com  
- **On-Call**: +1-555-0123 (24/7)
- **Escalation**: cto@company.com