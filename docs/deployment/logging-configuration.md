# Logging Configuration Documentation

This document describes the logging and log rotation configuration for SpherosegV4 production deployment.

## Overview

The application uses Winston for logging with daily log rotation to manage disk space and maintain log history. Log rotation is implemented using `winston-daily-rotate-file` which automatically archives and compresses old logs.

## Log Types and Rotation Policies

### 1. Error Logs
- **File Pattern**: `error-YYYY-MM-DD.log`
- **Level**: `error`
- **Max Size**: 20MB per file
- **Retention**: 14 days
- **Compression**: Enabled (gzip)
- **Content**: Application errors, stack traces, critical issues

### 2. Combined Logs
- **File Pattern**: `combined-YYYY-MM-DD.log`
- **Level**: All levels
- **Max Size**: 50MB per file
- **Retention**: 7 days
- **Compression**: Enabled (gzip)
- **Content**: All application logs including info, warn, error, debug

### 3. Access Logs
- **File Pattern**: `access-YYYY-MM-DD.log`
- **Level**: `http`
- **Max Size**: 100MB per file
- **Retention**: 3 days
- **Compression**: Enabled (gzip)
- **Content**: HTTP request/response logs, API access patterns

## Configuration

### Environment Variables

```bash
# Enable file logging (default: false)
LOG_TO_FILE=true

# Log directory path (default: ./logs)
LOG_DIR=/var/log/spheroseg

# Log level (default: info in production, debug in development)
LOG_LEVEL=info
```

### Docker Volume Configuration

For production deployments, mount a persistent volume for logs:

```yaml
services:
  backend:
    volumes:
      - ./logs:/app/logs
      # Or use a named volume
      - spheroseg-logs:/app/logs

volumes:
  spheroseg-logs:
    driver: local
```

## Log Rotation Behavior

### Automatic Rotation

Logs are automatically rotated when:
1. **Daily**: At midnight (00:00) each day
2. **Size Limit**: When a log file reaches its maximum size
3. **Both**: Whichever condition is met first

### Archive Management

- Old log files are automatically compressed with gzip
- Archives are named with the rotation date: `error-2024-01-15.log.gz`
- Files older than the retention period are automatically deleted
- Deletion happens during the rotation process

### Example Log Lifecycle

```
Day 1: error-2024-01-15.log (active)
Day 2: error-2024-01-15.log.gz (archived), error-2024-01-16.log (active)
...
Day 15: error-2024-01-15.log.gz (deleted), error-2024-01-29.log (active)
```

## Implementation Details

### Winston Configuration

The log rotation is configured in `/packages/backend/src/monitoring/unified/index.ts`:

```typescript
new winston.transports.DailyRotateFile({
  filename: `${config.logging.logDir}/error-%DATE%.log`,
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxSize: '20m',
  maxFiles: '14d',
  zippedArchive: true,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
})
```

### Log Format

All rotated logs use JSON format for easy parsing:

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "error",
  "message": "Database connection failed",
  "service": "spheroseg-backend",
  "module": "database",
  "error": {
    "message": "Connection timeout",
    "stack": "Error: Connection timeout\n    at ...",
    "code": "ETIMEDOUT"
  }
}
```

## Monitoring and Maintenance

### Disk Space Monitoring

Monitor log directory disk usage:

```bash
# Check log directory size
du -sh /var/log/spheroseg

# List log files by size
ls -lh /var/log/spheroseg/*.log*

# Check disk space
df -h /var/log/spheroseg
```

### Log Analysis

Analyze logs using standard tools:

```bash
# View today's errors
cat /var/log/spheroseg/error-$(date +%Y-%m-%d).log | jq '.'

# Search for specific errors
zgrep "DatabaseError" /var/log/spheroseg/error-*.log.gz

# Count errors by type
zcat /var/log/spheroseg/error-*.log.gz | jq -r '.error.code' | sort | uniq -c
```

### Manual Rotation

If needed, trigger manual rotation:

```bash
# Send SIGUSR2 to the Node.js process
docker-compose exec backend kill -USR2 1

# Or restart the service
docker-compose restart backend
```

## Troubleshooting

### Common Issues

1. **Logs not rotating**
   - Check disk space: `df -h`
   - Verify permissions: `ls -la /var/log/spheroseg`
   - Check process is running: `ps aux | grep node`

2. **Missing log files**
   - Ensure `LOG_TO_FILE=true` is set
   - Verify log directory exists and is writable
   - Check Docker volume mounts

3. **Disk space issues**
   - Reduce retention periods
   - Decrease max file sizes
   - Enable more aggressive compression
   - Set up external log shipping

### Emergency Cleanup

If disk space becomes critical:

```bash
# Remove old compressed logs
find /var/log/spheroseg -name "*.log.gz" -mtime +7 -delete

# Truncate active log files (preserves file handles)
truncate -s 0 /var/log/spheroseg/*.log
```

## Best Practices

1. **Production Settings**
   - Always enable log rotation in production
   - Use persistent volumes for log storage
   - Monitor disk usage regularly
   - Set appropriate retention based on compliance needs

2. **Performance Considerations**
   - Log rotation happens asynchronously
   - Compression uses CPU but saves disk space
   - Consider log shipping for long-term storage
   - Use appropriate log levels to reduce volume

3. **Security**
   - Ensure logs don't contain sensitive data
   - Set proper file permissions (640)
   - Rotate logs containing PII more frequently
   - Encrypt archived logs if required

## Integration with Monitoring Stack

The logs can be integrated with monitoring tools:

1. **Prometheus/Grafana**
   - Log file size metrics
   - Rotation frequency metrics
   - Error rate tracking

2. **ELK Stack**
   - Ship logs to Elasticsearch
   - Visualize in Kibana
   - Set up alerts in ElastAlert

3. **Cloud Logging**
   - AWS CloudWatch Logs
   - Google Cloud Logging
   - Azure Monitor Logs

## References

- [Winston Documentation](https://github.com/winstonjs/winston)
- [winston-daily-rotate-file](https://github.com/winstonjs/winston-daily-rotate-file)
- [Node.js Logging Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)