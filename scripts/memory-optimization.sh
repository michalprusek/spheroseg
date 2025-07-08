#!/bin/bash

# Memory Optimization Script for Spheroseg
# This script helps monitor and optimize memory usage

echo "=== Spheroseg Memory Optimization ==="
echo

# Check current memory usage
echo "Current Docker Container Memory Usage:"
docker stats --no-stream --format "table {{.Container}}\t{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" | grep -E "(NAME|spheroseg)"
echo

# Check system memory
echo "System Memory Info:"
free -h
echo

# Check for memory leaks in Node.js backend
echo "Backend Node.js Memory Usage:"
docker exec spheroseg-backend sh -c "ps aux | grep node"
echo

# Clean up Docker resources
echo "Cleaning up unused Docker resources..."
docker system prune -f --volumes
echo

# Restart containers with high memory usage
echo "Checking for containers with high memory usage..."
BACKEND_MEM=$(docker stats --no-stream --format "{{.MemPerc}}" spheroseg-backend | sed 's/%//')
if (( $(echo "$BACKEND_MEM > 1.0" | bc -l) )); then
    echo "Backend memory usage is high ($BACKEND_MEM%). Consider restarting."
fi

# Display recommendations
echo
echo "=== Recommendations ==="
echo "1. Backend container has memory limits set to 512MB"
echo "2. Node.js max-old-space-size is set to 384MB"
echo "3. Monitor logs for memory warnings: docker-compose logs backend | grep 'High memory'"
echo "4. Check for database connection leaks: docker-compose logs backend | grep 'client.release'"
echo "5. Restart containers if needed: docker-compose --profile dev restart backend"
echo

# Check for WebSocket errors
echo "Checking for recent WebSocket errors..."
WEBSOCKET_ERRORS=$(docker-compose logs --tail 100 backend 2>&1 | grep -c "Chyba při odesílání")
if [ "$WEBSOCKET_ERRORS" -gt 0 ]; then
    echo "Found $WEBSOCKET_ERRORS WebSocket errors in recent logs"
else
    echo "No WebSocket errors found in recent logs ✓"
fi