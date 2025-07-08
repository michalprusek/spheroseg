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

## Migration Best Practices

1. **Always create a rollback script** for every migration
2. **Test migrations** on a development database first
3. **Use IF EXISTS/IF NOT EXISTS** clauses to make migrations idempotent
4. **Add comments** explaining the purpose of each change
5. **Keep migrations small** and focused on a single change
6. **Never modify existing migrations** that have been run in production

## Current Migrations

- `001-007`: Initial schema and status system updates
- `008_update_image_statuses_safe.sql`: Safe migration to new status system
- `009_add_performance_indexes.sql`: Performance optimization indexes

## Rollback Procedure

If a migration needs to be rolled back:

1. Run the rollback script
2. Fix the issue in the forward migration
3. Re-run the corrected forward migration
4. Update the migration log