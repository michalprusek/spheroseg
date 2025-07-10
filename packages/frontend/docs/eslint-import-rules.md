# ESLint Import Rules Documentation

## Overview

This document describes the ESLint import rules configured for the SpherosegV4 frontend to prevent missing imports and maintain code quality.

## Import Rules

### 1. **import/no-unresolved** (Error)
Ensures that all imported modules can be resolved to a module on the local filesystem.

```typescript
// ❌ Bad - module doesn't exist
import { Component } from './NonExistentComponent';

// ✅ Good
import { Component } from './ExistingComponent';
```

### 2. **import/named** (Error)
Ensures that named imports correspond to named exports in the remote file.

```typescript
// ❌ Bad - NonExistentExport doesn't exist
import { NonExistentExport } from './utils';

// ✅ Good
import { existingExport } from './utils';
```

### 3. **import/default** (Error)
Ensures that a default export is present when importing default.

```typescript
// ❌ Bad - no default export in the module
import Component from './namedExportsOnly';

// ✅ Good
import Component from './componentWithDefault';
```

### 4. **import/namespace** (Error)
Ensures that namespace imports have corresponding exports.

```typescript
// ❌ Bad - using non-existent property
import * as Utils from './utils';
Utils.nonExistentFunction();

// ✅ Good
import * as Utils from './utils';
Utils.existingFunction();
```

### 5. **import/no-cycle** (Error)
Prevents circular dependencies with configurable depth.

```typescript
// ❌ Bad - A imports B, B imports A
// fileA.ts
import { b } from './fileB';

// fileB.ts
import { a } from './fileA';

// ✅ Good - no circular dependencies
```

### 6. **import/order** (Error)
Enforces a convention in module import order.

```typescript
// ✅ Good - proper import order
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/apiClient';

import { UserCard } from './UserCard';
import { userUtils } from './utils';

import type { User } from '@/types';
```

### 7. **unused-imports/no-unused-imports** (Error)
Removes unused imports automatically.

```typescript
// ❌ Bad - useState is imported but not used
import React, { useState } from 'react';

const Component = () => <div>Hello</div>;

// ✅ Good - all imports are used
import React from 'react';

const Component = () => <div>Hello</div>;
```

## Custom Rules

### 1. **local-rules/ensure-lazy-imports** (Error)
Ensures all page components in App.tsx use React.lazy() for code splitting.

```typescript
// ❌ Bad - direct import of page component
import AboutPage from './pages/AboutPage';

// ✅ Good - lazy import
const AboutPage = lazy(() => 
  import('./pages/AboutPage').catch(() => 
    import('./pages/NotFound')
  )
);
```

## TypeScript Path Resolution

The ESLint import resolver is configured to understand TypeScript path mappings:

```json
{
  "import/resolver": {
    "typescript": {
      "alwaysTryTypes": true,
      "project": ["./tsconfig.json", "./tsconfig.node.json"]
    }
  }
}
```

## Pre-commit Checks

A pre-commit hook runs automatically to check imports:

1. **Basic import validation** - checks for missing extensions, incorrect casing
2. **ESLint import rules** - comprehensive import validation
3. **TypeScript compilation** - ensures all types are correct

## Running Import Checks Manually

```bash
# Check imports only
node scripts/check-imports.js

# Run ESLint with import rules
npm run lint

# Run ESLint and fix issues
npm run lint:fix

# Check specific file
npx eslint src/App.tsx --rule "import/no-unresolved: error"
```

## Common Issues and Solutions

### Issue: Cannot resolve module
```
ESLint: Unable to resolve path to module './Component'. (import/no-unresolved)
```

**Solutions:**
1. Check if the file exists and has the correct extension
2. Ensure the path is correct (relative vs absolute)
3. Check TypeScript path mappings in tsconfig.json

### Issue: Named import not found
```
ESLint: NonExistentExport not found in './utils'. (import/named)
```

**Solutions:**
1. Verify the export exists in the source file
2. Check if you meant to use default import instead
3. Ensure the export name matches exactly (case-sensitive)

### Issue: Circular dependency detected
```
ESLint: Dependency cycle detected. (import/no-cycle)
```

**Solutions:**
1. Refactor shared code into a separate module
2. Use dependency injection pattern
3. Move types to a shared types file

## Integration with CI/CD

The ESLint import checks run automatically in:
- Pre-commit hooks
- GitHub Actions CI pipeline
- Pull request checks

## Disabling Rules

If you need to disable a rule for a specific line:

```typescript
// eslint-disable-next-line import/no-unresolved
import { experimental } from './experimental-module';
```

**Note:** Disabling import rules should be rare and well-justified.