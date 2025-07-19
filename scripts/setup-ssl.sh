#!/bin/bash
set -euo pipefail

# SSL Certificate Setup Script for SpherosegV4
# This script sets up Let's Encrypt SSL certificates for production

# Configuration
DOMAIN=${1:-spheroseg.com}
EMAIL=${2:-admin@spheroseg.com}
STAGING=${3:-false}

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   log_error "This script must be run as root"
   exit 1
fi

log_info "Setting up SSL certificates for $DOMAIN"

# Install certbot if not already installed
if ! command -v certbot &> /dev/null; then
    log_info "Installing certbot..."
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
fi

# Create SSL directory
mkdir -p /home/cvat/spheroseg/spheroseg/ssl

# Stop nginx if running
log_info "Stopping nginx..."
docker-compose -f /home/cvat/spheroseg/spheroseg/docker-compose.prod.yml stop nginx || true

# Set staging flag
STAGING_FLAG=""
if [ "$STAGING" = "true" ]; then
    STAGING_FLAG="--staging"
    log_info "Using Let's Encrypt staging environment"
fi

# Obtain certificates
log_info "Obtaining SSL certificates..."
certbot certonly \
    --standalone \
    --preferred-challenges http \
    --agree-tos \
    --no-eff-email \
    --email "$EMAIL" \
    -d "$DOMAIN" \
    -d "www.$DOMAIN" \
    -d "api.$DOMAIN" \
    -d "assets.$DOMAIN" \
    $STAGING_FLAG

# Copy certificates to project directory
log_info "Copying certificates..."
cp -L /etc/letsencrypt/live/$DOMAIN/fullchain.pem /home/cvat/spheroseg/spheroseg/ssl/
cp -L /etc/letsencrypt/live/$DOMAIN/privkey.pem /home/cvat/spheroseg/spheroseg/ssl/
cp -L /etc/letsencrypt/live/$DOMAIN/chain.pem /home/cvat/spheroseg/spheroseg/ssl/

# Set proper permissions
chown -R cvat:cvat /home/cvat/spheroseg/spheroseg/ssl/
chmod 644 /home/cvat/spheroseg/spheroseg/ssl/*.pem
chmod 600 /home/cvat/spheroseg/spheroseg/ssl/privkey.pem

# Create renewal script
cat > /etc/cron.daily/spheroseg-ssl-renewal <<EOF
#!/bin/bash
certbot renew --quiet --no-self-upgrade --post-hook "
    cp -L /etc/letsencrypt/live/$DOMAIN/fullchain.pem /home/cvat/spheroseg/spheroseg/ssl/
    cp -L /etc/letsencrypt/live/$DOMAIN/privkey.pem /home/cvat/spheroseg/spheroseg/ssl/
    cp -L /etc/letsencrypt/live/$DOMAIN/chain.pem /home/cvat/spheroseg/spheroseg/ssl/
    chown -R cvat:cvat /home/cvat/spheroseg/spheroseg/ssl/
    chmod 644 /home/cvat/spheroseg/spheroseg/ssl/*.pem
    chmod 600 /home/cvat/spheroseg/spheroseg/ssl/privkey.pem
    docker-compose -f /home/cvat/spheroseg/spheroseg/docker-compose.prod.yml restart nginx
"
EOF

chmod +x /etc/cron.daily/spheroseg-ssl-renewal

# Start nginx
log_info "Starting nginx with SSL..."
docker-compose -f /home/cvat/spheroseg/spheroseg/docker-compose.prod.yml up -d nginx

log_info "SSL setup completed successfully!"
log_info "Certificates will auto-renew via cron job"
log_info ""
log_info "Next steps:"
echo "1. Update DNS records to point to this server"
echo "2. Test HTTPS access: https://$DOMAIN"
echo "3. Check certificate: openssl s_client -connect $DOMAIN:443 -servername $DOMAIN"