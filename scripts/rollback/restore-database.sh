#!/bin/bash
# Database restoration script
# Restores database from a backup file

set -e

# Configuration
BACKUP_FILE="$1"
RESTORE_TIME=$(date +%Y%m%d_%H%M%S)
LOG_FILE="db_restore_${RESTORE_TIME}.log"
DB_NAME="${DB_NAME:-spheroseg}"
DB_USER="${DB_USER:-postgres}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging function
log() {
    echo -e "${2:-$GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

# Usage check
if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file>"
    echo "Example: $0 /backups/spheroseg_20240119_120000.sql"
    exit 1
fi

# Verify backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    error "Backup file not found: $BACKUP_FILE"
fi

log "Starting database restoration from: $BACKUP_FILE" "$YELLOW"
log "Restoration log: $LOG_FILE"

# Step 1: Create pre-restoration backup
log "Creating pre-restoration backup..."
mkdir -p backups/pre_restore_$RESTORE_TIME

docker-compose exec -T db pg_dump -U "$DB_USER" "$DB_NAME" > "backups/pre_restore_$RESTORE_TIME/database.sql" || {
    error "Failed to create pre-restoration backup"
}

log "Pre-restoration backup saved to: backups/pre_restore_$RESTORE_TIME/database.sql"

# Step 2: Stop application services (keep database running)
log "Stopping application services..."
docker-compose stop backend ml frontend-prod || true

# Step 3: Terminate active connections
log "Terminating active database connections..."
docker-compose exec -T db psql -U "$DB_USER" -d postgres << EOF
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = '$DB_NAME' 
  AND pid <> pg_backend_pid();
EOF

# Step 4: Drop and recreate database
log "Dropping and recreating database..."
docker-compose exec -T db psql -U "$DB_USER" -d postgres << EOF
DROP DATABASE IF EXISTS $DB_NAME;
CREATE DATABASE $DB_NAME OWNER $DB_USER;
EOF

# Step 5: Restore from backup
log "Restoring database from backup..."
if docker-compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" < "$BACKUP_FILE"; then
    log "Database restore completed successfully"
else
    error "Database restore failed. Attempting to restore pre-restoration backup..."
    
    # Attempt to restore the pre-restoration backup
    docker-compose exec -T db psql -U "$DB_USER" -d postgres << EOF
DROP DATABASE IF EXISTS $DB_NAME;
CREATE DATABASE $DB_NAME OWNER $DB_USER;
EOF
    
    docker-compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" < "backups/pre_restore_$RESTORE_TIME/database.sql"
    error "Original restore failed. Pre-restoration state has been restored."
fi

# Step 6: Verify restoration
log "Verifying database restoration..."
TABLES_COUNT=$(docker-compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
TABLES_COUNT=$(echo $TABLES_COUNT | tr -d ' ')

if [ "$TABLES_COUNT" -gt 0 ]; then
    log "✅ Found $TABLES_COUNT tables in restored database"
else
    error "No tables found in restored database!"
fi

# Step 7: Show database info
log "Database information:"
docker-compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" << EOF
-- Show tables
\echo 'Tables:'
\dt

-- Show row counts for main tables
\echo '\nRow counts:'
SELECT 'users' as table_name, COUNT(*) as row_count FROM users
UNION ALL
SELECT 'projects', COUNT(*) FROM projects
UNION ALL
SELECT 'images', COUNT(*) FROM images
UNION ALL
SELECT 'segmentation_results', COUNT(*) FROM segmentation_results;
EOF

# Step 8: Restart application services
log "Restarting application services..."
docker-compose up -d backend ml frontend-prod

# Step 9: Wait for services to be ready
log "Waiting for services to be ready..."
sleep 20

# Step 10: Verify services
log "Verifying services..."
if curl -f http://localhost:5001/api/health >/dev/null 2>&1; then
    log "✅ Backend service is healthy"
else
    log "⚠️  Backend health check failed" "$YELLOW"
fi

log "Database restoration completed successfully!" "$GREEN"
log "Restored from: $BACKUP_FILE"
log "Pre-restoration backup available at: backups/pre_restore_$RESTORE_TIME/database.sql"