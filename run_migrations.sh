#!/bin/bash

# Run database migrations inside the API container
docker exec spheroseg-api-1 python -m db.run_migration

echo "Database migration complete"