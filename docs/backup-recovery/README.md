# Backup and Recovery Testing System

Comprehensive automated testing system for PostgreSQL backup and recovery procedures in SpherosegV4.

## Overview

The backup recovery testing system provides:

- **Automated Backup Testing**: Validates backup creation, integrity, and format
- **Recovery Validation**: Tests restoration procedures and data integrity
- **Performance Benchmarking**: Measures backup/restore performance
- **Disaster Recovery Simulation**: Tests various failure scenarios
- **Comprehensive Reporting**: Detailed test results and metrics

## Quick Start

### Run Complete Test Suite

```bash
# Run all backup recovery tests
npm run test:backup-recovery

# Or run directly
./scripts/test-backup-recovery.sh
```

### Individual Operations

```bash
# Create database backup
npm run backup:database

# Restore from backup
npm run restore:database /path/to/backup.sql

# Test specific scenario
./scripts/test-backup-recovery.sh --test basic_backup
```

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Test Script   │────│   Test Database │────│   Validation    │
│                 │    │   Management    │    │   Framework     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Backup        │    │   Test Data     │    │   Performance   │
│   Infrastructure│    │   Generation    │    │   Metrics       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Components

1. **Test Script**: `scripts/test-backup-recovery.sh` - Main test orchestration
2. **Backup Script**: `scripts/backup/backup-database.sh` - Production backup system
3. **Restore Script**: `scripts/rollback/restore-database.sh` - Production restore system
4. **Test Data Generator**: Creates realistic test data for validation
5. **Validation Framework**: Verifies data integrity across backup/restore cycles

## Test Scenarios

### 1. Basic Backup Testing

**Purpose**: Validate fundamental backup creation and verification

**Tests**:
- Backup file creation
- Backup integrity verification
- File size validation
- Compression effectiveness

**Expected Results**:
- ✅ Backup file created successfully
- ✅ Backup integrity verified
- ✅ File size within expected range
- ✅ Compression ratio > 50%

### 2. Backup Restoration Testing

**Purpose**: Validate backup restoration procedures

**Tests**:
- Database restoration from backup
- Table count verification
- Row count validation
- Data integrity checks

**Expected Results**:
- ✅ Database restored successfully
- ✅ All tables present
- ✅ Row counts match original
- ✅ Data integrity preserved

### 3. Data Integrity Testing

**Purpose**: Ensure data consistency across backup/restore cycles

**Tests**:
- Schema validation
- Foreign key constraints
- Data checksums
- Index verification

**Expected Results**:
- ✅ Schema matches original
- ✅ All constraints intact
- ✅ Data checksums match
- ✅ Indexes functioning

### 4. Performance Testing

**Purpose**: Measure backup and restore performance

**Tests**:
- Backup creation time
- Restore completion time
- Compression performance
- I/O throughput

**Expected Results**:
- ✅ Backup time < 5 minutes (for test data)
- ✅ Restore time < 3 minutes
- ✅ Compression ratio > 50%
- ✅ I/O within limits

### 5. Format Testing

**Purpose**: Validate different backup formats

**Tests**:
- Plain SQL format
- Custom PostgreSQL format
- Compressed backups
- Format compatibility

**Expected Results**:
- ✅ Both formats work correctly
- ✅ Custom format more efficient
- ✅ Compression effective
- ✅ Cross-format compatibility

### 6. Retention Policy Testing

**Purpose**: Validate backup retention and cleanup

**Tests**:
- Old backup cleanup
- Retention policy adherence
- Storage space management
- Backup rotation

**Expected Results**:
- ✅ Old backups removed
- ✅ Retention limits respected
- ✅ Storage optimized
- ✅ Rotation working

### 7. Rollback Scenario Testing

**Purpose**: Test recovery from failed operations

**Tests**:
- Failed restore recovery
- Data corruption scenarios
- Partial restore handling
- Emergency procedures

**Expected Results**:
- ✅ Failed restores recovered
- ✅ Corruption detected
- ✅ Partial restores handled
- ✅ Emergency procedures work

### 8. Disaster Recovery Testing

**Purpose**: Simulate major failure scenarios

**Tests**:
- Complete database loss
- Backup corruption
- Storage failures
- Network interruptions

**Expected Results**:
- ✅ Database recovered from backup
- ✅ Corruption detected and handled
- ✅ Storage failures managed
- ✅ Network issues handled

### 9. Point-in-Time Recovery Testing

**Purpose**: Test precision recovery capabilities

**Tests**:
- Transaction log replay
- Specific timestamp recovery
- Partial data recovery
- Recovery validation

**Expected Results**:
- ✅ Logs replayed correctly
- ✅ Timestamp recovery accurate
- ✅ Partial recovery successful
- ✅ Recovery validated

## Configuration

### Environment Variables

```bash
# Test configuration
BACKUP_TEST_TIMEOUT=1800          # Test timeout in seconds
BACKUP_TEST_DIR=/tmp/backup_test  # Test working directory
BACKUP_TEST_VERBOSE=true          # Enable verbose output

# Database configuration
DB_NAME=spheroseg                 # Production database name
TEST_DB_PREFIX=test_backup        # Test database prefix
DB_USER=postgres                  # Database user
DB_HOST=localhost                 # Database host
DB_PORT=5432                      # Database port

# Performance thresholds
MAX_BACKUP_TIME=300               # Maximum backup time (seconds)
MAX_RESTORE_TIME=180              # Maximum restore time (seconds)
MIN_COMPRESSION_RATIO=50          # Minimum compression percentage
```

### Test Data Configuration

```bash
# Test data generation
TEST_USERS_COUNT=100              # Number of test users
TEST_PROJECTS_COUNT=50            # Number of test projects
TEST_IMAGES_COUNT=200             # Number of test images
TEST_CELLS_COUNT=1000             # Number of test cells

# Data validation settings
CHECKSUM_ALGORITHM=md5            # Checksum algorithm
INTEGRITY_CHECK_DEPTH=full        # Integrity check level
```

## Usage Examples

### Complete Test Suite

```bash
# Run all tests with default configuration
npm run test:backup-recovery

# Run with custom configuration
BACKUP_TEST_VERBOSE=true MAX_BACKUP_TIME=600 npm run test:backup-recovery
```

### Specific Test Scenarios

```bash
# Test only basic backup functionality
./scripts/test-backup-recovery.sh --test basic_backup

# Test only restoration procedures
./scripts/test-backup-recovery.sh --test restoration

# Test performance only
./scripts/test-backup-recovery.sh --test performance

# Test disaster recovery
./scripts/test-backup-recovery.sh --test disaster_recovery
```

### Production Backup Operations

```bash
# Create production backup
npm run backup:database

# Create backup with custom settings
BACKUP_FORMAT=custom COMPRESSION_LEVEL=9 npm run backup:database

# Restore from specific backup
npm run restore:database /backups/spheroseg_20250119_120000.sql
```

## Test Results and Reporting

### Test Output

```
========================================
Backup Recovery Testing Suite
Started at: 2025-01-19 12:00:00
========================================

[12:00:01] ✅ TEST: Basic Backup Creation - PASS (2.3s)
[12:00:04] ✅ TEST: Backup Integrity Verification - PASS (1.1s)
[12:00:05] ✅ TEST: Database Restoration - PASS (8.7s)
[12:00:14] ✅ TEST: Data Integrity Validation - PASS (3.2s)
[12:00:17] ✅ TEST: Performance Benchmarking - PASS (5.1s)
[12:00:23] ✅ TEST: Format Compatibility - PASS (4.8s)
[12:00:28] ✅ TEST: Retention Policy - PASS (2.1s)
[12:00:30] ✅ TEST: Rollback Scenarios - PASS (6.3s)
[12:00:37] ✅ TEST: Disaster Recovery - PASS (12.1s)

========================================
Test Summary:
✅ Tests Passed: 9/9
❌ Tests Failed: 0/9
⏱️  Total Duration: 45.7s
📊 Success Rate: 100%
========================================
```

### Performance Metrics

| Test | Duration | Status | Notes |
|------|----------|--------|-------|
| Basic Backup | 2.3s | ✅ PASS | 67% compression |
| Integrity Check | 1.1s | ✅ PASS | All checksums match |
| Restoration | 8.7s | ✅ PASS | 2.1GB restored |
| Data Integrity | 3.2s | ✅ PASS | Schema validated |
| Performance | 5.1s | ✅ PASS | Within thresholds |
| Format Test | 4.8s | ✅ PASS | Both formats work |
| Retention | 2.1s | ✅ PASS | Cleanup successful |
| Rollback | 6.3s | ✅ PASS | Recovery validated |
| Disaster Recovery | 12.1s | ✅ PASS | Full recovery |

### Log Files

Test results are saved to:
- **Test Log**: `/tmp/backup_test/logs/test_backup_recovery_YYYYMMDD_HHMMSS.log`
- **Performance Log**: `/tmp/backup_test/logs/performance_YYYYMMDD_HHMMSS.log`
- **Error Log**: `/tmp/backup_test/logs/errors_YYYYMMDD_HHMMSS.log`

## Troubleshooting

### Common Issues

#### Test Database Creation Fails

**Symptoms**: "Could not create test database"

**Solutions**:
1. Check PostgreSQL is running: `docker-compose ps db`
2. Verify database credentials
3. Ensure sufficient disk space
4. Check PostgreSQL logs: `docker-compose logs db`

#### Backup Creation Fails

**Symptoms**: "Backup creation failed"

**Solutions**:
1. Check disk space in backup directory
2. Verify database connectivity
3. Check PostgreSQL user permissions
4. Review backup script logs

#### Restoration Fails

**Symptoms**: "Database restore failed"

**Solutions**:
1. Verify backup file integrity
2. Check backup file format
3. Ensure target database is accessible
4. Review restore script logs

#### Performance Tests Fail

**Symptoms**: "Performance thresholds exceeded"

**Solutions**:
1. Adjust performance thresholds in configuration
2. Check system resources (CPU, memory, I/O)
3. Optimize PostgreSQL configuration
4. Consider hardware limitations

### Debug Mode

Enable debug mode for detailed troubleshooting:

```bash
# Enable debug output
BACKUP_TEST_VERBOSE=true ./scripts/test-backup-recovery.sh

# Enable PostgreSQL debug logging
BACKUP_TEST_DEBUG=true ./scripts/test-backup-recovery.sh

# Keep test artifacts for inspection
BACKUP_TEST_KEEP_ARTIFACTS=true ./scripts/test-backup-recovery.sh
```

### Manual Testing

For manual verification:

```bash
# Create test database manually
docker-compose exec db createdb -U postgres test_manual

# Run individual backup command
docker-compose exec db pg_dump -U postgres spheroseg > test_backup.sql

# Test restoration manually
docker-compose exec db psql -U postgres -d test_manual < test_backup.sql

# Verify data
docker-compose exec db psql -U postgres -d test_manual -c "\\dt"
```

## Integration with CI/CD

### GitHub Actions

```yaml
name: Backup Recovery Tests
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:

jobs:
  backup-recovery-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Run backup recovery tests
        run: npm run test:backup-recovery
      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: backup-test-results
          path: /tmp/backup_test/logs/
```

### Production Monitoring

```bash
# Add to crontab for regular testing
0 2 * * 0 /path/to/spheroseg/scripts/test-backup-recovery.sh >> /var/log/backup-test.log 2>&1
```

## Best Practices

### Test Environment

1. **Isolated Testing**: Always use separate test databases
2. **Resource Management**: Monitor disk space and memory usage
3. **Cleanup**: Ensure test artifacts are cleaned up after tests
4. **Documentation**: Keep test configurations documented

### Production Safety

1. **Pre-Production Testing**: Test all backup procedures in staging
2. **Validation**: Always validate backups before relying on them
3. **Monitoring**: Monitor backup operations and set up alerts
4. **Documentation**: Document all backup and recovery procedures

### Performance Optimization

1. **Scheduling**: Run tests during low-usage periods
2. **Parallel Testing**: Use parallel execution where possible
3. **Incremental Testing**: Focus on changed components
4. **Caching**: Cache test data and results where appropriate

## Contributing

### Adding New Tests

1. **Test Function**: Add new test function to the script
2. **Configuration**: Add any new configuration variables
3. **Documentation**: Update documentation with new test details
4. **Validation**: Ensure new tests work in CI/CD pipeline

### Improving Performance

1. **Profiling**: Profile test execution to identify bottlenecks
2. **Optimization**: Optimize slow operations
3. **Parallelization**: Add parallel execution where safe
4. **Caching**: Implement caching for expensive operations

## Support

For issues or questions:

1. Check the troubleshooting section
2. Review test logs in `/tmp/backup_test/logs/`
3. Test manually with debug mode enabled
4. Create an issue with configuration and logs

---

**Note**: Backup recovery testing creates and destroys test databases. Always run in a safe environment and never point tests at production databases.