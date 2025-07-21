#!/bin/bash

# Script to consolidate API client implementations
# This helps migrate from legacy API clients to the modern unified client

set -e

echo "🔄 Starting API Client Consolidation..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Base directory
BASE_DIR="packages/frontend/src"

# Step 1: Find all files using legacy imports
echo -e "\n${YELLOW}Step 1: Finding files with legacy API client imports...${NC}"
LEGACY_IMPORTS=$(grep -r "@/lib/apiClient\|from '@/lib/apiClient\|from \"@/lib/apiClient" $BASE_DIR --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "services/api/client" | cut -d: -f1 | sort | uniq)

if [ -z "$LEGACY_IMPORTS" ]; then
    echo -e "${GREEN}✅ No legacy imports found!${NC}"
else
    echo -e "${RED}Found legacy imports in:${NC}"
    echo "$LEGACY_IMPORTS" | nl
fi

# Step 2: Check for direct axios usage that should use API client
echo -e "\n${YELLOW}Step 2: Finding direct axios usage...${NC}"
DIRECT_AXIOS=$(grep -r "axios\." $BASE_DIR --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "node_modules" | grep -v "apiClient" | grep -v ".test." | cut -d: -f1 | sort | uniq)

if [ -z "$DIRECT_AXIOS" ]; then
    echo -e "${GREEN}✅ No direct axios usage found!${NC}"
else
    echo -e "${RED}Found direct axios usage in:${NC}"
    echo "$DIRECT_AXIOS" | nl
fi

# Step 3: Find uploadClient usage
echo -e "\n${YELLOW}Step 3: Finding uploadClient usage...${NC}"
UPLOAD_CLIENT=$(grep -r "uploadClient\|from '@/lib/uploadClient" $BASE_DIR --include="*.ts" --include="*.tsx" 2>/dev/null | cut -d: -f1 | sort | uniq)

if [ -z "$UPLOAD_CLIENT" ]; then
    echo -e "${GREEN}✅ No uploadClient usage found!${NC}"
else
    echo -e "${RED}Found uploadClient usage in:${NC}"
    echo "$UPLOAD_CLIENT" | nl
fi

# Step 4: Find files importing from enhanced client
echo -e "\n${YELLOW}Step 4: Finding enhanced API client imports...${NC}"
ENHANCED_IMPORTS=$(grep -r "apiClient.enhanced\|enhancedApiClient" $BASE_DIR --include="*.ts" --include="*.tsx" 2>/dev/null | cut -d: -f1 | sort | uniq)

if [ -z "$ENHANCED_IMPORTS" ]; then
    echo -e "${GREEN}✅ No enhanced client imports found!${NC}"
else
    echo -e "${RED}Found enhanced client imports in:${NC}"
    echo "$ENHANCED_IMPORTS" | nl
fi

# Step 5: Generate migration commands
echo -e "\n${YELLOW}Step 5: Generating migration commands...${NC}"

echo -e "\n${GREEN}To update imports automatically, run:${NC}"
echo "# Update legacy apiClient imports"
echo "find $BASE_DIR -name '*.ts' -o -name '*.tsx' | xargs sed -i \"s|from '@/lib/apiClient'|from '@/services/api/client'|g\""
echo "find $BASE_DIR -name '*.ts' -o -name '*.tsx' | xargs sed -i \"s|from \\\"@/lib/apiClient\\\"|from '@/services/api/client'|g\""
echo "find $BASE_DIR -name '*.ts' -o -name '*.tsx' | xargs sed -i \"s|import apiClient from '@/lib/apiClient'|import apiClient from '@/services/api/client'|g\""

echo -e "\n# Update api/apiClient re-export imports"
echo "find $BASE_DIR -name '*.ts' -o -name '*.tsx' | xargs sed -i \"s|from '@/api/apiClient'|from '@/services/api/client'|g\""

echo -e "\n# Update uploadClient imports"
echo "find $BASE_DIR -name '*.ts' -o -name '*.tsx' | xargs sed -i \"s|from '@/lib/uploadClient'|from '@/services/api/client'|g\""
echo "find $BASE_DIR -name '*.ts' -o -name '*.tsx' | xargs sed -i \"s|uploadClient|apiClient.upload|g\""

# Step 6: Files to remove
echo -e "\n${YELLOW}Step 6: Legacy files to remove:${NC}"
LEGACY_FILES=(
    "$BASE_DIR/lib/apiClient.ts"
    "$BASE_DIR/lib/apiClient.enhanced.ts"
    "$BASE_DIR/lib/uploadClient.ts"
    "$BASE_DIR/api/apiClient.ts"
)

for file in "${LEGACY_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${RED}❌ $file${NC}"
    else
        echo -e "${GREEN}✅ $file (already removed)${NC}"
    fi
done

# Step 7: Check for API endpoint usage patterns
echo -e "\n${YELLOW}Step 7: Checking API endpoint patterns...${NC}"
echo "Looking for direct API calls that could use typed endpoints..."

# Common patterns to migrate
PATTERNS=(
    "apiClient.get('/projects"
    "apiClient.post('/projects"
    "apiClient.get('/images"
    "apiClient.post('/images"
    "apiClient.get('/auth"
    "apiClient.post('/auth"
)

for pattern in "${PATTERNS[@]}"; do
    COUNT=$(grep -r "$pattern" $BASE_DIR --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
    if [ $COUNT -gt 0 ]; then
        echo -e "${YELLOW}Found $COUNT instances of: $pattern${NC}"
    fi
done

# Summary
echo -e "\n${GREEN}=== Migration Summary ===${NC}"
echo "1. Update all imports to use @/services/api/client"
echo "2. Replace uploadClient with apiClient.upload method"
echo "3. Migrate to typed endpoints from api object"
echo "4. Remove legacy client files"
echo "5. Update tests to use new client and endpoints"

echo -e "\n${YELLOW}⚠️  Note: After running automated updates, manually review:${NC}"
echo "- Error handling patterns"
echo "- Upload progress callbacks"
echo "- Custom axios configurations"
echo "- Test mocks and fixtures"

echo -e "\n${GREEN}✅ Consolidation analysis complete!${NC}"