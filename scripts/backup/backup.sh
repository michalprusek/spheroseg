#!/bin/bash
set -euo pipefail

# Load environment variables from files
POSTGRES_USER=$(cat $POSTGRES_USER_FILE)
POSTGRES_PASSWORD=$(cat $POSTGRES_PASSWORD_FILE)
AWS_ACCESS_KEY_ID=$(cat $AWS_ACCESS_KEY_ID_FILE)
AWS_SECRET_ACCESS_KEY=$(cat $AWS_SECRET_ACCESS_KEY_FILE)

# Export AWS credentials
export AWS_ACCESS_KEY_ID
export AWS_SECRET_ACCESS_KEY

# Set default values
POSTGRES_HOST=${POSTGRES_HOST:-db}
POSTGRES_DB=${POSTGRES_DB:-spheroseg}
BACKUP_DIR=${BACKUP_DIR:-/backup}
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
S3_BUCKET=${S3_BUCKET}

# Create timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/spheroseg_backup_${TIMESTAMP}.sql.gz"

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "Starting backup process..."

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Perform database backup
log "Backing up database..."
PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
    -h "$POSTGRES_HOST" \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    | gzip > "$BACKUP_FILE"

# Check if backup was successful
if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
    log "Backup created successfully: $BACKUP_FILE"
    
    # Upload to S3 if bucket is configured
    if [ -n "$S3_BUCKET" ]; then
        log "Uploading backup to S3..."
        aws s3 cp "$BACKUP_FILE" "s3://${S3_BUCKET}/database-backups/$(basename "$BACKUP_FILE")" \
            --storage-class STANDARD_IA
        
        if [ $? -eq 0 ]; then
            log "Backup uploaded to S3 successfully"
            # Remove local backup after successful upload
            rm -f "$BACKUP_FILE"
        else
            log "ERROR: Failed to upload backup to S3"
            exit 1
        fi
    else
        log "S3 bucket not configured, keeping backup locally"
    fi
    
    # Update last backup timestamp
    date > "${BACKUP_DIR}/last_backup_timestamp"
    
    # Clean up old local backups
    log "Cleaning up old backups..."
    find "$BACKUP_DIR" -name "spheroseg_backup_*.sql.gz" -type f -mtime +$BACKUP_RETENTION_DAYS -delete
    
    # Clean up old S3 backups if configured
    if [ -n "$S3_BUCKET" ]; then
        log "Cleaning up old S3 backups..."
        aws s3 ls "s3://${S3_BUCKET}/database-backups/" | \
            awk '{print $4}' | \
            grep "spheroseg_backup_" | \
            while read -r backup; do
                backup_date=$(echo "$backup" | sed 's/spheroseg_backup_\([0-9]\{8\}\).*/\1/')
                if [ -n "$backup_date" ]; then
                    days_old=$(( ($(date +%s) - $(date -d "$backup_date" +%s)) / 86400 ))
                    if [ $days_old -gt $BACKUP_RETENTION_DAYS ]; then
                        aws s3 rm "s3://${S3_BUCKET}/database-backups/$backup"
                        log "Deleted old backup: $backup"
                    fi
                fi
            done
    fi
    
    log "Backup process completed successfully"
else
    log "ERROR: Backup failed"
    exit 1
fi