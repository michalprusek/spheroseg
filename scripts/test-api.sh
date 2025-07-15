#!/bin/bash

# Get a valid auth token
echo "Getting auth token..."
AUTH_RESPONSE=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.zum", "password": "1234567890"}')

TOKEN=$(echo $AUTH_RESPONSE | jq -r '.token // empty')

if [ -z "$TOKEN" ]; then
  echo "Failed to get auth token. Response: $AUTH_RESPONSE"
  exit 1
fi

echo "Token obtained successfully"

# Fetch project images
echo -e "\nFetching images for project e68337fe-4ae9-4802-8a39-b0c92fb97b37..."
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:5001/api/projects/e68337fe-4ae9-4802-8a39-b0c92fb97b37/images" | jq '.[] | {id, name, storage_path, thumbnail_path}'

# Fetch specific image
echo -e "\nFetching specific image c92900e1-92b1-403d-a8fb-51ec7ea8bb31..."
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:5001/api/projects/e68337fe-4ae9-4802-8a39-b0c92fb97b37/images/c92900e1-92b1-403d-a8fb-51ec7ea8bb31" | jq '{id, name, storage_path, thumbnail_path}'