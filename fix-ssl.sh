#!/bin/bash

# Helper script to fix SSL configuration issues

# Define variables
DOMAIN="spherosegapp.utia.cas.cz"
NGINX_CONF="./nginx.conf"
DOCKER_COMPOSE="docker-compose.yml"
LE_PATH="./letsencrypt"

echo "=== SSL Configuration Fix Tool ==="
echo ""

# Step 1: Check directories
echo "Checking directories..."
mkdir -p $LE_PATH/webroot
mkdir -p $LE_PATH/etc/letsencrypt
mkdir -p $LE_PATH/var/lib/letsencrypt
echo "Directory structure verified."

# Step 2: Check if nginx configuration has the correct paths
echo ""
echo "Checking nginx.conf Let's Encrypt paths..."
if grep -q "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" $NGINX_CONF; then
  echo "Nginx configuration has correct certificate paths."
else
  echo "Nginx configuration needs to be updated with correct certificate paths."
  echo "Please update your nginx.conf to use:"
  echo "  ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;"
  echo "  ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;"
fi

# Step 3: Check if docker-compose.yml is configured correctly
echo ""
echo "Checking Docker Compose configuration..."
if grep -q "certbot" $DOCKER_COMPOSE; then
  echo "Docker Compose has certbot configuration."
else
  echo "Docker Compose needs certbot service to be added."
fi

# Step 4: Provide options for fixing
echo ""
echo "Available fix options:"
echo "1. Force restart all containers"
echo "2. Run Certbot to obtain a new certificate"
echo "3. Update nginx to use Let's Encrypt certificates"
echo "4. Exit"

read -p "Select an option (1-4): " option

case $option in
  1)
    echo "Restarting all containers..."
    docker-compose down
    docker-compose up -d
    ;;
  2)
    echo "Running Certbot to obtain a new certificate..."
    docker-compose run --rm certbot \
      certonly --webroot \
      --webroot-path=/var/www/letsencrypt \
      --email prusemic@cvut.cz \
      --agree-tos \
      --no-eff-email \
      -d $DOMAIN
    docker-compose exec nginx nginx -s reload
    ;;
  3)
    echo "Updating nginx to use certificates..."
    docker-compose exec nginx nginx -s reload
    ;;
  4)
    echo "Exiting..."
    exit 0
    ;;
  *)
    echo "Invalid option. Exiting."
    exit 1
    ;;
esac

echo ""
echo "Done. Check if your site is now accessible via HTTPS."