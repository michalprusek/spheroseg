#!/bin/bash

# This script will set up initial SSL certificates with Let's Encrypt for spherosegapp.utia.cas.cz

set -e

# Default variables
domains=(spherosegapp.utia.cas.cz)
email="prusemic@cvut.cz"  # Updated email
staging=0 # Set to 1 if you're testing your setup to avoid hitting request limits
data_path="./letsencrypt"
compose_file="docker-compose.yml"

# Prepare necessary directories
mkdir -p "$data_path/webroot"
mkdir -p "$data_path/etc/letsencrypt"
mkdir -p "$data_path/var/lib/letsencrypt"

echo "### Creating dummy certificate for $domains ..."
dummy_path="/C=US/ST=State/L=City/O=Organization/CN=${domains[0]}"
mkdir -p "$data_path/etc/letsencrypt/live/${domains[0]}"

# Use OpenSSL directly instead of through certbot
docker run --rm -v "$data_path/etc/letsencrypt:/etc/letsencrypt" \
    --entrypoint openssl \
    certbot/certbot \
    req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "/etc/letsencrypt/live/${domains[0]}/privkey.pem" \
    -out "/etc/letsencrypt/live/${domains[0]}/fullchain.pem" \
    -subj "$dummy_path"

echo "### Starting nginx ..."
docker-compose -f $compose_file up -d nginx

# Wait for nginx to start
echo "### Waiting for nginx to initialize ..."
sleep 5

# Request real certificate
echo "### Requesting Let's Encrypt certificate for $domains ..."
domain_args=""
for domain in "${domains[@]}"; do
  domain_args="$domain_args -d $domain"
done

# Select appropriate challenge method
echo "### Waiting 5 seconds before making the request..."
sleep 5

case "$staging" in
  0) 
    echo "### Requesting production certificate ..."
    docker-compose -f $compose_file run --rm -it certbot \
      certonly --webroot -w /var/www/letsencrypt \
      --email $email \
      --agree-tos \
      --no-eff-email \
      --force-renewal \
      $domain_args
    ;;
  1) 
    echo "### Requesting staging certificate ..."
    docker-compose -f $compose_file run --rm -it certbot \
      certonly --webroot -w /var/www/letsencrypt \
      --staging \
      --email $email \
      --agree-tos \
      --no-eff-email \
      --force-renewal \
      $domain_args
    ;;
esac

echo "### Reloading nginx ..."
docker-compose -f $compose_file exec nginx nginx -s reload

echo "### Certificate setup complete!"
echo "### Your site should now be accessible at https://${domains[0]}"
echo ""
echo "Don't forget to set up auto-renewal by including the certbot service in your docker-compose.yml"