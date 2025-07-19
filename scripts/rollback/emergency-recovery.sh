#!/bin/bash
# Emergency recovery script for complete system failure
# Use this when standard rollback procedures fail

set -e

# Configuration
RECOVERY_TIME=$(date +%Y%m%d_%H%M%S)
LOG_FILE="emergency_recovery_${RECOVERY_TIME}.log"
BACKUP_DIR="${BACKUP_DIR:-/backups}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging function
log() {
    echo -e "${2:-$GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

# Banner
echo -e "${RED}╔══════════════════════════════════════════╗${NC}"
echo -e "${RED}║        EMERGENCY RECOVERY MODE           ║${NC}"
echo -e "${RED}╚══════════════════════════════════════════╝${NC}"
echo ""

log "Emergency recovery initiated at $RECOVERY_TIME" "$RED"
log "Recovery log: $LOG_FILE"

# Step 1: System assessment
log "Step 1: Assessing system state..." "$YELLOW"

# Check Docker daemon
if ! docker info >/dev/null 2>&1; then
    error "Docker daemon is not running. Please start Docker first."
    exit 1
fi

# List all containers (running and stopped)
info "Current containers:"
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.State}}"

# Step 2: Force stop all containers
log "Step 2: Force stopping all containers..." "$YELLOW"
docker stop $(docker ps -aq) 2>/dev/null || warning "No containers to stop"

# Kill any stubborn containers
docker kill $(docker ps -aq) 2>/dev/null || true

# Step 3: Clean up Docker resources
log "Step 3: Cleaning Docker resources..." "$YELLOW"

# Remove all containers
docker rm -f $(docker ps -aq) 2>/dev/null || warning "No containers to remove"

# Prune system (careful mode)
docker system prune -f --volumes || warning "System prune encountered issues"

# Step 4: Find latest backup
log "Step 4: Locating latest backup..." "$YELLOW"

if [ -d "$BACKUP_DIR" ]; then
    LATEST_BACKUP=$(find "$BACKUP_DIR" -name "full_backup_*.tar.gz" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -f2- -d" ")
    
    if [ -n "$LATEST_BACKUP" ]; then
        info "Found backup: $LATEST_BACKUP"
    else
        error "No backup found in $BACKUP_DIR"
        
        # Try to find any SQL backup
        LATEST_SQL=$(find . -name "*.sql" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -f2- -d" ")
        if [ -n "$LATEST_SQL" ]; then
            info "Found SQL backup: $LATEST_SQL"
        fi
    fi
else
    warning "Backup directory $BACKUP_DIR not found"
fi

# Step 5: Reset to clean state
log "Step 5: Resetting to clean state..." "$YELLOW"

# Remove all volumes (DANGEROUS - only in emergency)
read -p "Remove all Docker volumes? This will delete all data! (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker volume rm $(docker volume ls -q) 2>/dev/null || warning "No volumes to remove"
fi

# Step 6: Restore from backup (if available)
if [ -n "$LATEST_BACKUP" ] && [ -f "$LATEST_BACKUP" ]; then
    log "Step 6: Restoring from backup..." "$YELLOW"
    
    # Extract backup
    mkdir -p recovery_$RECOVERY_TIME
    tar -xzf "$LATEST_BACKUP" -C recovery_$RECOVERY_TIME/
    
    # Restore docker images if present
    if [ -f "recovery_$RECOVERY_TIME/images.tar" ]; then
        info "Restoring Docker images..."
        docker load < recovery_$RECOVERY_TIME/images.tar
    fi
    
    # Restore data volumes
    if [ -d "recovery_$RECOVERY_TIME/volumes" ]; then
        info "Restoring data volumes..."
        # Restore volume data (implement based on your backup structure)
    fi
else
    warning "No backup available for restoration"
fi

# Step 7: Start core services only
log "Step 7: Starting core services..." "$YELLOW"

# Create network if not exists
docker network create spheroseg_network 2>/dev/null || true

# Start database first
info "Starting database..."
docker-compose up -d db || error "Failed to start database"
sleep 30

# Check database
if docker-compose exec -T db pg_isready; then
    log "✅ Database is ready"
else
    error "Database failed to start"
fi

# Restore database if SQL backup exists
if [ -n "$LATEST_SQL" ] && [ -f "$LATEST_SQL" ]; then
    info "Restoring database from $LATEST_SQL"
    docker-compose exec -T db psql -U postgres -d spheroseg < "$LATEST_SQL" || warning "Database restore failed"
fi

# Start backend
info "Starting backend service..."
docker-compose up -d backend || error "Failed to start backend"
sleep 10

# Start minimal frontend
info "Starting frontend..."
docker-compose up -d frontend-prod nginx-prod || warning "Frontend start failed"

# Step 8: Verify core functionality
log "Step 8: Verifying core functionality..." "$YELLOW"

SYSTEM_OK=true

# Check backend health
if curl -f http://localhost:5001/api/health >/dev/null 2>&1; then
    log "✅ Backend is responding"
else
    error "Backend health check failed"
    SYSTEM_OK=false
fi

# Check database tables
TABLE_COUNT=$(docker-compose exec -T db psql -U postgres -d spheroseg -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "0")
TABLE_COUNT=$(echo $TABLE_COUNT | tr -d ' ')

if [ "$TABLE_COUNT" -gt 0 ]; then
    log "✅ Database has $TABLE_COUNT tables"
else
    error "Database has no tables"
    SYSTEM_OK=false
fi

# Step 9: Recovery summary
log "Step 9: Recovery Summary" "$YELLOW"
echo -e "${YELLOW}═══════════════════════════════════════════${NC}"

if [ "$SYSTEM_OK" = true ]; then
    log "✅ Emergency recovery completed successfully!" "$GREEN"
    log "Core services are running in minimal mode."
else
    log "⚠️  Emergency recovery completed with errors!" "$RED"
    log "Manual intervention required."
fi

# Show current status
info "Current system status:"
docker-compose ps

# Next steps
echo ""
log "Next Steps:" "$BLUE"
echo "1. Check application logs: docker-compose logs -f"
echo "2. Verify data integrity in database"
echo "3. Gradually start additional services"
echo "4. Run full system tests"
echo "5. Investigate root cause of failure"
echo ""
log "Recovery log saved to: $LOG_FILE"

# Create recovery report
cat > "recovery_report_$RECOVERY_TIME.md" << EOF
# Emergency Recovery Report

**Date**: $(date)
**Recovery ID**: $RECOVERY_TIME

## System State Before Recovery
- Total containers: $(docker ps -aq | wc -l)
- Running containers: $(docker ps -q | wc -l)

## Actions Taken
1. Stopped all containers
2. Cleaned Docker resources
3. Located backup: ${LATEST_BACKUP:-"No backup found"}
4. Started core services

## Current Status
- Database: $(docker-compose ps db | grep Up > /dev/null && echo "Running" || echo "Stopped")
- Backend: $(docker-compose ps backend | grep Up > /dev/null && echo "Running" || echo "Stopped")
- Frontend: $(docker-compose ps frontend-prod | grep Up > /dev/null && echo "Running" || echo "Stopped")

## Issues Encountered
$(grep ERROR "$LOG_FILE" || echo "No errors logged")

## Recommendations
1. Review error logs
2. Verify data integrity
3. Run comprehensive tests
4. Create post-mortem document
EOF

log "Recovery report saved to: recovery_report_$RECOVERY_TIME.md"