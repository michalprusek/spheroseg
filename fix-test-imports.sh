#!/bin/bash

echo "Fixing test import issues..."

# Fix EditMode imports from @spheroseg/types to local imports
echo "Fixing EditMode imports..."
find /home/cvat/spheroseg/spheroseg/packages/frontend -name "*.test.tsx" -o -name "*.test.ts" | while read file; do
  # Replace EditMode imports from @spheroseg/types
  sed -i "s|import { EditMode } from '@spheroseg/types';|import { EditMode } from '../hooks/segmentation/types';|g" "$file"
  sed -i "s|import { EditMode, .* } from '@spheroseg/types';|import { EditMode } from '../hooks/segmentation/types';|g" "$file"
  
  # For files in deeper directories, adjust the path
  if [[ $file == *"__tests__"* ]]; then
    # Count directory depth and adjust path accordingly
    depth=$(echo "$file" | awk -F"__tests__" '{print $2}' | tr -cd '/' | wc -c)
    if [ $depth -eq 2 ]; then
      sed -i "s|import { EditMode } from '../hooks/segmentation/types';|import { EditMode } from '../../hooks/segmentation/types';|g" "$file"
    elif [ $depth -eq 3 ]; then
      sed -i "s|import { EditMode } from '../hooks/segmentation/types';|import { EditMode } from '../../../hooks/segmentation/types';|g" "$file"
    fi
  fi
done

# Fix require() usage in vi.mocked calls
echo "Fixing require() usage in mocks..."
find /home/cvat/spheroseg/spheroseg/packages/frontend -name "*.test.tsx" -o -name "*.test.ts" | while read file; do
  # Replace vi.mocked(require('...')) with proper imports
  perl -i -pe "s/vi\.mocked\(require\('([^']+)'\)\)\.(\w+)\.mockReturnValue/const mock\2 = vi.fn().mockReturnValue/g" "$file"
  perl -i -pe "s/vi\.mocked\(require\('([^']+)'\)\)\.(\w+)/vi.mocked(\2)/g" "$file"
  perl -i -pe "s/vi\.mocked\(require\('([^']+)'\)\)/vi.mocked(useSegmentationV2)/g" "$file"
done

# Special case for CanvasImage.test.tsx - fix the path
echo "Fixing special cases..."
sed -i "s|import { EditMode } from '../../hooks/segmentation/types';|import { EditMode } from '../../../hooks/segmentation/types';|g" /home/cvat/spheroseg/spheroseg/packages/frontend/src/pages/segmentation/components/canvas/__tests__/CanvasImage.test.tsx

# Fix useCanvasContext import in CanvasImage.test.tsx
sed -i "s|vi.mocked(useCanvasContext)|useCanvasContext as vi.Mock|g" /home/cvat/spheroseg/spheroseg/packages/frontend/src/pages/segmentation/components/canvas/__tests__/CanvasImage.test.tsx

echo "Import fixes completed."