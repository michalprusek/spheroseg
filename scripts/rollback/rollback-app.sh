#!/bin/bash
# Application rollback script
# Rolls back to previous version of the application

set -e

# Configuration
PREVIOUS_VERSION="${1:-v3.9.0}"
ROLLBACK_TIME=$(date +%Y%m%d_%H%M%S)
LOG_FILE="rollback_${ROLLBACK_TIME}.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${2:-$GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

# Check if running as appropriate user
if [ "$EUID" -eq 0 ]; then 
   error "Please do not run as root"
fi

log "Starting rollback to version: $PREVIOUS_VERSION" "$YELLOW"
log "Rollback log: $LOG_FILE"

# Step 1: Verify previous version exists
log "Verifying previous version exists..."
if ! git rev-parse --verify "$PREVIOUS_VERSION" >/dev/null 2>&1; then
    error "Version $PREVIOUS_VERSION not found in git"
fi

# Step 2: Create backup of current state
log "Creating backup of current state..."
mkdir -p backups/rollback_$ROLLBACK_TIME

# Backup current docker images
log "Backing up current Docker images..."
docker save spheroseg_backend:latest > backups/rollback_$ROLLBACK_TIME/backend.tar || true
docker save spheroseg_frontend:latest > backups/rollback_$ROLLBACK_TIME/frontend.tar || true
docker save spheroseg_ml:latest > backups/rollback_$ROLLBACK_TIME/ml.tar || true

# Backup current configuration
cp docker-compose.yml backups/rollback_$ROLLBACK_TIME/ || true
cp -r packages/backend/.env* backups/rollback_$ROLLBACK_TIME/ || true
cp -r packages/frontend/.env* backups/rollback_$ROLLBACK_TIME/ || true

# Step 3: Stop current services
log "Stopping current services..."
docker-compose stop

# Verify services are stopped
if docker-compose ps | grep -q "Up"; then
    error "Some services are still running. Please check manually."
fi

# Step 4: Tag current images for recovery
log "Tagging current images for potential recovery..."
docker tag spheroseg_backend:latest spheroseg_backend:rollback_$ROLLBACK_TIME || true
docker tag spheroseg_frontend:latest spheroseg_frontend:rollback_$ROLLBACK_TIME || true
docker tag spheroseg_ml:latest spheroseg_ml:rollback_$ROLLBACK_TIME || true

# Step 5: Checkout previous version
log "Checking out previous version: $PREVIOUS_VERSION"
git fetch --all --tags
git checkout "$PREVIOUS_VERSION"

# Step 6: Install dependencies
log "Installing dependencies..."
npm install
npm run build

# Step 7: Build Docker images
log "Building Docker images for previous version..."
docker-compose build --no-cache

# Step 8: Start services
log "Starting services..."
docker-compose up -d

# Step 9: Wait for services to be ready
log "Waiting for services to be ready..."
sleep 30

# Step 10: Verify services are running
log "Verifying services..."
SERVICES_OK=true

# Check backend
if ! curl -f http://localhost:5001/api/health >/dev/null 2>&1; then
    error "Backend health check failed!"
    SERVICES_OK=false
fi

# Check frontend
if ! curl -f http://localhost:3000 >/dev/null 2>&1; then
    log "Frontend health check failed!" "$RED"
    SERVICES_OK=false
fi

# Check database
if ! docker-compose exec -T db pg_isready >/dev/null 2>&1; then
    log "Database health check failed!" "$RED"
    SERVICES_OK=false
fi

# Step 11: Show status
log "Rollback status:"
docker-compose ps

if [ "$SERVICES_OK" = true ]; then
    log "✅ Rollback completed successfully!" "$GREEN"
    log "Application is now running version: $PREVIOUS_VERSION"
else
    log "⚠️  Rollback completed with warnings. Please check the services manually." "$YELLOW"
fi

# Step 12: Cleanup old images (optional)
log "Cleaning up old Docker images..."
docker image prune -f

log "Rollback process completed. Check $LOG_FILE for details."