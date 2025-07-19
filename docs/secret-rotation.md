# Secret Rotation Guide

## Overview

SpherosegV4 implements an automated secret rotation system that ensures all sensitive credentials are regularly rotated with zero downtime. The system provides automated rotation, grace periods for migration, comprehensive audit logging, and emergency rotation capabilities.

## Features

- **Automated Rotation**: Secrets rotate automatically based on configured intervals
- **Zero-Downtime Deployment**: Grace periods allow gradual migration
- **Comprehensive Auditing**: All rotation events are logged for compliance
- **Emergency Rotation**: Manual rotation for security incidents
- **Multi-Channel Notifications**: Email, Slack, and webhook notifications
- **Version Management**: Multiple secret versions can coexist during grace periods
- **Distributed Locking**: Prevents concurrent rotation attempts

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Cron Scheduler │────▶│ Rotation Manager│────▶│  Redis Storage  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │                          │
                               ▼                          ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │  Secret Store   │     │   Audit Log     │
                        └─────────────────┘     └─────────────────┘
```

## Configuration

### Environment Variables

```bash
# JWT Rotation
JWT_ROTATION_DAYS=30              # Rotation interval for JWT secret
JWT_GRACE_PERIOD_HOURS=24         # Grace period for JWT migration
JWT_REFRESH_ROTATION_DAYS=90      # Rotation interval for refresh token secret
JWT_REFRESH_GRACE_PERIOD_HOURS=48 # Grace period for refresh token

# Session Secret Rotation
SESSION_ROTATION_DAYS=30          # Session secret rotation interval
SESSION_GRACE_PERIOD_HOURS=24     # Session secret grace period

# Database Password Rotation
DB_PASSWORD_ROTATION_DAYS=90      # Database password rotation interval
DB_PASSWORD_GRACE_PERIOD_HOURS=72 # Database password grace period

# API Key Rotation
API_KEY_ROTATION_DAYS=60          # API key rotation interval
API_KEY_GRACE_PERIOD_HOURS=48     # API key grace period

# Encryption Key Rotation
ENCRYPTION_KEY_ROTATION_DAYS=180  # Encryption key rotation interval
ENCRYPTION_KEY_GRACE_PERIOD_HOURS=168 # Encryption key grace period (1 week)
```

### Secret Types and Policies

| Secret Type | Min Rotation | Max Rotation | Min Grace Period | Default Length |
|-------------|--------------|--------------|------------------|----------------|
| JWT         | 30 days      | 90 days      | 12 hours         | 64 bytes       |
| API Key     | 30 days      | 180 days     | 24 hours         | 32 bytes       |
| Database    | 60 days      | 365 days     | 48 hours         | 24 chars       |
| Encryption  | 90 days      | 365 days     | 72 hours         | 32 bytes       |
| Session     | 30 days      | 90 days      | 12 hours         | 48 bytes       |

## Usage

### Automatic Rotation

Secrets are automatically rotated based on their configured intervals. The rotation scheduler runs daily at 3 AM and checks which secrets are due for rotation.

### Manual Rotation

Use the rotation script for manual operations:

```bash
# List all secrets and their status
npm run rotate-secrets -- --list

# Validate rotation configuration
npm run rotate-secrets -- --validate

# Rotate a specific secret
npm run rotate-secrets -- --secret JWT_SECRET

# Force rotation even if not due
npm run rotate-secrets -- --secret JWT_SECRET --force

# Emergency rotation with shorter grace period
npm run rotate-secrets -- --secret DATABASE_PASSWORD --emergency

# Dry run to see what would be rotated
npm run rotate-secrets -- --dry-run
```

### Emergency Rotation

In case of a security incident, perform emergency rotation:

```bash
# Emergency rotation with 4-hour grace period
npm run rotate-secrets -- --emergency

# Rotate specific compromised secret immediately
npm run rotate-secrets -- --secret API_KEY_INTERNAL --emergency --force
```

## Implementation Details

### Application Integration

The application must support reading both old and new secret versions during the grace period:

```typescript
// Example: JWT secret handling
const jwtSecret = process.env.JWT_SECRET_NEW || process.env.JWT_SECRET;

// Verify tokens with both secrets during grace period
try {
  payload = jwt.verify(token, process.env.JWT_SECRET_NEW);
} catch (error) {
  // Fallback to old secret
  payload = jwt.verify(token, process.env.JWT_SECRET);
}
```

### Database Password Rotation

Database password rotation requires special handling:

1. Create new database user with new password
2. Grant same permissions as existing user
3. Update application to use new credentials
4. After grace period, revoke old user access

```sql
-- Create new user
CREATE USER 'app_user_v2' WITH PASSWORD 'new_secure_password';

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE spheroseg TO 'app_user_v2';

-- After grace period, revoke old user
REVOKE ALL PRIVILEGES ON DATABASE spheroseg FROM 'app_user_v1';
DROP USER 'app_user_v1';
```

### Grace Period Behavior

During the grace period:
- Both old and new secrets are valid
- New tokens/sessions use the new secret
- Existing tokens/sessions are validated with both secrets
- Gradual migration occurs naturally as tokens expire

## Monitoring and Alerts

### Rotation Events

Monitor rotation events through multiple channels:

1. **Application Logs**: All rotation events are logged
2. **Audit Database**: Query the `secret_rotation_audit` table
3. **Notifications**: Configure email, Slack, or webhook alerts

### Health Checks

```sql
-- Check for overdue rotations
SELECT secret_name, last_rotation, next_rotation
FROM secret_rotation_schedules
WHERE next_rotation < NOW() AND is_active = true;

-- View recent rotation history
SELECT * FROM secret_rotation_audit
WHERE rotated_at > NOW() - INTERVAL '7 days'
ORDER BY rotated_at DESC;

-- Check rotation success rate
SELECT 
  secret_name,
  COUNT(*) as total_rotations,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
  ROUND(100.0 * SUM(CASE WHEN success THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM secret_rotation_audit
WHERE rotated_at > NOW() - INTERVAL '30 days'
GROUP BY secret_name;
```

### Alerts Configuration

Configure alerts for:
- Rotation failures
- Overdue rotations
- Grace period expiration warnings
- Emergency rotations

## Troubleshooting

### Common Issues

1. **Rotation Fails with "Already in Progress"**
   - Check Redis for stale locks: `rotation:lock:*`
   - Clear stale locks if necessary

2. **Application Can't Read New Secret**
   - Verify environment variable is set correctly
   - Check application supports reading `*_NEW` variables
   - Ensure Redis connection is working

3. **Database Connection Fails After Rotation**
   - Verify new user has correct permissions
   - Check connection pool is using new credentials
   - Ensure grace period hasn't expired prematurely

### Debug Mode

Enable detailed logging:

```bash
LOG_LEVEL=debug npm run rotate-secrets -- --list
```

### Recovery Procedures

If rotation fails and causes service disruption:

1. **Immediate Recovery**:
   ```bash
   # Revert to previous secret (if within grace period)
   export JWT_SECRET=$JWT_SECRET_OLD
   # Restart application
   docker-compose restart backend
   ```

2. **Manual Secret Update**:
   ```bash
   # Generate new secret manually
   openssl rand -base64 64
   # Update environment variable
   # Restart services
   ```

3. **Audit Investigation**:
   ```sql
   -- Find failed rotation details
   SELECT * FROM secret_rotation_audit
   WHERE secret_name = 'JWT_SECRET'
   AND success = false
   ORDER BY rotated_at DESC
   LIMIT 10;
   ```

## Security Best Practices

1. **Regular Audits**: Review rotation logs monthly
2. **Test Rotations**: Perform test rotations in staging
3. **Backup Secrets**: Maintain secure backups before rotation
4. **Monitor Failures**: Set up alerts for rotation failures
5. **Document Procedures**: Keep runbooks updated
6. **Access Control**: Limit who can trigger manual rotations
7. **Compliance**: Ensure rotation meets regulatory requirements

## Compliance and Auditing

The rotation system maintains comprehensive audit logs for compliance:

```sql
-- Compliance report: Show all rotations in date range
SELECT 
  secret_name,
  rotated_at,
  rotated_by,
  rotation_type,
  success
FROM secret_rotation_audit
WHERE rotated_at BETWEEN '2024-01-01' AND '2024-12-31'
ORDER BY rotated_at;

-- Verify rotation frequency compliance
SELECT 
  s.secret_name,
  s.rotation_interval_days as required_interval,
  EXTRACT(DAY FROM (MAX(a.rotated_at) - MIN(a.rotated_at))) / COUNT(*) as actual_avg_interval,
  COUNT(*) as rotation_count
FROM secret_rotation_schedules s
JOIN secret_rotation_audit a ON s.secret_name = a.secret_name
WHERE a.success = true
GROUP BY s.secret_name, s.rotation_interval_days;
```

## Migration from Manual Rotation

If migrating from manual secret management:

1. **Inventory Current Secrets**:
   - List all secrets currently in use
   - Document current rotation practices
   - Identify dependencies

2. **Configure Rotation Policies**:
   - Set appropriate intervals based on risk
   - Configure grace periods for smooth migration
   - Set up notification channels

3. **Initial Rotation**:
   ```bash
   # Perform initial rotation for all secrets
   npm run rotate-secrets -- --force
   ```

4. **Monitor Migration**:
   - Watch application logs for issues
   - Monitor performance during grace period
   - Verify all services handle new secrets

5. **Cleanup**:
   - Remove old manual rotation procedures
   - Update documentation
   - Train team on new system