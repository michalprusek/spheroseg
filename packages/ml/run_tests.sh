#!/bin/bash
# Run pytest tests for ML service

echo "Running ML service tests..."

# Make sure we're in the ML directory
cd /home/cvat/spheroseg/spheroseg/packages/ml

# Run tests in Docker container if available
if command -v docker &> /dev/null; then
    echo "Running tests in Docker container..."
    docker-compose exec ml python -m pytest tests/ -v
else
    echo "Docker not available, running tests locally..."
    echo "Note: You may need to install dependencies first with: pip install -r requirements.txt"
    python3 -m pytest tests/ -v
fi