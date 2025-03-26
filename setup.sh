#!/bin/bash

# Spheroid Segmentation Platform - Setup Script

echo "Setting up Cell Segmentation Hub..."

# Create directories if not exist
mkdir -p backend/uploads/images
mkdir -p backend/uploads/thumbnails
mkdir -p backend/uploads/temp

# Install frontend dependencies
echo "Installing frontend dependencies..."
npm install

# Install backend dependencies
echo "Installing backend dependencies..."
cd backend && npm install
cd ..

# Build Docker images
echo "Building Docker images..."
docker compose build

# Start containers
echo "Starting containers..."
docker compose up -d

echo "Waiting for database to be ready..."
sleep 10

# Run database migrations and seed
echo "Initializing database..."
cd backend && npx prisma migrate deploy && npx prisma db seed
cd ..

echo "Setup completed!"
echo "Frontend available at: http://localhost:3000"
echo "Backend API available at: http://localhost:8000"
echo "PostgreSQL available at: localhost:5432" 