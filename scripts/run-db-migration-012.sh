#!/bin/bash

# Script to run migration 012_add_missing_performance_indexes.sql
# This adds performance indexes for specific query patterns

set -e

echo "Running database migration 012: Add missing performance indexes..."

# Check if we're in the correct directory
if [ ! -f "docker-compose.yml" ]; then
    echo "Error: This script must be run from the spheroseg/spheroseg directory"
    exit 1
fi

# Run the migration
docker-compose exec -T db psql -U postgres -d spheroseg << EOF
\echo 'Starting migration 012_add_missing_performance_indexes...'
\i /docker-entrypoint-initdb.d/migrations/012_add_missing_performance_indexes.sql
\echo 'Migration completed successfully!'
EOF

echo "Migration 012 completed successfully!"
echo ""
echo "To rollback this migration, run:"
echo "docker-compose exec -T db psql -U postgres -d spheroseg -f /docker-entrypoint-initdb.d/migrations/012_add_missing_performance_indexes_rollback.sql"