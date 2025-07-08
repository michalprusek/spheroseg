# Database Migrations

This directory contains SQL migration scripts for the Spheroseg database.

## Migration Naming Convention

- Forward migrations: `XXX_description.sql`
- Rollback migrations: `XXX_description_rollback.sql`

Where `XXX` is a three-digit sequential number.

## Running Migrations

### Forward Migration
```bash
npm run db:migrate
```

### Rollback Migration
To rollback a specific migration, run the corresponding rollback script:
```bash
docker-compose exec db psql -U postgres -d spheroseg -f /path/to/XXX_description_rollback.sql
```

## Migration Validation

### Pre-Migration Checklist
Before running a migration in production:

1. **Syntax Validation**
   ```bash
   # Test SQL syntax without executing
   docker-compose exec db psql -U postgres -d spheroseg --dry-run -f migration.sql
   ```

2. **Test on Development Database**
   ```bash
   # Create a test database
   docker-compose exec db createdb -U postgres spheroseg_test
   
   # Apply all migrations up to the new one
   docker-compose exec db psql -U postgres -d spheroseg_test -f migration.sql
   
   # Test the rollback
   docker-compose exec db psql -U postgres -d spheroseg_test -f migration_rollback.sql
   ```

3. **Performance Impact Check**
   - For large tables, estimate the time required
   - Check if the migration requires table locks
   - Consider running during low-traffic periods

### Validation Script
Create a `validate_migration.sh` script:

```bash
#!/bin/bash
# Usage: ./validate_migration.sh XXX_description.sql

MIGRATION_FILE=$1
ROLLBACK_FILE="${MIGRATION_FILE%.sql}_rollback.sql"

# Check if files exist
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "Error: Migration file not found: $MIGRATION_FILE"
    exit 1
fi

if [ ! -f "$ROLLBACK_FILE" ]; then
    echo "Warning: Rollback file not found: $ROLLBACK_FILE"
fi

# Validate SQL syntax
echo "Validating SQL syntax..."
docker-compose exec -T db psql -U postgres -d postgres -c "CREATE DATABASE migration_test;"
docker-compose exec -T db psql -U postgres -d migration_test < "$MIGRATION_FILE"
if [ $? -eq 0 ]; then
    echo "✓ Migration syntax is valid"
else
    echo "✗ Migration has syntax errors"
    docker-compose exec -T db psql -U postgres -d postgres -c "DROP DATABASE migration_test;"
    exit 1
fi

# Test rollback if exists
if [ -f "$ROLLBACK_FILE" ]; then
    echo "Testing rollback..."
    docker-compose exec -T db psql -U postgres -d migration_test < "$ROLLBACK_FILE"
    if [ $? -eq 0 ]; then
        echo "✓ Rollback syntax is valid"
    else
        echo "✗ Rollback has syntax errors"
    fi
fi

# Cleanup
docker-compose exec -T db psql -U postgres -d postgres -c "DROP DATABASE migration_test;"
echo "Validation complete"
```

## Migration Best Practices

1. **Always create a rollback script** for every migration
2. **Test migrations** on a development database first
3. **Use IF EXISTS/IF NOT EXISTS** clauses to make migrations idempotent
4. **Add comments** explaining the purpose of each change
5. **Keep migrations small** and focused on a single change
6. **Never modify existing migrations** that have been run in production
7. **Validate migrations** before running in production
8. **Create indexes CONCURRENTLY** for large tables to avoid locks
9. **Document estimated execution time** for long-running migrations

## Current Migrations

- `001-007`: Initial schema and status system updates
- `008_update_image_statuses_safe.sql`: Safe migration to new status system
- `009_add_performance_indexes.sql`: Performance optimization indexes

## Rollback Procedure

If a migration needs to be rolled back:

1. Run the rollback script
2. Fix the issue in the forward migration
3. Validate the corrected migration
4. Re-run the corrected forward migration
5. Update the migration log

## Migration Template

```sql
-- Migration: XXX_description.sql
-- Purpose: Brief description of what this migration does
-- Estimated execution time: < 1 second
-- Requires downtime: No

BEGIN;

-- Your migration SQL here
-- Use IF EXISTS/IF NOT EXISTS for idempotency

COMMIT;
```