#!/bin/bash

# Script for initializing the database

echo "Initializing database..."

# Run migrations
npx prisma migrate deploy

# Seed database
npx prisma db seed

echo "Database initialization completed." 