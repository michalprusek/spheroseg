#!/bin/bash

# Production Deployment Script for SpherosegApp
# This script prepares and deploys the fix for React module resolution

set -e  # Exit on error

echo "🚀 Starting Production Deployment for SpherosegApp"
echo "================================================"

# 1. Ensure all files are committed
echo "📝 Checking Git status..."
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  Uncommitted changes detected. Committing..."
    git add -A
    git commit -m "fix: Fix React module resolution for production deployment

- Add import map plugin for resolving bare module specifiers
- Configure Vite to externalize React in production
- Use automatic JSX runtime to avoid React import issues
- Load React modules from esm.sh CDN

This fixes the 'Failed to resolve module specifier react' error"
fi

# 2. Create deployment branch
echo "🌿 Creating deployment branch..."
BRANCH_NAME="fix/react-module-resolution-$(date +%Y%m%d-%H%M%S)"
git checkout -b "$BRANCH_NAME"

# 3. Ensure all necessary files exist
echo "📄 Verifying required files..."

# Check if vite-plugin-import-map.ts exists
if [ ! -f "packages/frontend/vite-plugin-import-map.ts" ]; then
    echo "❌ Missing vite-plugin-import-map.ts"
    exit 1
fi

# Check if Dockerfile.prod has the import map plugin copy
if ! grep -q "vite-plugin-import-map.ts" packages/frontend/Dockerfile.prod; then
    echo "❌ Dockerfile.prod is missing vite-plugin-import-map.ts copy instruction"
    exit 1
fi

# 4. Build production image locally
echo "🔨 Building production Docker image..."
docker-compose build frontend-prod

# 5. Test the build locally
echo "🧪 Testing production build locally..."
docker-compose stop frontend-prod 2>/dev/null || true
docker-compose rm -f frontend-prod 2>/dev/null || true
docker-compose up -d frontend-prod

# Wait for container to start
sleep 5

# Check if frontend is responding
if curl -sk https://localhost | grep -q "importmap"; then
    echo "✅ Import map is present in production build"
else
    echo "❌ Import map not found in production build"
    exit 1
fi

# 6. Create deployment package
echo "📦 Creating deployment package..."
DEPLOY_DIR="spheroseg-deploy-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEPLOY_DIR"

# Copy only necessary files for deployment
cp -r packages/frontend/vite.config.ts "$DEPLOY_DIR/"
cp -r packages/frontend/vite-plugin-import-map.ts "$DEPLOY_DIR/"
cp -r packages/frontend/Dockerfile.prod "$DEPLOY_DIR/"
cp -r docker-compose.yml "$DEPLOY_DIR/"
cp -r docker-compose.prod.yml "$DEPLOY_DIR/" 2>/dev/null || true

# Create deployment instructions
cat > "$DEPLOY_DIR/DEPLOY_INSTRUCTIONS.md" << 'EOF'
# Deployment Instructions

## Quick Deploy
```bash
# 1. Copy these files to the production server
# 2. Run the following commands:

docker-compose build frontend-prod
docker-compose stop frontend-prod
docker-compose rm -f frontend-prod
docker-compose up -d frontend-prod

# 3. Clear any CDN cache if applicable
# 4. Test at https://spherosegapp.utia.cas.cz/
```

## Files Changed
- vite.config.ts - Added import map plugin
- vite-plugin-import-map.ts - New plugin for import maps
- Dockerfile.prod - Added plugin file to build
EOF

# Create tar archive
tar -czf "$DEPLOY_DIR.tar.gz" "$DEPLOY_DIR"
echo "✅ Deployment package created: $DEPLOY_DIR.tar.gz"

# 7. Generate deployment commands for production
cat > deploy-commands.txt << 'EOF'
# Commands to run on production server:

# 1. Backup current version
docker tag spheroseg-frontend-prod spheroseg-frontend-prod:backup-$(date +%Y%m%d-%H%M%S)

# 2. Update code (if using git)
git pull origin main

# 3. Build new image
docker-compose build frontend-prod

# 4. Deploy new version
docker-compose stop frontend-prod
docker-compose rm -f frontend-prod
docker-compose up -d frontend-prod

# 5. Verify deployment
curl -s https://spherosegapp.utia.cas.cz/ | grep -q "importmap" && echo "✅ Import map deployed" || echo "❌ Import map missing"
EOF

echo ""
echo "🎉 Deployment preparation complete!"
echo ""
echo "📋 Next steps:"
echo "1. Push changes to git: git push origin $BRANCH_NAME"
echo "2. Deploy to production using deploy-commands.txt"
echo "3. Test with Playwright after deployment"
echo ""
echo "Deployment package: $DEPLOY_DIR.tar.gz"
echo "Deployment commands: deploy-commands.txt"