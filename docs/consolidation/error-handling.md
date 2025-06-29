# Error Handling Consolidation

## Overview

This document details the unification of three separate error handling systems into a single, comprehensive error handling solution.

## Problem Statement

The application had three different error handling implementations:
1. **errorHandling.ts** - Base error classes and handlers
2. **enhancedErrorHandling.ts** - Network-specific error handling
3. **errorUtils.ts** - Simple error utilities

This led to:
- Inconsistent error handling patterns
- Duplicate error type definitions
- Different approaches to error display
- Confusion about which system to use

## Solution

Created a unified error handling system at `/utils/error/unifiedErrorHandler.ts` that combines the best features from all three systems.

## Architecture

### Error Type Hierarchy

```typescript
enum ErrorType {
  NETWORK = 'NETWORK',
  API = 'API',
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  SERVER = 'SERVER',
  CLIENT = 'CLIENT',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN',
}

enum ErrorSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}
```

### Error Classes

```typescript
// Base error class
class AppError extends Error {
  type: ErrorType;
  severity: ErrorSeverity;
  code?: string;
  details?: any;
  statusCode?: number;
  timestamp: string;
}

// Specific error classes
class NetworkError extends AppError
class ApiError extends AppError
class ValidationError extends AppError
class AuthenticationError extends AppError
class AuthorizationError extends AppError
class NotFoundError extends AppError
class ServerError extends AppError
class TimeoutError extends AppError
```

## Key Features

### 1. Unified Error Handler
```typescript
function handleError(error: unknown, options?: {
  showToast?: boolean;
  logError?: boolean;
  context?: Record<string, any>;
  customMessage?: string;
}): ErrorInfo
```

### 2. Automatic Error Classification
- Detects error type from axios errors
- Maps HTTP status codes to error types
- Determines severity automatically

### 3. Toast Deduplication
- Prevents duplicate error toasts
- Tracks active toasts by key
- Auto-cleanup after display

### 4. Structured Logging
- Logs based on severity level
- Includes stack traces
- Adds context information

### 5. Utility Functions
```typescript
// Safe async wrapper
safeAsync<T>(fn: () => Promise<T>): Promise<{ data?: T; error?: ErrorInfo }>

// Try-catch wrapper
tryCatch<T>(fn: () => Promise<T>, defaultValue?: T): Promise<T | undefined>

// Type checking
isErrorType(error: unknown, type: ErrorType): boolean
isAuthError(error: unknown): boolean
```

## Migration Strategy

### Phase 1: Compatibility Layer
Created re-exports in legacy files to maintain backward compatibility:
```typescript
// errorHandling.ts
export * from './error/unifiedErrorHandler';

// enhancedErrorHandling.ts
export * from './error/unifiedErrorHandler';
export { safeAsync, handleError as handleApiError } from './error/unifiedErrorHandler';

// errorUtils.ts
export { tryCatch, getErrorMessage as formatError } from './error/unifiedErrorHandler';
```

### Phase 2: Gradual Migration
Update imports in new code:
```typescript
// Old
import { handleError } from '@/utils/errorHandling';

// New
import { handleError } from '@/utils/error';
```

## Usage Examples

### Basic Error Handling
```typescript
try {
  await someAsyncOperation();
} catch (error) {
  handleError(error, {
    context: { operation: 'someAsyncOperation' }
  });
}
```

### Using Safe Async
```typescript
const { data, error } = await safeAsync(async () => {
  return await apiClient.get('/users');
});

if (error) {
  // Error already handled and logged
  return;
}

// Use data safely
```

### Custom Error Messages
```typescript
handleError(error, {
  customMessage: 'Failed to load user profile',
  showToast: true,
  context: { userId: user.id }
});
```

### Creating Specific Errors
```typescript
throw new ValidationError('Invalid email format', {
  field: 'email',
  value: email
});

throw new AuthenticationError('Session expired');

throw new NetworkError('Connection timeout', 'TIMEOUT', {
  url: '/api/users',
  timeout: 5000
});
```

## Benefits Achieved

1. **Consistency**: Single error handling pattern across the app
2. **Type Safety**: Full TypeScript support with proper types
3. **Better UX**: Consistent error messages and toast notifications
4. **Debugging**: Structured logging with context
5. **Maintainability**: Single source of truth for error logic

## Best Practices

1. **Always use handleError**: Don't show raw error messages
2. **Add context**: Include relevant information for debugging
3. **Use specific error classes**: When throwing errors manually
4. **Check error types**: Use utility functions for conditional logic
5. **Test error paths**: Ensure errors are handled gracefully

## Common Patterns

### API Error Handling
```typescript
apiClient.interceptors.response.use(
  response => response,
  error => {
    handleError(error, {
      context: {
        url: error.config?.url,
        method: error.config?.method
      }
    });
    return Promise.reject(error);
  }
);
```

### Form Validation
```typescript
const { data, error } = await safeAsync(async () => {
  await schema.parseAsync(formData);
});

if (error && error.type === ErrorType.VALIDATION) {
  // Show validation errors
  const errors = formatValidationErrors(error.details);
}
```

### Authentication Errors
```typescript
if (isAuthError(error)) {
  // Redirect to login
  navigate('/login');
}
```

## Future Improvements

1. **Error Reporting**: Integration with error tracking service
2. **Error Recovery**: Automatic retry mechanisms
3. **Offline Support**: Better handling of offline scenarios
4. **Error Boundaries**: Enhanced React error boundaries
5. **Analytics**: Track error patterns and frequencies