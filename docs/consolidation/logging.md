# Logging System Consolidation

## Overview

This document details the consolidation of logging approaches into a unified logging system that provides consistent logging across the frontend application.

## Problem Statement

The application had:
- Multiple logging patterns (direct console.log, custom logger, mixed approaches)
- No consistent namespacing convention
- Missing production logging capabilities
- No centralized log management
- Mixed error logging patterns

## Solution

Created a unified logging system at `/utils/logging/unifiedLogger.ts` with:
- Consistent API across the application
- Namespace support for module identification
- Log levels (DEBUG, INFO, WARN, ERROR)
- Memory storage for log aggregation
- Server shipping for production monitoring
- Console override capability

## Architecture

### Log Levels

```typescript
enum LogLevel {
  DEBUG = 0,  // Detailed debugging information
  INFO = 1,   // General information
  WARN = 2,   // Warning messages
  ERROR = 3,  // Error messages
  NONE = 4,   // Disable logging
}
```

### Logger Features

1. **Namespacing**: Identify log source
2. **Level Control**: Filter logs by severity
3. **Memory Storage**: Keep recent logs in memory
4. **Server Shipping**: Send logs to backend
5. **Context Enrichment**: Add metadata automatically
6. **Child Loggers**: Create sub-namespaced loggers

## Usage Patterns

### Basic Usage

```typescript
import { createLogger } from '@/utils/logging';

const logger = createLogger('MyComponent');

logger.debug('Component initialized', { props });
logger.info('User action', { action: 'click', target: 'button' });
logger.warn('Deprecated feature used');
logger.error('Failed to load data', error);
```

### Module Pattern

```typescript
import { getLogger } from '@/utils/logging';

// Get or create logger for module
const logger = getLogger('services:auth');

export class AuthService {
  async login(email: string, password: string) {
    logger.info('Login attempt', { email });
    
    try {
      const result = await apiClient.post('/auth/login', { email, password });
      logger.info('Login successful', { userId: result.data.user.id });
      return result;
    } catch (error) {
      logger.error('Login failed', error, { email });
      throw error;
    }
  }
}
```

### React Component Pattern

```typescript
import React, { useEffect } from 'react';
import { createLogger } from '@/utils/logging';

const logger = createLogger('components:UserProfile');

export function UserProfile({ userId }: Props) {
  useEffect(() => {
    logger.debug('UserProfile mounted', { userId });
    
    return () => {
      logger.debug('UserProfile unmounted', { userId });
    };
  }, [userId]);
  
  // Component logic...
}
```

### Child Logger Pattern

```typescript
const logger = createLogger('segmentation');

export class SegmentationService {
  private logger = logger.child('service');
  
  async processImage(imageId: string) {
    const processLogger = this.logger.child(`process-${imageId}`);
    
    processLogger.info('Starting image processing');
    // Processing logic...
    processLogger.info('Image processing completed');
  }
}
```

## Configuration

### Development vs Production

```typescript
// Development (automatic)
LogLevel.DEBUG - All logs shown in console

// Production (automatic)
LogLevel.INFO - Only INFO and above
Server shipping enabled
Console output still enabled
```

### Manual Configuration

```typescript
import { setGlobalLogLevel, LogLevel, setServerShippingEnabled } from '@/utils/logging';

// Change log level
setGlobalLogLevel(LogLevel.WARN);

// Disable server shipping
setServerShippingEnabled(false);

// Enable console override (optional)
import { overrideConsole } from '@/utils/logging';
overrideConsole(); // All console.log calls go through logger
```

## Migration Guide

### Phase 1: Update Imports

```typescript
// Old
import logger from '@/utils/logger';
import { createNamespacedLogger } from '@/utils/logger';

// New (same API, new location)
import logger from '@/utils/logging';
import { createNamespacedLogger } from '@/utils/logging';
```

### Phase 2: Replace Console.log

```typescript
// Old
console.log('User action:', action);
console.error('Error occurred:', error);

// New
logger.info('User action', { action });
logger.error('Error occurred', error);
```

### Phase 3: Add Namespacing

```typescript
// Instead of global logger
import logger from '@/utils/logging';

// Use namespaced logger
const logger = createLogger('MyModule');
```

## Best Practices

### 1. Use Appropriate Log Levels

```typescript
// DEBUG - Detailed information for debugging
logger.debug('Render cycle', { props, state });

// INFO - General information
logger.info('User logged in', { userId });

// WARN - Warning but not error
logger.warn('Using deprecated API');

// ERROR - Actual errors
logger.error('Failed to save', error);
```

### 2. Include Relevant Context

```typescript
// Bad
logger.error('Save failed');

// Good
logger.error('Failed to save user profile', error, {
  userId: user.id,
  operation: 'updateProfile',
  fields: Object.keys(updates)
});
```

### 3. Use Consistent Namespacing

```typescript
// Pattern: category:subcategory:specific
'components:segmentation:canvas'
'services:auth'
'hooks:usePolygonEditor'
'api:images'
```

### 4. Avoid Logging Sensitive Data

```typescript
// Bad
logger.info('Login attempt', { email, password });

// Good
logger.info('Login attempt', { email });
```

### 5. Use Child Loggers for Context

```typescript
class ImageProcessor {
  private logger = createLogger('ImageProcessor');
  
  async processImages(images: Image[]) {
    const batchLogger = this.logger.child(`batch-${Date.now()}`);
    
    for (const image of images) {
      const imageLogger = batchLogger.child(image.id);
      imageLogger.info('Processing started');
      // Process...
      imageLogger.info('Processing completed');
    }
  }
}
```

## Server Log Shipping

Logs are automatically shipped to the server in production:

```typescript
POST /api/logs
{
  logs: [{
    timestamp: "2024-01-01T12:00:00.000Z",
    level: 1, // INFO
    namespace: "auth:login",
    message: "Login successful",
    data: { userId: "123" },
    context: {
      userAgent: "Mozilla/5.0...",
      url: "https://app.com/login"
    }
  }]
}
```

## Benefits Achieved

1. **Consistency**: Single logging API across the app
2. **Debugging**: Namespace identification for log sources
3. **Production Monitoring**: Server-side log aggregation
4. **Performance**: Batched log shipping
5. **Flexibility**: Configurable log levels and outputs

## Future Improvements

1. **Log Persistence**: Store logs in IndexedDB
2. **Log Search**: Client-side log search interface
3. **Performance Metrics**: Automatic performance logging
4. **Error Integration**: Link with error handling system
5. **Analytics**: Log-based user behavior analytics