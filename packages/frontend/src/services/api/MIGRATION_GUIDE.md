# API Client Migration Guide

## Overview

This guide helps consolidate multiple API client implementations into a single unified client.

## Current State

We have 3 API client implementations:
1. `/lib/apiClient.ts` - Legacy Axios-based client (478 lines)
2. `/lib/apiClient.enhanced.ts` - Enhanced Axios client with structured errors (288 lines)
3. `/services/api/client.ts` - Modern unified Fetch-based client (851 lines) ✅ **RECOMMENDED**

## Migration Steps

### 1. Update Imports

Replace all legacy imports:

```typescript
// OLD - Legacy Axios client
import apiClient from '@/lib/apiClient';

// OLD - Enhanced Axios client  
import apiClient from '@/lib/apiClient.enhanced';

// NEW - Unified client
import { apiClient } from '@/services/api/client';
```

### 2. Update API Calls

The unified client has a similar interface but returns a different response structure:

```typescript
// OLD - Axios response
const response = await apiClient.get('/users');
const users = response.data; // Direct data access

// NEW - Unified response
const response = await apiClient.get('/users');
const users = response.data; // Same, but wrapped in ApiResponse type
```

### 3. Error Handling

The unified client has built-in error handling:

```typescript
// OLD - Manual error handling
try {
  const response = await apiClient.get('/users');
} catch (error) {
  if (error.response?.status === 404) {
    // Handle 404
  }
}

// NEW - Structured error handling
try {
  const response = await apiClient.get('/users');
} catch (error) {
  // error is ApiError type with proper structure
  if (error.status === 404) {
    console.error(error.message); // User-friendly message
  }
}
```

### 4. File Uploads

The unified client has a dedicated upload method:

```typescript
// OLD
const formData = new FormData();
formData.append('file', file);
await apiClient.post('/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});

// NEW - Cleaner upload API
await apiClient.upload('/upload', file, {
  onUploadProgress: (progress) => console.log(progress)
});
```

### 5. Request Cancellation

The unified client supports request cancellation:

```typescript
// Create abort controller
const controller = new AbortController();

// Make request with cancel token
apiClient.get('/users', { cancelToken: controller });

// Cancel request
controller.abort();
```

### 6. Configuration Options

The unified client supports additional options:

```typescript
apiClient.get('/users', {
  skipAuth: true,           // Skip authentication
  showErrorToast: false,    // Disable error toasts
  retryCount: 3,           // Retry failed requests
  timeout: 30000,          // Custom timeout
  deduplicate: true,       // Deduplicate GET requests
});
```

## Benefits of Unified Client

1. **Built-in Features**:
   - Request deduplication
   - Automatic retries with exponential backoff
   - Upload progress tracking
   - Request cancellation
   - Network state detection

2. **Better Error Handling**:
   - Structured error responses
   - User-friendly error messages
   - Automatic auth token refresh
   - Permission error handling

3. **Performance**:
   - Native Fetch API (no Axios overhead)
   - Request deduplication prevents duplicate calls
   - Automatic cache busting for GET requests

4. **Type Safety**:
   - Full TypeScript support
   - Proper response and error types
   - Better IntelliSense

## Migration Checklist

- [ ] Update all imports from `/lib/apiClient` to `/services/api/client`
- [ ] Update error handling to use structured ApiError type
- [ ] Replace FormData uploads with `apiClient.upload()`
- [ ] Remove manual auth token handling (it's automatic now)
- [ ] Test all API calls after migration
- [ ] Delete legacy client files after successful migration