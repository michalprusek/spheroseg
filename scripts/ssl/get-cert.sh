#!/bin/bash

# Simple script to get Let's Encrypt certificate for spherosegapp.utia.cas.cz

# Set variables
DOMAIN="spherosegapp.utia.cas.cz"
EMAIL="prusemic@cvut.cz"  # Updated email
DATA_PATH="./letsencrypt"

# Create directories
mkdir -p $DATA_PATH/webroot
mkdir -p $DATA_PATH/etc/letsencrypt
mkdir -p $DATA_PATH/var/lib/letsencrypt

# Ensure nginx is running and configured to handle the ACME challenge
echo "Making sure nginx is running..."
docker-compose up -d nginx
sleep 5

# Now request the certificate
echo "Requesting Let's Encrypt certificate for $DOMAIN..."
docker-compose run --rm certbot \
  certonly --webroot \
  --webroot-path=/var/www/letsencrypt \
  --email $EMAIL \
  --agree-tos \
  --no-eff-email \
  -d $DOMAIN

# Check if we got the certificate
if [ -d "$DATA_PATH/etc/letsencrypt/live/$DOMAIN" ]; then
  echo "Certificate successfully obtained!"
  
  # Start the certbot service for auto-renewal
  docker-compose up -d certbot
  
  # Reload nginx to use the new certificate
  docker-compose exec nginx nginx -s reload
  
  echo "SSL is now configured. Your site should be accessible at https://$DOMAIN"
else
  echo "Certificate not obtained. Check the logs for errors."
fi