# Structured Error Handling Migration Guide

This guide helps you migrate from the current error handling to the new structured error handling system.

## Overview

The new structured error handling system provides:
- Consistent error codes across frontend and backend
- Better error tracking and debugging
- Automatic retry logic for transient errors
- User-friendly error messages with i18n support
- Request correlation with unique IDs

## Backend Migration

### 1. Update Error Imports

Replace old error imports:

```typescript
// Old
import { ApiError, BadRequestError, NotFoundError } from '../utils/errors';

// New
import { ApiError } from '../utils/ApiError.enhanced';
```

### 2. Update Error Throwing

Replace generic error throwing with structured errors:

```typescript
// Old
throw new BadRequestError('Invalid input');
throw new NotFoundError('User not found');
throw new Error('Something went wrong');

// New
throw ApiError.validationError('Invalid input');
throw ApiError.resourceNotFound('User', userId);
throw ApiError.internalError('Something went wrong');
```

### 3. Common Error Patterns

#### Authentication Errors
```typescript
// Invalid credentials
throw ApiError.invalidCredentials({ userId: attemptedEmail });

// Token expired
throw ApiError.tokenExpired({ userId });

// Account disabled
throw ApiError.accountDisabled({ userId });
```

#### Validation Errors
```typescript
// Required field
throw ApiError.requiredField('email');

// Invalid format
throw ApiError.invalidFormat('email', 'email address');

// Duplicate value
throw ApiError.duplicateValue('email', email);
```

#### Resource Errors
```typescript
// Not found
throw ApiError.resourceNotFound('Project', projectId);

// Already exists
throw ApiError.resourceAlreadyExists('Project');
```

#### Permission Errors
```typescript
// Permission denied
throw ApiError.permissionDenied('delete', 'project');

// Insufficient role
throw ApiError.insufficientRole('admin');
```

### 4. Update Error Handler Middleware

Update your server setup:

```typescript
// Old
import { errorHandler } from './middleware/errorHandler';

// New
import { 
  errorHandler, 
  requestIdMiddleware,
  notFoundHandler,
  setupGlobalErrorHandlers 
} from './middleware/errorHandler.enhanced';

// Add request ID middleware early in the chain
app.use(requestIdMiddleware);

// ... other middleware ...

// Error handlers at the end
app.use(notFoundHandler);
app.use(errorHandler);

// Setup global handlers
setupGlobalErrorHandlers();
```

### 5. Service Layer Updates

Update service methods to use structured errors:

```typescript
// Old
async function getUser(id: string) {
  const user = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  return user;
}

// New
async function getUser(id: string, context?: { requestId?: string }) {
  try {
    const user = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    if (!user) {
      throw ApiError.resourceNotFound('User', id, context);
    }
    return user;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.databaseError('Failed to fetch user', error as Error, context);
  }
}
```

## Frontend Migration

### 1. Update API Client

Replace the old API client:

```typescript
// Old
import apiClient from '@/lib/apiClient';

// New
import apiClient from '@/lib/apiClient.enhanced';
```

### 2. Update Error Handling in Components

```typescript
// Old
try {
  const data = await apiService.getData();
} catch (error) {
  console.error(error);
  toast.error('An error occurred');
}

// New
import { isErrorCode, getErrorMessage, ERROR_CODES } from '@/utils/error/structuredErrors';

try {
  const data = await apiService.getData();
} catch (error) {
  // Specific error handling
  if (isErrorCode(error, ERROR_CODES.RESOURCE_NOT_FOUND)) {
    // Handle not found
    router.push('/404');
  } else if (isErrorCode(error, ERROR_CODES.PERMISSION_DENIED)) {
    // Handle permission denied
    router.push('/unauthorized');
  }
  
  // Error message is automatically shown by the API client
  // But you can also get it manually:
  const { message, i18nKey } = getErrorMessage(error?.error?.code);
  // Use i18nKey with your i18n library
}
```

### 3. Form Validation Errors

Extract and display validation errors:

```typescript
import { getValidationErrors } from '@/utils/error/structuredErrors';

try {
  await authService.signUp(formData);
} catch (error) {
  const validationErrors = getValidationErrors(error);
  
  // Update form errors
  Object.entries(validationErrors).forEach(([field, message]) => {
    setFieldError(field, message);
  });
}
```

### 4. Network Error Handling

Handle network errors gracefully:

```typescript
import { isNetworkError, ERROR_CODES } from '@/utils/error/structuredErrors';

try {
  const data = await apiService.getData();
} catch (error) {
  if (isNetworkError(error)) {
    // Show offline UI
    setIsOffline(true);
    
    // Retry when back online
    window.addEventListener('online', retryRequest);
  }
}
```

## Testing

### 1. Update Test Mocks

```typescript
// Mock specific errors
import { ApiError } from '@/utils/ApiError.enhanced';

// In tests
mockApiService.getUser.mockRejectedValue(
  ApiError.resourceNotFound('User', '123')
);

// Test error handling
await expect(service.getUser('123')).rejects.toMatchObject({
  code: 'RES_3001',
  statusCode: 404,
});
```

### 2. Test Error Scenarios

```typescript
describe('Error Handling', () => {
  it('should handle validation errors', async () => {
    const error = ApiError.validationError('Invalid input', [
      { field: 'email', constraint: 'email', message: 'Invalid email' }
    ]);
    
    mockApi.post.mockRejectedValue(error.toResponse());
    
    const { getByText } = render(<MyForm />);
    fireEvent.click(getByText('Submit'));
    
    await waitFor(() => {
      expect(getByText('Invalid email')).toBeInTheDocument();
    });
  });
});
```

## Migration Checklist

### Backend
- [ ] Install uuid package: `npm install uuid`
- [ ] Copy new error handling files to your project
- [ ] Update server middleware setup
- [ ] Update all `throw new Error()` statements
- [ ] Update service methods with error context
- [ ] Test error responses with Postman/curl
- [ ] Update API documentation with error codes

### Frontend
- [ ] Copy structured error utilities
- [ ] Update API client to enhanced version
- [ ] Update error handling in components
- [ ] Update form validation error handling
- [ ] Add network error recovery
- [ ] Update i18n translations for error messages
- [ ] Test error scenarios in UI

### Monitoring
- [ ] Update error tracking service integration
- [ ] Set up alerts for critical error codes
- [ ] Create dashboards for error metrics
- [ ] Document error code meanings for support team

## Gradual Migration

You can migrate gradually by:

1. Start with new features using the new system
2. Update critical paths (auth, payments) first
3. Migrate one service/module at a time
4. Keep the old error classes temporarily for compatibility

## Benefits After Migration

1. **Better Debugging**: Request IDs correlate frontend and backend errors
2. **Consistent UX**: Users see appropriate error messages
3. **Automatic Retries**: Transient errors are handled automatically
4. **Error Tracking**: Structured codes make monitoring easier
5. **Internationalization**: Error messages support multiple languages
6. **Type Safety**: TypeScript ensures correct error usage

## Support

For questions about the migration:
1. Check the error code documentation
2. Review the example implementations
3. Ask in the team chat
4. Create an issue for migration problems