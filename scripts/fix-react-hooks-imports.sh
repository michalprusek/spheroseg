#!/bin/bash

echo "Fixing @testing-library/react-hooks imports..."

# Find all files using the deprecated library and fix them
find /home/cvat/spheroseg/spheroseg/packages/frontend -name "*.test.tsx" -o -name "*.test.ts" | while read file; do
  if grep -q "@testing-library/react-hooks" "$file"; then
    echo "Fixing: $file"
    # Replace the import statement
    sed -i "s|import { renderHook.*} from '@testing-library/react-hooks';|import { renderHook, act, waitFor } from '@testing-library/react';|g" "$file"
    sed -i "s|import { act.*} from '@testing-library/react-hooks';|import { act } from '@testing-library/react';|g" "$file"
    sed -i "s|from '@testing-library/react-hooks'|from '@testing-library/react'|g" "$file"
  fi
done

echo "React hooks import fixes completed."