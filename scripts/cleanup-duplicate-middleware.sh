#!/bin/bash

# Script to clean up duplicate middleware files after consolidation

echo "🧹 Cleaning up duplicate middleware files..."

# Navigate to backend middleware directory
cd packages/backend/src/middleware

# Backup old files first (just in case)
mkdir -p _backup
echo "📦 Creating backup of old middleware files..."

# Performance middleware duplicates
cp performanceMiddleware.ts _backup/ 2>/dev/null
cp performanceMonitoring.ts _backup/ 2>/dev/null
cp performanceMonitoringMiddleware.ts _backup/ 2>/dev/null
cp performanceTracking.ts _backup/ 2>/dev/null
cp performance.ts _backup/ 2>/dev/null

# Error handler duplicates
cp errorHandler.ts _backup/ 2>/dev/null
cp errorHandler.enhanced.ts _backup/ 2>/dev/null
cp errorHandleri18n.ts _backup/ 2>/dev/null

echo "✅ Backup created in packages/backend/src/middleware/_backup/"

# Check for any imports of old middleware
echo ""
echo "🔍 Checking for remaining imports of old middleware..."

# Check performance middleware imports
echo "Performance middleware imports:"
grep -r "from.*performanceMiddleware\|from.*performanceMonitoring\|from.*performanceTracking\|from.*performance\.ts" .. --include="*.ts" | grep -v "_backup" | grep -v ".consolidated" | grep -v ".unified" || echo "  ✅ No imports found"

# Check error handler imports
echo ""
echo "Error handler imports:"
grep -r "from.*errorHandler\.ts\|from.*errorHandler\.enhanced\|from.*errorHandleri18n" .. --include="*.ts" | grep -v "_backup" | grep -v ".unified" || echo "  ✅ No imports found"

echo ""
echo "⚠️  Ready to delete old middleware files:"
echo "  - performanceMiddleware.ts"
echo "  - performanceMonitoring.ts"
echo "  - performanceMonitoringMiddleware.ts"
echo "  - performanceTracking.ts"
echo "  - performance.ts"
echo "  - errorHandler.ts"
echo "  - errorHandler.enhanced.ts"
echo "  - errorHandleri18n.ts"

echo ""
read -p "Do you want to delete these files? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]
then
    echo "🗑️  Deleting old middleware files..."
    rm -f performanceMiddleware.ts
    rm -f performanceMonitoring.ts
    rm -f performanceMonitoringMiddleware.ts
    rm -f performanceTracking.ts
    rm -f performance.ts
    rm -f errorHandler.ts
    rm -f errorHandler.enhanced.ts
    rm -f errorHandleri18n.ts
    echo "✅ Old middleware files deleted"
    
    echo ""
    echo "📋 Summary:"
    echo "  - Consolidated performance middleware: performance.consolidated.ts"
    echo "  - Unified error handler: errorHandler.unified.ts"
    echo "  - Middleware composition utility: compose.ts"
    echo "  - Backup files kept in: _backup/"
else
    echo "❌ Deletion cancelled. Files remain in place."
fi

echo ""
echo "🎯 Next steps:"
echo "  1. Run tests to ensure everything works: npm test"
echo "  2. Check logs for any middleware errors"
echo "  3. Remove _backup directory after confirming everything works"