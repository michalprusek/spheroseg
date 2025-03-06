#!/bin/bash

# Stop and remove all containers
echo "Stopping and removing all containers..."
docker compose down
cd backend && docker compose down
cd ..

# Build and start the backend containers
echo "Starting backend containers..."
cd backend && docker compose up -d
cd ..

# Build and start the frontend container
echo "Starting frontend container..."
docker compose up -d

echo "All containers have been restarted."
echo "Frontend is available at http://localhost:3001"
echo "Backend API is available at http://localhost:8000"
echo "MinIO is available at http://localhost:9000"

# Make the script executable
chmod +x restart.sh

# Create screenshots directory if it doesn't exist
mkdir -p spheroseg/browser_screenshots

echo "Created directory for browser screenshots: spheroseg/browser_screenshots" 