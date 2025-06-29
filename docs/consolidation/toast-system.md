# Toast System Consolidation

## Overview

The toast system consolidation provides a unified, feature-rich notification system for the SpherosegV4 application. It extends the Sonner library with additional features like i18n support, loading states, progress indicators, and more.

## Problem Statement

Previously, the toast implementation was fragmented:
- Direct usage of `sonner` toast in 98+ files
- Basic wrapper functions in `toastUtils.ts`
- No i18n support for toast messages
- No centralized configuration
- Limited features (no progress, confirmation, etc.)
- Inconsistent usage patterns

## Solution Architecture

### Core Components

1. **Toast Service** (`/packages/frontend/src/services/toastService.ts`)
   - Singleton service with enhanced features
   - Support for all toast types: success, error, info, warning, loading
   - Advanced features: progress, confirmation, multi-line, custom
   - Centralized configuration
   - Active toast tracking

2. **useToast Hook** (`/packages/frontend/src/hooks/useToast.ts`)
   - React hook with i18n support
   - Automatic translation of messages
   - Loading state management
   - All service features exposed

3. **Toast Provider** (`/packages/frontend/src/components/providers/ToastProvider.tsx`)
   - Theme-aware Toaster configuration
   - Responsive design
   - Custom styling
   - Accessibility features

4. **Migration Script** (`/packages/frontend/src/utils/migrate-toasts.ts`)
   - Automated migration from old implementations
   - Component vs service detection
   - Import updates

## Key Features

### 1. Basic Toast Types

```typescript
const toast = useToast();

// Basic notifications
toast.success('Operation completed successfully');
toast.error('An error occurred');
toast.info('Here is some information');
toast.warning('Be careful!');
```

### 2. Loading States

```typescript
// Start loading
const loadingId = toast.loading('Processing...');

// Update to success
toast.loadingSuccess(loadingId, 'Processing completed!');

// Or update to error
toast.loadingError(loadingId, 'Processing failed');
```

### 3. Promise-Based Toasts

```typescript
toast.promise(
  fetchData(),
  {
    loading: 'Fetching data...',
    success: 'Data loaded successfully',
    error: (err) => `Error: ${err.message}`,
  }
);
```

### 4. Confirmation Dialogs

```typescript
toast.confirm(
  'Are you sure you want to delete this item?',
  () => {
    // Handle confirmation
    deleteItem();
  },
  () => {
    // Handle cancellation (optional)
  }
);
```

### 5. Progress Indicators

```typescript
// Show progress
const progressId = toast.progress('Uploading file...', 0);

// Update progress
toast.progress('Uploading file...', 45);
toast.progress('Uploading file...', 100);

// Dismiss when done
toast.dismiss(progressId);
```

### 6. Multi-line Toasts

```typescript
toast.multiline(
  'Operation Failed',
  'The file could not be uploaded due to network issues.',
  'error'
);
```

### 7. Utility Functions

```typescript
// Copy to clipboard with notification
toast.copyToClipboard('Text to copy');

// Network error with retry action
toast.networkError();

// Validation errors
toast.validationError([
  'Email is required',
  'Password must be at least 8 characters',
]);
```

### 8. i18n Support

```typescript
// Automatically translates if key is provided
toast.success('projects.messages.created'); // Shows translated message

// Works with placeholders
toast.error('errors.messages.notFound', {
  description: t('errors.descriptions.pageNotFound'),
});
```

## Configuration

### Toast Provider Setup

```tsx
// In App.tsx or main layout
import { ToastProvider } from '@/components/providers/ToastProvider';

function App() {
  return (
    <ToastProvider>
      {/* Your app content */}
    </ToastProvider>
  );
}
```

### Global Configuration

```typescript
// Configure default options
toastService.configure({
  position: 'top-center',
  duration: 4000,
  dismissible: true,
});
```

### Theme Integration

The toast system automatically adapts to the current theme:
- Light/dark mode support
- Custom color variants for success, error, warning, info
- Consistent styling with the application design system

## Usage Examples

### In React Components

```typescript
import { useToast } from '@/hooks/useToast';

function MyComponent() {
  const toast = useToast();
  
  const handleSave = async () => {
    const id = toast.loading('Saving...');
    
    try {
      await saveData();
      toast.loadingSuccess(id, 'Saved successfully!');
    } catch (error) {
      toast.loadingError(id, 'Failed to save');
    }
  };
  
  return <button onClick={handleSave}>Save</button>;
}
```

### In Service Files

```typescript
import toastService from '@/services/toastService';

class DataService {
  async fetchData() {
    try {
      const data = await api.get('/data');
      toastService.success('Data loaded');
      return data;
    } catch (error) {
      toastService.error('Failed to load data');
      throw error;
    }
  }
}
```

### Error Handling Integration

```typescript
import { useToast } from '@/hooks/useToast';

function useErrorHandler() {
  const toast = useToast();
  
  const handleError = (error: Error) => {
    if (error.name === 'NetworkError') {
      toast.networkError();
    } else if (error.name === 'ValidationError') {
      toast.validationError(error.validationErrors);
    } else {
      toast.error(error.message || 'An unexpected error occurred');
    }
  };
  
  return { handleError };
}
```

### Form Validation

```typescript
const toast = useToast();

const validateForm = (values: FormValues) => {
  const errors = [];
  
  if (!values.email) errors.push('Email is required');
  if (!values.password) errors.push('Password is required');
  
  if (errors.length > 0) {
    toast.validationError(errors);
    return false;
  }
  
  return true;
};
```

## Migration Guide

### 1. Automated Migration

Run the migration script:
```bash
npm run migrate:toasts
# or
node src/utils/migrate-toasts.ts src
```

### 2. Manual Updates

#### Before:
```typescript
import { toast } from 'sonner';

function handleClick() {
  toast.success('Success!');
}
```

#### After (in components):
```typescript
import { useToast } from '@/hooks/useToast';

function MyComponent() {
  const toast = useToast();
  
  function handleClick() {
    toast.success('Success!');
  }
}
```

#### After (in services):
```typescript
import toastService from '@/services/toastService';

function handleData() {
  toastService.success('Success!');
}
```

### 3. Update Main App

Replace direct Toaster with ToastProvider:

```tsx
// Before
import { Toaster } from 'sonner';

<Toaster position="bottom-right" />

// After
import { ToastProvider } from '@/components/providers/ToastProvider';

<ToastProvider />
```

## Best Practices

1. **Use Translation Keys**: Prefer translation keys over hardcoded messages
   ```typescript
   // Good
   toast.success('projects.messages.created');
   
   // Acceptable for dynamic messages
   toast.error(`Failed to delete ${fileName}`);
   ```

2. **Handle Loading States**: Always update loading toasts
   ```typescript
   const id = toast.loading('Processing...');
   try {
     await process();
     toast.loadingSuccess(id, 'Done!');
   } catch {
     toast.loadingError(id, 'Failed');
   }
   ```

3. **Provide Context**: Use descriptions for complex errors
   ```typescript
   toast.multiline(
     'Upload Failed',
     'The file size exceeds the 10MB limit.',
     'error'
   );
   ```

4. **Use Appropriate Durations**:
   - Success: 3 seconds
   - Error: 5 seconds
   - Info: 4 seconds
   - Warning: 4.5 seconds
   - Loading: Infinite (until updated)

5. **Actionable Errors**: Provide actions for recoverable errors
   ```typescript
   toast.error('Network connection lost', {
     action: {
       label: 'Retry',
       onClick: () => window.location.reload(),
     },
   });
   ```

## Benefits Achieved

1. **Unified API**: Single consistent interface for all notifications
2. **Enhanced Features**: Progress, confirmations, multi-line, etc.
3. **i18n Support**: Automatic translation of toast messages
4. **Better UX**: Loading states, actions, rich content
5. **Type Safety**: Full TypeScript support
6. **Accessibility**: Keyboard navigation, screen reader support
7. **Theme Integration**: Automatic theme adaptation
8. **Performance**: Efficient rendering and animations

## Future Enhancements

1. **Toast Queue Management**: Priority-based toast queue
2. **Persistence**: Save important notifications
3. **Sound Effects**: Optional audio feedback
4. **Toast History**: View previous notifications
5. **Advanced Animations**: Custom enter/exit animations
6. **A/B Testing**: Test different notification styles
7. **Analytics Integration**: Track notification interactions
8. **Server-Sent Toasts**: Push notifications from backend