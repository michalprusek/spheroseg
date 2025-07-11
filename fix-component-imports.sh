#!/bin/bash

echo "Fixing component import issues..."

# Find all test files with "Element type is invalid" issues
echo "Finding test files with import issues..."

# Fix common import patterns
find /home/cvat/spheroseg/spheroseg/packages/frontend -name "*.test.tsx" -o -name "*.test.ts" | while read file; do
  # Fix ImageActions import
  sed -i "s/import { ImageActions } from '..\/ImageActions'/import ImageActions from '..\/ImageActions'/g" "$file"
  
  # Fix Dialog imports from @/components/ui/dialog
  sed -i "s/import { Dialog,/import { Dialog,/g" "$file"
  
  # Fix other common named/default export mismatches
  sed -i "s/import { ProjectCard } from '..\/ProjectCard'/import ProjectCard from '..\/ProjectCard'/g" "$file"
  sed -i "s/import { ProjectActions } from '..\/ProjectActions'/import ProjectActions from '..\/ProjectActions'/g" "$file"
  sed -i "s/import { ImageDisplay } from '..\/ImageDisplay'/import ImageDisplay from '..\/ImageDisplay'/g" "$file"
done

echo "Component import fixes completed."