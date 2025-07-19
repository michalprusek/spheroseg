# SpherosegV4 Deployment Migration Guide

This guide helps you migrate existing SpherosegV4 deployments to the latest production-ready version with enhanced features, monitoring, and security.

## Prerequisites

Before starting the migration:

1. **Backup Everything**
   ```bash
   # Database backup
   docker-compose exec db pg_dump -U postgres spheroseg > backup_$(date +%Y%m%d_%H%M%S).sql
   
   # File storage backup
   tar -czf storage_backup_$(date +%Y%m%d_%H%M%S).tar.gz ./uploads ./assets
   
   # Configuration backup
   cp -r .env* ./backup/
   ```

2. **Check Current Version**
   ```bash
   git describe --tags
   docker-compose ps
   ```

3. **Review Breaking Changes**
   - Session management now uses Redis
   - Error handling system completely revamped
   - New monitoring stack with Prometheus/Grafana
   - Docker Secrets for sensitive data

## Migration Steps

### Phase 1: Infrastructure Updates

#### 1.1 Update Docker Compose Configuration

Replace your `docker-compose.yml` with the new production configuration:

```bash
# Backup existing compose file
cp docker-compose.yml docker-compose.yml.backup

# Copy new production compose file
cp docker-compose.prod.yml docker-compose.yml
```

#### 1.2 Create Docker Secrets

Create secrets for sensitive data:

```bash
# Create secrets directory
mkdir -p ./secrets

# Generate secrets
echo "your-postgres-password" > ./secrets/postgres_password.txt
echo "your-jwt-secret" > ./secrets/jwt_secret.txt
echo "your-session-secret" > ./secrets/session_secret.txt
echo "your-redis-password" > ./secrets/redis_password.txt

# Set proper permissions
chmod 600 ./secrets/*.txt
```

#### 1.3 Update Environment Variables

Update your `.env` files to use the new configuration:

```bash
# Backend environment
cat > packages/backend/.env.production << EOF
NODE_ENV=production
PORT=5001
DATABASE_URL=postgresql://postgres:@db:5432/spheroseg
REDIS_URL=redis://:@redis:6379
ALLOWED_ORIGINS=https://your-domain.com
STORAGE_PATH=/app/storage
PUBLIC_URL=https://your-domain.com
EOF

# Frontend environment
cat > packages/frontend/.env.production << EOF
VITE_API_URL=https://your-domain.com
VITE_API_BASE_URL=/api
VITE_ASSETS_URL=https://your-domain.com/assets
VITE_WS_URL=wss://your-domain.com
EOF
```

### Phase 2: Database Migration

#### 2.1 Connect to Database

```bash
docker-compose exec db psql -U postgres -d spheroseg
```

#### 2.2 Run Migration Scripts

Execute migrations in order:

```sql
-- Add new indexes for performance
\i scripts/migrations/010_add_performance_indexes.sql

-- Add monitoring tables
\i scripts/migrations/011_add_monitoring_tables.sql

-- Update session management
\i scripts/migrations/012_session_management.sql
```

#### 2.3 Verify Migration

```sql
-- Check indexes
\di

-- Verify new tables
\dt

-- Check constraints
\d+ users
\d+ images
\d+ projects
```

### Phase 3: Application Updates

#### 3.1 Stop Current Services

```bash
# Stop services gracefully
docker-compose stop

# Wait for services to stop
docker-compose ps
```

#### 3.2 Pull Latest Code

```bash
# Fetch latest changes
git fetch origin

# Checkout new version
git checkout v4.0.0  # or specific tag

# Install dependencies
npm install
npm run build
```

#### 3.3 Build New Images

```bash
# Build all services
docker-compose build --no-cache

# Verify images
docker images | grep spheroseg
```

### Phase 4: Deploy New Stack

#### 4.1 Start Core Services

Start services in order:

```bash
# Start database and Redis first
docker-compose up -d db redis

# Wait for them to be ready
docker-compose exec db pg_isready
docker-compose exec redis redis-cli ping

# Start backend services
docker-compose up -d backend ml assets

# Start frontend and proxy
docker-compose up -d frontend-prod nginx-prod
```

#### 4.2 Verify Services

```bash
# Check all services are running
docker-compose ps

# Check logs for errors
docker-compose logs --tail=50 backend
docker-compose logs --tail=50 frontend-prod

# Test endpoints
curl https://your-domain.com/api/health
curl https://your-domain.com
```

### Phase 5: Monitoring Setup

#### 5.1 Deploy Monitoring Stack

```bash
# Start monitoring services
docker-compose -f monitoring/docker-compose.monitoring.yml up -d

# Verify services
docker-compose -f monitoring/docker-compose.monitoring.yml ps
```

#### 5.2 Configure Grafana

1. Access Grafana at `http://your-domain.com:3001`
2. Default credentials: admin/admin
3. Import dashboards from `monitoring/grafana/dashboards/`
4. Configure alert channels

#### 5.3 Setup Alerts

Configure AlertManager:

```yaml
# monitoring/alertmanager/config.yml
global:
  smtp_from: 'alerts@your-domain.com'
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_auth_username: 'your-email@gmail.com'
  smtp_auth_password: 'your-app-password'

route:
  receiver: 'team-emails'

receivers:
  - name: 'team-emails'
    email_configs:
      - to: 'team@your-domain.com'
```

### Phase 6: SSL/TLS Configuration

#### 6.1 Setup Let's Encrypt

```bash
# Initial certificate generation
docker-compose run --rm certbot-prod certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email admin@your-domain.com \
  --agree-tos \
  --no-eff-email \
  -d your-domain.com \
  -d www.your-domain.com

# Verify certificates
ls -la ./certbot/conf/live/your-domain.com/
```

#### 6.2 Configure Nginx

Update `nginx/prod.conf` with your domain:

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # ... rest of configuration
}
```

### Phase 7: Data Migration

#### 7.1 Migrate File Storage

If storage structure changed:

```bash
# Run migration script
docker-compose exec backend node scripts/migrate-storage.js

# Verify files
docker-compose exec backend ls -la /app/storage/
```

#### 7.2 Update Database Records

```sql
-- Update image paths if needed
UPDATE images 
SET storage_path = REPLACE(storage_path, '/old/path', '/app/storage')
WHERE storage_path LIKE '/old/path%';

-- Verify updates
SELECT COUNT(*) FROM images WHERE storage_path LIKE '/app/storage%';
```

### Phase 8: Verification

#### 8.1 Health Checks

```bash
# Backend health
curl https://your-domain.com/api/health

# ML service health  
curl https://your-domain.com/api/ml/health

# Frontend
curl -I https://your-domain.com
```

#### 8.2 Functional Tests

1. **Authentication**
   - Login with existing account
   - Verify session persistence
   - Test logout

2. **Core Features**
   - Upload new image
   - Run segmentation
   - View results
   - Export data

3. **Performance**
   - Check response times
   - Monitor resource usage
   - Verify caching

#### 8.3 Monitoring Verification

- Check Prometheus targets: `http://your-domain.com:9090/targets`
- Verify Grafana dashboards are receiving data
- Test alert notifications

### Phase 9: Cleanup

#### 9.1 Remove Old Containers

```bash
# List old containers
docker ps -a | grep spheroseg

# Remove old containers
docker container prune

# Remove old images
docker image prune
```

#### 9.2 Archive Old Configuration

```bash
# Create archive directory
mkdir -p ./archive/migration_$(date +%Y%m%d)

# Move old files
mv docker-compose.yml.backup ./archive/migration_$(date +%Y%m%d)/
mv .env.backup ./archive/migration_$(date +%Y%m%d)/
```

## Rollback Procedure

If issues occur during migration:

### Quick Rollback (< 5 minutes downtime)

```bash
# Stop new services
docker-compose down

# Restore old compose file
cp docker-compose.yml.backup docker-compose.yml

# Start old services
docker-compose up -d

# Restore database if needed
docker-compose exec db psql -U postgres -d spheroseg < backup_YYYYMMDD_HHMMSS.sql
```

### Full Rollback

See [Rollback Procedures](./rollback-procedures.md) for detailed steps.

## Post-Migration Tasks

### 1. Update Documentation

- Update README with new endpoints
- Document new environment variables
- Update API documentation

### 2. Configure Backups

```bash
# Setup automated backups
crontab -e

# Add backup jobs
0 2 * * * /path/to/backup-script.sh
0 */6 * * * /path/to/incremental-backup.sh
```

### 3. Performance Tuning

- Adjust resource limits based on usage
- Configure autoscaling rules
- Optimize database queries

### 4. Security Hardening

- Run security scan
- Update firewall rules
- Configure fail2ban
- Enable audit logging

## Troubleshooting

### Common Issues

1. **Redis Connection Failed**
   ```bash
   # Check Redis is running
   docker-compose exec redis redis-cli ping
   
   # Check password in secrets
   cat ./secrets/redis_password.txt
   ```

2. **Database Migration Failed**
   ```bash
   # Check for locks
   docker-compose exec db psql -U postgres -d spheroseg -c "SELECT * FROM pg_locks;"
   
   # Kill blocking queries if needed
   docker-compose exec db psql -U postgres -d spheroseg -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle';"
   ```

3. **SSL Certificate Issues**
   ```bash
   # Test certificate
   openssl s_client -connect your-domain.com:443 -servername your-domain.com
   
   # Renew if needed
   docker-compose run --rm certbot-prod renew
   ```

### Getting Help

1. Check logs: `docker-compose logs [service]`
2. Review monitoring dashboards
3. Check [GitHub Issues](https://github.com/yourusername/spheroseg/issues)
4. Contact support with:
   - Error messages
   - Log excerpts
   - Steps to reproduce

## Migration Checklist

- [ ] Backup database
- [ ] Backup file storage
- [ ] Backup configuration
- [ ] Update Docker Compose files
- [ ] Create Docker Secrets
- [ ] Update environment variables
- [ ] Run database migrations
- [ ] Build new images
- [ ] Deploy services in order
- [ ] Setup SSL certificates
- [ ] Configure monitoring
- [ ] Run verification tests
- [ ] Update documentation
- [ ] Configure automated backups
- [ ] Cleanup old resources

## Success Criteria

Your migration is successful when:

1. All services are running without errors
2. Users can login and access their data
3. Image processing works correctly
4. Monitoring shows healthy metrics
5. SSL certificates are valid
6. Automated backups are running
7. No data loss occurred

## Next Steps

After successful migration:

1. Monitor system for 24-48 hours
2. Collect user feedback
3. Fine-tune performance settings
4. Plan for next updates
5. Document lessons learned