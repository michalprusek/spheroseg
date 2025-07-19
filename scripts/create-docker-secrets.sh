#!/bin/bash

# Script to create Docker secrets for production deployment
# This script generates secure random passwords and creates Docker secrets

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to generate secure random password
generate_password() {
    local length=${1:-32}
    openssl rand -base64 $length | tr -d "=+/" | cut -c1-$length
}

# Function to create or update a Docker secret
create_secret() {
    local secret_name=$1
    local secret_value=$2
    
    # Check if secret exists
    if docker secret ls | grep -q "^${secret_name}"; then
        echo -e "${YELLOW}Secret '${secret_name}' already exists. Skipping...${NC}"
    else
        echo "$secret_value" | docker secret create "${secret_name}" -
        echo -e "${GREEN}Created secret: ${secret_name}${NC}"
    fi
}

# Function to create secret from file
create_secret_from_file() {
    local secret_name=$1
    local file_path=$2
    
    if [ ! -f "$file_path" ]; then
        echo -e "${RED}File not found: ${file_path}${NC}"
        return 1
    fi
    
    if docker secret ls | grep -q "^${secret_name}"; then
        echo -e "${YELLOW}Secret '${secret_name}' already exists. Skipping...${NC}"
    else
        docker secret create "${secret_name}" "${file_path}"
        echo -e "${GREEN}Created secret from file: ${secret_name}${NC}"
    fi
}

echo -e "${GREEN}=== Docker Secrets Creation Script ===${NC}"
echo ""

# Initialize Docker Swarm if not already initialized
if ! docker info | grep -q "Swarm: active"; then
    echo -e "${YELLOW}Initializing Docker Swarm...${NC}"
    docker swarm init || echo -e "${YELLOW}Swarm already initialized or error occurred${NC}"
fi

# Create secrets directory if it doesn't exist
SECRETS_DIR="./secrets"
mkdir -p "$SECRETS_DIR"

# Generate passwords and store them securely
echo -e "${GREEN}Generating secure passwords...${NC}"

# Database passwords
DB_PASSWORD=$(generate_password 32)
DB_ROOT_PASSWORD=$(generate_password 32)
echo "$DB_PASSWORD" > "$SECRETS_DIR/db_password.txt"
echo "$DB_ROOT_PASSWORD" > "$SECRETS_DIR/db_root_password.txt"

# JWT and session secrets (64 characters for extra security)
JWT_SECRET=$(generate_password 64)
SESSION_SECRET=$(generate_password 64)
echo "$JWT_SECRET" > "$SECRETS_DIR/jwt_secret.txt"
echo "$SESSION_SECRET" > "$SECRETS_DIR/session_secret.txt"

# Service passwords
RABBITMQ_PASSWORD=$(generate_password 32)
REDIS_PASSWORD=$(generate_password 32)
EMAIL_PASSWORD=${EMAIL_PASSWORD:-$(generate_password 32)}  # Use existing or generate
GRAFANA_PASSWORD=$(generate_password 32)

echo "$RABBITMQ_PASSWORD" > "$SECRETS_DIR/rabbitmq_password.txt"
echo "$REDIS_PASSWORD" > "$SECRETS_DIR/redis_password.txt"
echo "$EMAIL_PASSWORD" > "$SECRETS_DIR/email_password.txt"
echo "$GRAFANA_PASSWORD" > "$SECRETS_DIR/grafana_password.txt"

# Create Docker secrets
echo -e "${GREEN}Creating Docker secrets...${NC}"

create_secret "db_password" "$DB_PASSWORD"
create_secret "db_root_password" "$DB_ROOT_PASSWORD"
create_secret "jwt_secret" "$JWT_SECRET"
create_secret "session_secret" "$SESSION_SECRET"
create_secret "rabbitmq_password" "$RABBITMQ_PASSWORD"
create_secret "redis_password" "$REDIS_PASSWORD"
create_secret "email_password" "$EMAIL_PASSWORD"
create_secret "grafana_password" "$GRAFANA_PASSWORD"

# Handle SSL certificates
echo -e "${GREEN}Handling SSL certificates...${NC}"

SSL_CERT_PATH="./ssl/server.crt"
SSL_KEY_PATH="./ssl/server.key"

# Check if Let's Encrypt certificates exist
LETSENCRYPT_CERT="/etc/letsencrypt/live/spherosegapp.utia.cas.cz/fullchain.pem"
LETSENCRYPT_KEY="/etc/letsencrypt/live/spherosegapp.utia.cas.cz/privkey.pem"

if [ -f "$LETSENCRYPT_CERT" ] && [ -f "$LETSENCRYPT_KEY" ]; then
    echo -e "${GREEN}Using Let's Encrypt certificates${NC}"
    create_secret_from_file "ssl_cert" "$LETSENCRYPT_CERT"
    create_secret_from_file "ssl_key" "$LETSENCRYPT_KEY"
elif [ -f "$SSL_CERT_PATH" ] && [ -f "$SSL_KEY_PATH" ]; then
    echo -e "${YELLOW}Using self-signed certificates (not recommended for production)${NC}"
    create_secret_from_file "ssl_cert" "$SSL_CERT_PATH"
    create_secret_from_file "ssl_key" "$SSL_KEY_PATH"
else
    echo -e "${RED}No SSL certificates found!${NC}"
    echo -e "${YELLOW}Generating self-signed certificate for testing...${NC}"
    
    mkdir -p ./ssl
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout ./ssl/server.key \
        -out ./ssl/server.crt \
        -subj "/C=CZ/ST=Prague/L=Prague/O=UTIA/CN=spherosegapp.utia.cas.cz"
    
    create_secret_from_file "ssl_cert" "./ssl/server.crt"
    create_secret_from_file "ssl_key" "./ssl/server.key"
fi

# Create .env.production file with non-secret configurations
echo -e "${GREEN}Creating .env.production file...${NC}"

cat > .env.production << EOF
# Production Environment Configuration
# This file contains non-secret configurations
# Secrets are managed via Docker Secrets

# Application
NODE_ENV=production
APP_URL=https://spherosegapp.utia.cas.cz
FRONTEND_URL=https://spherosegapp.utia.cas.cz

# Database
DB_HOST=db
DB_PORT=5432
DB_NAME=spheroseg
DB_USER=postgres
DB_SSL=true

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# RabbitMQ
RABBITMQ_HOST=rabbitmq
RABBITMQ_PORT=5672
RABBITMQ_USER=admin
RABBITMQ_QUEUE=segmentation_tasks

# Email
EMAIL_FROM=spheroseg@utia.cas.cz
EMAIL_HOST=mail.utia.cas.cz
EMAIL_PORT=25
EMAIL_USER=

# Rate Limiting
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60
ENABLE_RATE_LIMIT=true

# Performance
ENABLE_PERFORMANCE_MONITORING=true
COMPRESSION_LEVEL=6
DB_POOL_MAX=20
DB_POOL_MIN=5

# Cache
REDIS_CACHE_TTL=300
ENABLE_REDIS_CACHE=true
CACHE_TTL_PROJECT=300
CACHE_TTL_IMAGE_LIST=60
CACHE_TTL_USER=600
CACHE_TTL_QUEUE_STATUS=5
EOF

# Save credentials securely
echo -e "${GREEN}Saving credentials to secure file...${NC}"

cat > "$SECRETS_DIR/production-credentials.txt" << EOF
=== PRODUCTION CREDENTIALS ===
Generated on: $(date)

Database:
- User: postgres
- Password: $DB_PASSWORD
- Root Password: $DB_ROOT_PASSWORD

JWT Secret: $JWT_SECRET
Session Secret: $SESSION_SECRET

RabbitMQ:
- User: admin
- Password: $RABBITMQ_PASSWORD

Redis Password: $REDIS_PASSWORD
Email Password: $EMAIL_PASSWORD

Grafana:
- User: admin
- Password: $GRAFANA_PASSWORD

IMPORTANT: Store this file securely and delete after saving passwords to a password manager!
EOF

chmod 600 "$SECRETS_DIR/production-credentials.txt"

echo ""
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo ""
echo -e "${YELLOW}IMPORTANT NEXT STEPS:${NC}"
echo "1. Save the credentials from $SECRETS_DIR/production-credentials.txt to a secure password manager"
echo "2. Delete the $SECRETS_DIR directory after saving the credentials"
echo "3. Obtain proper SSL certificates from Let's Encrypt"
echo "4. Review and adjust the .env.production file as needed"
echo "5. Deploy using: docker-compose -f docker-compose.yml -f docker-compose.production.yml --profile prod up -d"
echo ""
echo -e "${RED}SECURITY WARNING: Never commit the secrets directory or credentials to version control!${NC}"

# Add to .gitignore if not already present
if ! grep -q "^secrets/" .gitignore 2>/dev/null; then
    echo "secrets/" >> .gitignore
    echo -e "${GREEN}Added secrets/ to .gitignore${NC}"
fi