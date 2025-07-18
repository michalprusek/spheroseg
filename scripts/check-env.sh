#!/bin/bash

# Check Environment Variables Script
# This script verifies that all required environment variables are set

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Required environment variables
REQUIRED_VARS=(
    "JWT_SECRET"
    "DB_PASSWORD"
    "POSTGRES_PASSWORD"
    "RABBITMQ_DEFAULT_PASS"
)

# Optional environment variables
OPTIONAL_VARS=(
    "REDIS_PASSWORD"
    "SENTRY_DSN"
    "SMTP_PASS"
    "NEW_RELIC_LICENSE_KEY"
)

echo "Checking environment variables..."
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Warning: .env file not found${NC}"
    echo "Copy .env.example to .env and update with your values:"
    echo "  cp .env.example .env"
    echo ""
fi

# Check required variables
missing_required=0
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "${RED}✗ Missing required variable: $var${NC}"
        missing_required=$((missing_required + 1))
    else
        # Check for default/weak values
        if [[ "$var" == "JWT_SECRET" && "${!var}" == "development_secret_key_that_is_32_chars_long" ]]; then
            echo -e "${YELLOW}⚠ Warning: $var is using default development value${NC}"
        elif [[ "$var" == *"PASSWORD"* && "${!var}" == "postgres" ]]; then
            echo -e "${YELLOW}⚠ Warning: $var is using default weak password${NC}"
        elif [[ "$var" == *"PASS"* && "${!var}" == "guest" ]]; then
            echo -e "${YELLOW}⚠ Warning: $var is using default weak password${NC}"
        else
            echo -e "${GREEN}✓ $var is set${NC}"
        fi
    fi
done

# Check optional variables
echo ""
echo "Optional variables:"
for var in "${OPTIONAL_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "${YELLOW}○ $var is not set (optional)${NC}"
    else
        echo -e "${GREEN}✓ $var is set${NC}"
    fi
done

# Summary
echo ""
if [ $missing_required -gt 0 ]; then
    echo -e "${RED}ERROR: $missing_required required environment variable(s) missing${NC}"
    echo "Please set them in your .env file or environment"
    exit 1
else
    echo -e "${GREEN}All required environment variables are set${NC}"
fi

# Check for security warnings
if grep -q "development_secret\|postgres\|guest" .env 2>/dev/null; then
    echo ""
    echo -e "${YELLOW}WARNING: Default or weak values detected in .env file${NC}"
    echo "Please update these before deploying to production"
fi