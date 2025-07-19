#!/bin/bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Log functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   log_error "This script should not be run as root!"
   exit 1
fi

log_info "Starting SpherosegV4 production deployment..."

# Check Docker and Docker Compose
if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    log_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create required directories
log_info "Creating required directories..."
mkdir -p logs/{nginx,backend,ml}
mkdir -p uploads
mkdir -p backup
mkdir -p ssl

# Check if secrets exist
log_info "Checking Docker secrets..."
REQUIRED_SECRETS=(
    "db_user"
    "db_password"
    "database_url"
    "jwt_secret"
    "jwt_refresh_secret"
    "redis_url"
    "redis_password"
    "session_secret"
)

MISSING_SECRETS=()
for secret in "${REQUIRED_SECRETS[@]}"; do
    if ! docker secret ls | grep -q "^$secret"; then
        MISSING_SECRETS+=("$secret")
    fi
done

if [ ${#MISSING_SECRETS[@]} -ne 0 ]; then
    log_error "Missing Docker secrets: ${MISSING_SECRETS[*]}"
    log_info "Please create the missing secrets using:"
    for secret in "${MISSING_SECRETS[@]}"; do
        echo "  echo 'your-secret-value' | docker secret create $secret -"
    done
    exit 1
fi

# Check environment variables
log_info "Checking environment variables..."
if [ ! -f .env.production ]; then
    log_warn ".env.production file not found. Creating from template..."
    cat > .env.production <<EOF
# Production Environment Variables
NODE_ENV=production

# Domain configuration
DOMAIN=spheroseg.com
ALLOWED_ORIGINS=https://spheroseg.com,https://www.spheroseg.com

# API URLs
VITE_API_URL=https://api.spheroseg.com
VITE_API_BASE_URL=/api
VITE_ASSETS_URL=https://assets.spheroseg.com

# Backup configuration
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=30
BACKUP_S3_BUCKET=spheroseg-backups

# Monitoring
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=change-me-in-production
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# GPU configuration (optional)
CUDA_VISIBLE_DEVICES=0
EOF
    log_warn "Please edit .env.production with your actual values"
    exit 1
fi

# Load environment variables
source .env.production

# Build images
log_info "Building Docker images..."
docker-compose -f docker-compose.prod.yml build

# Pull latest images
log_info "Pulling latest base images..."
docker-compose -f docker-compose.prod.yml pull

# Run database migrations
log_info "Running database migrations..."
docker-compose -f docker-compose.prod.yml run --rm backend npm run db:migrate

# Stop existing services
log_info "Stopping existing services..."
docker-compose -f docker-compose.prod.yml down

# Start services
log_info "Starting production services..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be healthy
log_info "Waiting for services to be healthy..."
sleep 10

# Check service health
SERVICES=("db" "redis" "backend" "ml" "frontend" "nginx")
ALL_HEALTHY=true

for service in "${SERVICES[@]}"; do
    if docker-compose -f docker-compose.prod.yml ps | grep "$service" | grep -q "healthy"; then
        log_info "$service is healthy"
    else
        log_error "$service is not healthy"
        ALL_HEALTHY=false
    fi
done

if [ "$ALL_HEALTHY" = false ]; then
    log_error "Some services are not healthy. Check logs with:"
    echo "  docker-compose -f docker-compose.prod.yml logs"
    exit 1
fi

# Start monitoring stack
log_info "Starting monitoring stack..."
docker-compose -f monitoring/docker-compose.monitoring.yml up -d

# Display service URLs
log_info "Deployment completed successfully!"
echo ""
echo "Service URLs:"
echo "  Application: https://${DOMAIN}"
echo "  API: https://api.${DOMAIN}"
echo "  Grafana: http://${DOMAIN}:3001 (admin/${GRAFANA_ADMIN_USER})"
echo "  Prometheus: http://${DOMAIN}:9090"
echo ""
echo "Useful commands:"
echo "  View logs: docker-compose -f docker-compose.prod.yml logs -f [service]"
echo "  Scale backend: docker-compose -f docker-compose.prod.yml up -d --scale backend=3"
echo "  Backup database: docker-compose -f docker-compose.prod.yml exec backup /usr/local/bin/backup.sh"
echo ""

log_info "Don't forget to:"
echo "  1. Configure SSL certificates (Let's Encrypt recommended)"
echo "  2. Set up DNS records for your domain"
echo "  3. Configure firewall rules"
echo "  4. Set up monitoring alerts"
echo "  5. Test the backup restore process"