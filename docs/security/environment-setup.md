# Environment Setup and Secret Management

## Overview

This guide covers setting up environment variables and managing secrets securely for the SpherosegV4 application.

## Quick Start

1. **Copy the example environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Generate secure secrets:**
   ```bash
   # Generate JWT secret (32+ characters)
   openssl rand -base64 32
   
   # Generate strong passwords
   openssl rand -base64 16
   ```

3. **Update `.env` with your values:**
   - Replace all placeholder values
   - Use strong, unique passwords
   - Never commit `.env` to version control

4. **Verify configuration:**
   ```bash
   ./scripts/check-env.sh
   ```

## Required Environment Variables

### Database Configuration
- `DB_USER`: Database username (default: postgres)
- `DB_PASSWORD`: **Required** - Database password (no default)
- `DB_HOST`: Database host (default: db)
- `DB_PORT`: Database port (default: 5432)
- `DB_NAME`: Database name (default: spheroseg)

### Security
- `JWT_SECRET`: **Required** - JWT signing secret (min 32 characters)
- `JWT_REFRESH_SECRET`: Refresh token secret (recommended)

### PostgreSQL Container
- `POSTGRES_USER`: PostgreSQL admin user
- `POSTGRES_PASSWORD`: **Required** - PostgreSQL admin password
- `POSTGRES_DB`: Initial database name

### RabbitMQ
- `RABBITMQ_DEFAULT_USER`: RabbitMQ admin user
- `RABBITMQ_DEFAULT_PASS`: **Required** - RabbitMQ password

## Security Best Practices

### 1. Secret Generation

Generate cryptographically secure secrets:

```bash
# JWT secrets (use different values for each)
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)

# Database passwords
DB_PASSWORD=$(openssl rand -base64 16)
POSTGRES_PASSWORD=$DB_PASSWORD  # Keep them in sync

# Service passwords
RABBITMQ_DEFAULT_PASS=$(openssl rand -base64 16)
REDIS_PASSWORD=$(openssl rand -base64 16)
```

### 2. Environment File Security

- **Never commit `.env`** - It's in `.gitignore` by default
- **Restrict file permissions:**
  ```bash
  chmod 600 .env
  ```
- **Use different values** for each environment (dev, staging, prod)

### 3. Production Deployment

For production, consider:

1. **Environment Variable Injection:**
   - Use CI/CD secrets management
   - Docker secrets
   - Kubernetes secrets
   - Cloud provider secret managers (AWS Secrets Manager, Azure Key Vault, etc.)

2. **Secret Rotation:**
   - Implement regular rotation for all secrets
   - Update JWT secrets without downtime using multiple keys

3. **Monitoring:**
   - Monitor for exposed secrets in logs
   - Use secret scanning in CI/CD

## Docker Compose Security

The updated `docker-compose.yml` now requires environment variables for all sensitive data:

```yaml
environment:
  - JWT_SECRET=${JWT_SECRET}  # No default fallback
  - DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}
```

This ensures that:
- No secrets are hardcoded
- Missing required variables will cause startup failures (fail-fast)
- Environment-specific configuration is enforced

## Troubleshooting

### Missing Environment Variables

If you see errors about missing environment variables:

1. Run the check script:
   ```bash
   ./scripts/check-env.sh
   ```

2. Ensure `.env` file exists and is readable:
   ```bash
   ls -la .env
   ```

3. Source the file if running commands manually:
   ```bash
   source .env
   ```

### Docker Compose Issues

If services fail to start:

1. Check Docker Compose interpolation:
   ```bash
   docker-compose config
   ```

2. Verify environment variables are loaded:
   ```bash
   docker-compose run --rm backend env | grep JWT
   ```

## Development vs Production

### Development
- Use `.env` file for convenience
- Can use weaker passwords for local testing
- Enable debug logging

### Production
- Use proper secret management system
- Strong, unique passwords for all services
- Disable debug logging
- Enable audit logging
- Regular secret rotation

## Compliance

This setup helps meet common security requirements:
- **OWASP**: Secure password storage, strong session management
- **PCI DSS**: Encryption of sensitive data, access control
- **GDPR**: Data protection through encryption
- **SOC 2**: Secure configuration management