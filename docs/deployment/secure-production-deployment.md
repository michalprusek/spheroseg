# Secure Production Deployment Guide

This guide outlines the secure deployment process for SpherosegV4 using Docker Secrets and production best practices.

## Prerequisites

- Docker 20.10+ with Swarm mode
- SSL certificates (Let's Encrypt recommended)
- Backup storage location
- SMTP credentials for email notifications

## Security Enhancements

### 1. Docker Secrets Management

All sensitive data is now managed through Docker Secrets instead of environment variables:

- **Database passwords**: Stored as `db_password` and `db_root_password`
- **JWT/Session secrets**: 64-character secrets for enhanced security
- **Service passwords**: Individual passwords for Redis, RabbitMQ, etc.
- **SSL certificates**: Managed as secrets, not mounted volumes

### 2. Memory and Resource Limits

Production-ready resource allocations:

```yaml
Backend: 2GB RAM, 2 CPUs (with 2 replicas)
ML Service: 8GB RAM, 4 CPUs
Database: 1GB RAM, 2 CPUs
Redis: 512MB RAM, 1 CPU
```

### 3. Automated Backups

Database backups run every 6 hours with 7-day retention:
- Compressed SQL dumps
- Stored in `./backups` directory
- Automatic cleanup of old backups

### 4. Monitoring Stack

Integrated Prometheus and Grafana for comprehensive monitoring:
- Application metrics
- System metrics
- Database performance
- Custom dashboards

## Deployment Steps

### 1. Initialize Docker Swarm

```bash
docker swarm init
```

### 2. Generate Secrets

```bash
cd /home/cvat/spheroseg/spheroseg
./scripts/create-docker-secrets.sh
```

This script will:
- Generate secure random passwords
- Create Docker secrets
- Save credentials to `secrets/production-credentials.txt`
- Create `.env.production` with non-secret configs

### 3. Configure SSL Certificates

#### Option A: Let's Encrypt (Recommended)

```bash
# Install certbot
sudo apt-get update
sudo apt-get install certbot

# Generate certificates
sudo certbot certonly --standalone -d spherosegapp.utia.cas.cz

# Create Docker secrets from certificates
docker secret create ssl_cert /etc/letsencrypt/live/spherosegapp.utia.cas.cz/fullchain.pem
docker secret create ssl_key /etc/letsencrypt/live/spherosegapp.utia.cas.cz/privkey.pem
```

#### Option B: Use Existing Certificates

Place your certificates in the `ssl/` directory and the script will use them.

### 4. Configure Environment

Edit `.env.production` to match your environment:

```bash
# Update email settings
EMAIL_HOST=your-smtp-server.com
EMAIL_PORT=587
EMAIL_USER=your-email@domain.com

# Update application URL if different
APP_URL=https://your-domain.com
```

### 5. Deploy the Stack

```bash
# Deploy with production configuration
docker-compose -f docker-compose.yml -f docker-compose.production.yml --profile prod up -d

# Monitor deployment
docker service ls
docker service logs spheroseg-backend
```

### 6. Verify Deployment

```bash
# Check service health
curl https://spherosegapp.utia.cas.cz/api/health

# Check metrics endpoint
curl http://localhost:9090/metrics

# Access Grafana
# URL: http://localhost:3003
# User: admin
# Password: (from secrets/production-credentials.txt)
```

## Security Checklist

- [ ] All secrets generated with sufficient entropy (32-64 chars)
- [ ] SSL certificates from trusted CA (not self-signed)
- [ ] Firewall rules configured (only necessary ports open)
- [ ] Database backups tested and verified
- [ ] Monitoring alerts configured
- [ ] Log rotation enabled
- [ ] Rate limiting active
- [ ] CORS properly configured
- [ ] Security headers verified

## Maintenance

### Rotating Secrets

```bash
# Create new secret
docker secret create jwt_secret_v2 <(openssl rand -base64 64)

# Update service to use new secret
docker service update --secret-rm jwt_secret --secret-add jwt_secret_v2 spheroseg-backend

# Remove old secret
docker secret rm jwt_secret
```

### Backup Restoration

```bash
# List available backups
ls -la ./backups/

# Restore specific backup
gunzip -c ./backups/spheroseg_20250719_120000.sql.gz | \
  docker exec -i spheroseg-db psql -U postgres spheroseg
```

### Monitoring

Access Grafana dashboards at `http://localhost:3003` to monitor:
- Application performance
- Resource usage
- Error rates
- Database queries
- API response times

## Troubleshooting

### Secret Access Issues

```bash
# Verify secrets exist
docker secret ls

# Inspect secret (metadata only)
docker secret inspect jwt_secret

# Check service logs
docker service logs spheroseg-backend --tail 50
```

### Performance Issues

```bash
# Check resource usage
docker stats

# Scale services if needed
docker service scale spheroseg-backend=3
```

### Certificate Renewal

Set up automatic renewal for Let's Encrypt:

```bash
# Add to crontab
0 0 * * 0 certbot renew --quiet && docker service update --force spheroseg-nginx-prod
```

## Important Notes

1. **Never commit secrets** to version control
2. **Regularly test backups** by performing restore operations
3. **Monitor logs** for security events
4. **Keep Docker updated** for security patches
5. **Review and rotate secrets** every 90 days

## Support

For issues or questions, contact the development team or check the logs:

```bash
docker service logs spheroseg-backend --follow
docker service logs spheroseg-ml --follow
```