# SpherosegV4 Production Deployment Guide

This comprehensive guide covers the complete deployment process for SpherosegV4, including infrastructure setup, security configuration, monitoring, and operational procedures.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Infrastructure Requirements](#infrastructure-requirements)
4. [Security Configuration](#security-configuration)
5. [Deployment Process](#deployment-process)
6. [SSL/TLS Certificate Setup](#ssltls-certificate-setup)
7. [Monitoring and Alerting](#monitoring-and-alerting)
8. [Backup and Recovery](#backup-and-recovery)
9. [Scaling and Performance](#scaling-and-performance)
10. [Troubleshooting](#troubleshooting)
11. [Maintenance Procedures](#maintenance-procedures)

## Overview

SpherosegV4 is deployed as a containerized microservices application using Docker Compose. The production deployment includes:

- **Frontend**: React application served by Nginx
- **Backend**: Node.js API server with Express
- **ML Service**: Python Flask application for cell segmentation
- **Database**: PostgreSQL with automated backups
- **Cache**: Redis for session management and caching
- **Monitoring**: Prometheus, Grafana, and AlertManager
- **Reverse Proxy**: Nginx with SSL termination and load balancing

## Prerequisites

### System Requirements

- Ubuntu 20.04 LTS or later (recommended)
- Docker Engine 20.10+
- Docker Compose 2.0+
- Git
- SSL certificates (Let's Encrypt recommended)
- Domain name with DNS control

### Required Software Installation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installations
docker --version
docker-compose --version
```

## Infrastructure Requirements

### Hardware Specifications

**Minimum Requirements:**
- CPU: 4 cores
- RAM: 8GB
- Storage: 50GB SSD
- Network: 100 Mbps

**Recommended Requirements:**
- CPU: 8+ cores
- RAM: 16GB+
- Storage: 100GB+ SSD
- Network: 1 Gbps
- GPU: NVIDIA GPU for ML acceleration (optional)

### Network Configuration

Open the following ports in your firewall:

```bash
# HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Monitoring (restrict to internal network)
sudo ufw allow from 10.0.0.0/8 to any port 3001  # Grafana
sudo ufw allow from 10.0.0.0/8 to any port 9090  # Prometheus
sudo ufw allow from 10.0.0.0/8 to any port 9093  # AlertManager

# SSH (restrict to your IP)
sudo ufw allow from YOUR_IP to any port 22
sudo ufw enable
```

## Security Configuration

### Docker Secrets Setup

Create all required secrets before deployment:

```bash
# Database credentials
echo "postgres" | docker secret create db_user -
echo "your-strong-password" | docker secret create db_password -
echo "postgresql://postgres:your-strong-password@db:5432/spheroseg" | docker secret create database_url -

# JWT secrets (generate strong random secrets)
openssl rand -base64 64 | docker secret create jwt_secret -
openssl rand -base64 64 | docker secret create jwt_refresh_secret -

# Redis configuration
echo "redis://redis:6379" | docker secret create redis_url -
openssl rand -base64 32 | docker secret create redis_password -

# Session secret
openssl rand -base64 64 | docker secret create session_secret -

# Backup credentials (if using S3)
echo "your-aws-access-key" | docker secret create aws_access_key_id -
echo "your-aws-secret-key" | docker secret create aws_secret_access_key -
```

### Environment Configuration

Create `.env.production` file:

```bash
# Copy template
cp .env.production.template .env.production

# Edit with your values
nano .env.production
```

Required environment variables:

```env
# Production Environment
NODE_ENV=production

# Domain configuration
DOMAIN=your-domain.com
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com

# API URLs
VITE_API_URL=https://api.your-domain.com
VITE_API_BASE_URL=/api
VITE_ASSETS_URL=https://assets.your-domain.com

# Backup configuration
BACKUP_SCHEDULE=0 2 * * *  # Daily at 2 AM
BACKUP_RETENTION_DAYS=30
BACKUP_S3_BUCKET=your-backup-bucket

# Monitoring
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=secure-password
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Optional GPU configuration
CUDA_VISIBLE_DEVICES=0
```

## Deployment Process

### 1. Clone Repository

```bash
git clone https://github.com/your-org/spheroseg.git
cd spheroseg/spheroseg
```

### 2. Run Deployment Script

The automated deployment script handles the complete setup:

```bash
# Make script executable
chmod +x scripts/deploy-production.sh

# Run deployment
./scripts/deploy-production.sh
```

The script will:
1. Check prerequisites
2. Create required directories
3. Verify Docker secrets
4. Build Docker images
5. Run database migrations
6. Start all services
7. Verify health status
8. Start monitoring stack

### 3. Manual Deployment (Alternative)

If you prefer manual deployment:

```bash
# Create directories
mkdir -p logs/{nginx,backend,ml}
mkdir -p uploads backup ssl

# Build images
docker-compose -f docker-compose.prod.yml build

# Run migrations
docker-compose -f docker-compose.prod.yml run --rm backend npm run db:migrate

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Start monitoring
docker-compose -f monitoring/docker-compose.monitoring.yml up -d
```

## SSL/TLS Certificate Setup

### Automated Let's Encrypt Setup

```bash
# Make script executable
chmod +x scripts/setup-ssl.sh

# Run SSL setup
sudo ./scripts/setup-ssl.sh your-domain.com admin@your-domain.com

# For testing (staging certificates)
sudo ./scripts/setup-ssl.sh your-domain.com admin@your-domain.com true
```

### Manual SSL Setup

1. **Install Certbot:**
```bash
sudo apt install certbot python3-certbot-nginx
```

2. **Obtain certificates:**
```bash
sudo certbot certonly --standalone \
  --agree-tos \
  --email admin@your-domain.com \
  -d your-domain.com \
  -d www.your-domain.com \
  -d api.your-domain.com \
  -d assets.your-domain.com
```

3. **Copy certificates:**
```bash
sudo cp /etc/letsencrypt/live/your-domain.com/*.pem ./ssl/
sudo chown -R $USER:$USER ./ssl/
```

### Certificate Renewal

Certificates auto-renew via cron job. To manually renew:

```bash
sudo certbot renew --quiet
docker-compose -f docker-compose.prod.yml restart nginx
```

## Monitoring and Alerting

### Accessing Monitoring Tools

After deployment, access monitoring interfaces:

- **Grafana**: http://your-domain.com:3001
  - Default login: admin / (password from .env.production)
  - Pre-configured dashboards for all services

- **Prometheus**: http://your-domain.com:9090
  - Query interface for metrics
  - Target status monitoring

- **AlertManager**: http://your-domain.com:9093
  - Alert routing and silencing
  - Integration with Slack/email

### Key Metrics to Monitor

1. **Application Metrics:**
   - Request rate and latency
   - Error rates
   - Active users
   - Database query performance

2. **Infrastructure Metrics:**
   - CPU and memory usage
   - Disk I/O and space
   - Network traffic
   - Container health

3. **Business Metrics:**
   - Image processing rate
   - Segmentation success rate
   - User activity patterns

### Setting Up Alerts

Configure alerts in `monitoring/alerts/alert.rules.yml`:

```yaml
groups:
  - name: application
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: High error rate detected
          
      - alert: DatabaseDown
        expr: up{job="postgresql"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: PostgreSQL database is down
```

## Backup and Recovery

### Automated Backups

Backups run automatically via cron job (default: 2 AM daily).

### Manual Backup

```bash
# Trigger immediate backup
docker-compose -f docker-compose.prod.yml exec backup /usr/local/bin/backup.sh

# Verify backup
docker-compose -f docker-compose.prod.yml exec backup ls -la /backup/
```

### Restore from Backup

1. **From local backup:**
```bash
# Stop backend services
docker-compose -f docker-compose.prod.yml stop backend ml

# Restore database
docker-compose -f docker-compose.prod.yml exec -T db psql -U postgres -d spheroseg < backup_file.sql

# Restart services
docker-compose -f docker-compose.prod.yml start backend ml
```

2. **From S3 backup:**
```bash
# Download backup
aws s3 cp s3://your-bucket/database-backups/spheroseg_backup_20240710_020000.sql.gz .

# Decompress
gunzip spheroseg_backup_20240710_020000.sql.gz

# Restore
docker-compose -f docker-compose.prod.yml exec -T db psql -U postgres -d spheroseg < spheroseg_backup_20240710_020000.sql
```

## Scaling and Performance

### Horizontal Scaling

Scale backend services for high load:

```bash
# Scale backend to 3 instances
docker-compose -f docker-compose.prod.yml up -d --scale backend=3

# Scale ML service (if GPU allows)
docker-compose -f docker-compose.prod.yml up -d --scale ml=2
```

### Performance Tuning

1. **Database Optimization:**
```sql
-- Add indexes for common queries
CREATE INDEX idx_images_user_created ON images(user_id, created_at);
CREATE INDEX idx_segmentation_status ON images(segmentation_status);

-- Analyze tables
ANALYZE images;
ANALYZE segmentation_results;
```

2. **Redis Configuration:**
```bash
# Set memory policy
docker-compose -f docker-compose.prod.yml exec redis redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

3. **Nginx Caching:**
Configure in `nginx/prod.conf` for static assets and API responses.

## Troubleshooting

### Common Issues

1. **Services not starting:**
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs -f [service-name]

# Check container status
docker-compose -f docker-compose.prod.yml ps
```

2. **Database connection issues:**
```bash
# Test database connection
docker-compose -f docker-compose.prod.yml exec backend npm run db:test

# Check PostgreSQL logs
docker-compose -f docker-compose.prod.yml logs -f db
```

3. **High memory usage:**
```bash
# Check memory stats
docker stats

# Force garbage collection (backend)
docker-compose -f docker-compose.prod.yml exec backend kill -USR2 1
```

### Debug Mode

Enable debug logging:

```bash
# Backend
docker-compose -f docker-compose.prod.yml exec backend sh
export DEBUG=spheroseg:*
kill -HUP 1

# ML Service
docker-compose -f docker-compose.prod.yml exec ml sh
export FLASK_ENV=development
kill -HUP 1
```

## Maintenance Procedures

### Regular Maintenance Tasks

1. **Weekly:**
   - Review monitoring dashboards
   - Check backup integrity
   - Review error logs
   - Update dependencies (test in staging first)

2. **Monthly:**
   - Perform backup restoration test
   - Review and optimize database
   - Update SSL certificates
   - Security audit

3. **Quarterly:**
   - Full system backup
   - Performance baseline review
   - Capacity planning
   - Disaster recovery drill

### Updating the Application

1. **Backup current state:**
```bash
./scripts/backup/backup.sh
```

2. **Pull latest changes:**
```bash
git pull origin main
```

3. **Build new images:**
```bash
docker-compose -f docker-compose.prod.yml build
```

4. **Run migrations:**
```bash
docker-compose -f docker-compose.prod.yml run --rm backend npm run db:migrate
```

5. **Rolling update:**
```bash
# Update services one by one
docker-compose -f docker-compose.prod.yml up -d --no-deps backend
# Wait for health check
sleep 30
docker-compose -f docker-compose.prod.yml up -d --no-deps ml
docker-compose -f docker-compose.prod.yml up -d --no-deps frontend
```

### Emergency Procedures

1. **Service Outage:**
   - Check monitoring alerts
   - Review service logs
   - Restart affected services
   - Escalate if needed

2. **Data Corruption:**
   - Stop affected services
   - Restore from latest backup
   - Verify data integrity
   - Resume operations

3. **Security Incident:**
   - Isolate affected systems
   - Review access logs
   - Change all secrets
   - Notify stakeholders

## Appendix

### Useful Commands

```bash
# View all logs
docker-compose -f docker-compose.prod.yml logs -f

# Enter container shell
docker-compose -f docker-compose.prod.yml exec [service] sh

# Database console
docker-compose -f docker-compose.prod.yml exec db psql -U postgres -d spheroseg

# Redis console
docker-compose -f docker-compose.prod.yml exec redis redis-cli

# Force recreate services
docker-compose -f docker-compose.prod.yml up -d --force-recreate

# Clean up unused resources
docker system prune -a --volumes
```

### Environment Variables Reference

See `.env.production.template` for complete list of configurable options.

### Support Contacts

- Technical Issues: tech-support@spheroseg.com
- Security Issues: security@spheroseg.com
- Emergency: +1-XXX-XXX-XXXX

---

Last Updated: 2025-07-19
Version: 1.0.0