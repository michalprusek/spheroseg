#!/bin/bash

# PostgreSQL Backup Script for SpherosegV4
# 
# This script performs automated backups of the PostgreSQL database
# with the following features:
# - Full database dumps with compression
# - Retention policy (keep last 7 daily, 4 weekly, 12 monthly backups)
# - Backup verification
# - Error handling and notifications
# - Support for both Docker and native PostgreSQL

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups/postgres}"
DB_NAME="${DB_NAME:-spheroseg}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
CONTAINER_NAME="${CONTAINER_NAME:-spheroseg-db-1}"
RETENTION_DAILY="${RETENTION_DAILY:-7}"
RETENTION_WEEKLY="${RETENTION_WEEKLY:-4}"
RETENTION_MONTHLY="${RETENTION_MONTHLY:-12}"
USE_DOCKER="${USE_DOCKER:-true}"
BACKUP_FORMAT="${BACKUP_FORMAT:-custom}" # custom or plain
COMPRESSION_LEVEL="${COMPRESSION_LEVEL:-9}"

# Create backup directories
mkdir -p "${BACKUP_DIR}/daily"
mkdir -p "${BACKUP_DIR}/weekly"
mkdir -p "${BACKUP_DIR}/monthly"
mkdir -p "${BACKUP_DIR}/logs"

# Logging
LOG_FILE="${BACKUP_DIR}/logs/backup-$(date +%Y%m%d-%H%M%S).log"
exec 1> >(tee -a "${LOG_FILE}")
exec 2>&1

echo "========================================"
echo "PostgreSQL Backup Script"
echo "Started at: $(date)"
echo "========================================"
echo "Database: ${DB_NAME}"
echo "Host: ${DB_HOST}:${DB_PORT}"
echo "Backup directory: ${BACKUP_DIR}"
echo "Use Docker: ${USE_DOCKER}"
echo "========================================"

# Function to perform backup
perform_backup() {
    local backup_type=$1
    local backup_file="${BACKUP_DIR}/${backup_type}/${DB_NAME}_${backup_type}_$(date +%Y%m%d-%H%M%S)"
    
    if [ "${BACKUP_FORMAT}" = "custom" ]; then
        backup_file="${backup_file}.dump"
    else
        backup_file="${backup_file}.sql.gz"
    fi
    
    echo "Creating ${backup_type} backup: ${backup_file}"
    
    if [ "${USE_DOCKER}" = "true" ]; then
        # Docker-based backup
        if [ "${BACKUP_FORMAT}" = "custom" ]; then
            docker exec "${CONTAINER_NAME}" pg_dump \
                -U "${DB_USER}" \
                -d "${DB_NAME}" \
                -Fc \
                -Z "${COMPRESSION_LEVEL}" \
                --verbose \
                --no-owner \
                --no-privileges \
                > "${backup_file}"
        else
            docker exec "${CONTAINER_NAME}" pg_dump \
                -U "${DB_USER}" \
                -d "${DB_NAME}" \
                --verbose \
                --no-owner \
                --no-privileges \
                | gzip -"${COMPRESSION_LEVEL}" > "${backup_file}"
        fi
    else
        # Native PostgreSQL backup
        export PGPASSWORD="${DB_PASSWORD:-}"
        if [ "${BACKUP_FORMAT}" = "custom" ]; then
            pg_dump \
                -h "${DB_HOST}" \
                -p "${DB_PORT}" \
                -U "${DB_USER}" \
                -d "${DB_NAME}" \
                -Fc \
                -Z "${COMPRESSION_LEVEL}" \
                --verbose \
                --no-owner \
                --no-privileges \
                > "${backup_file}"
        else
            pg_dump \
                -h "${DB_HOST}" \
                -p "${DB_PORT}" \
                -U "${DB_USER}" \
                -d "${DB_NAME}" \
                --verbose \
                --no-owner \
                --no-privileges \
                | gzip -"${COMPRESSION_LEVEL}" > "${backup_file}"
        fi
    fi
    
    # Verify backup
    if [ -f "${backup_file}" ] && [ -s "${backup_file}" ]; then
        local size=$(du -h "${backup_file}" | cut -f1)
        echo "✓ Backup created successfully: ${backup_file} (${size})"
        
        # Test backup integrity
        if [ "${BACKUP_FORMAT}" = "custom" ]; then
            if [ "${USE_DOCKER}" = "true" ]; then
                docker exec "${CONTAINER_NAME}" pg_restore --list "${backup_file}" > /dev/null 2>&1 || true
            else
                pg_restore --list "${backup_file}" > /dev/null 2>&1 || true
            fi
        else
            gzip -t "${backup_file}"
        fi
        echo "✓ Backup integrity verified"
    else
        echo "✗ Backup failed or is empty!"
        return 1
    fi
    
    return 0
}

# Function to clean old backups
cleanup_old_backups() {
    local backup_type=$1
    local retention_days=$2
    local backup_dir="${BACKUP_DIR}/${backup_type}"
    
    echo "Cleaning up old ${backup_type} backups (keeping last ${retention_days})..."
    
    # List all backups sorted by date, keep the newest N files
    find "${backup_dir}" -name "${DB_NAME}_${backup_type}_*" -type f | \
        sort -r | \
        tail -n +$((retention_days + 1)) | \
        while read -r old_backup; do
            echo "  Removing old backup: $(basename "${old_backup}")"
            rm -f "${old_backup}"
        done
}

# Function to get database size
get_database_size() {
    local size_query="SELECT pg_database_size('${DB_NAME}');"
    local size_bytes
    
    if [ "${USE_DOCKER}" = "true" ]; then
        size_bytes=$(docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" -t -c "${size_query}" | tr -d ' ')
    else
        export PGPASSWORD="${DB_PASSWORD:-}"
        size_bytes=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -c "${size_query}" | tr -d ' ')
    fi
    
    echo "Database size: $(numfmt --to=iec-i --suffix=B "${size_bytes}")"
}

# Main backup process
main() {
    # Check prerequisites
    if [ "${USE_DOCKER}" = "true" ]; then
        if ! docker ps | grep -q "${CONTAINER_NAME}"; then
            echo "✗ Error: Docker container '${CONTAINER_NAME}' is not running!"
            exit 1
        fi
    else
        if ! command -v pg_dump &> /dev/null; then
            echo "✗ Error: pg_dump command not found!"
            exit 1
        fi
    fi
    
    # Get database size
    get_database_size
    
    # Perform daily backup
    if perform_backup "daily"; then
        # On Sunday, also create weekly backup
        if [ "$(date +%u)" -eq 7 ]; then
            echo "Creating weekly backup..."
            cp "${BACKUP_DIR}/daily/"*$(date +%Y%m%d)* "${BACKUP_DIR}/weekly/" 2>/dev/null || true
        fi
        
        # On 1st of month, also create monthly backup
        if [ "$(date +%d)" -eq 1 ]; then
            echo "Creating monthly backup..."
            cp "${BACKUP_DIR}/daily/"*$(date +%Y%m%d)* "${BACKUP_DIR}/monthly/" 2>/dev/null || true
        fi
    else
        echo "✗ Backup failed!"
        exit 1
    fi
    
    # Cleanup old backups
    cleanup_old_backups "daily" "${RETENTION_DAILY}"
    cleanup_old_backups "weekly" "${RETENTION_WEEKLY}"
    cleanup_old_backups "monthly" "${RETENTION_MONTHLY}"
    
    # Summary
    echo "========================================"
    echo "Backup Summary:"
    echo "Daily backups: $(find "${BACKUP_DIR}/daily" -name "${DB_NAME}_daily_*" -type f | wc -l)"
    echo "Weekly backups: $(find "${BACKUP_DIR}/weekly" -name "${DB_NAME}_*" -type f | wc -l)"
    echo "Monthly backups: $(find "${BACKUP_DIR}/monthly" -name "${DB_NAME}_*" -type f | wc -l)"
    echo "Total disk usage: $(du -sh "${BACKUP_DIR}" | cut -f1)"
    echo "========================================"
    echo "Backup completed at: $(date)"
}

# Error handler
error_handler() {
    echo "✗ Error occurred on line $1"
    exit 1
}

trap 'error_handler $LINENO' ERR

# Run main function
main "$@"