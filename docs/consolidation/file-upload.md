# File Upload Consolidation

## Overview

This document details the consolidation of file upload functionality across the application into a unified upload system.

## Problem Statement

The application had multiple file upload implementations:
1. **ImageUploader.tsx** - Main image upload component with dropzone
2. **AvatarUploader.tsx** - Specialized avatar upload with cropping
3. **imageUpload.ts** - API layer with upload functions
4. **FileList.tsx** - Unused file list component
5. **UploaderOptions.tsx** - Unused upload options component

Issues identified:
- Duplicate file validation logic in each component
- Different file size limits (10MB vs 5MB)
- Inconsistent error handling (state vs toasts)
- No shared progress tracking
- Different preview generation approaches
- No centralized upload queue management
- Memory leaks from unreleased object URLs

## Solution

Created a comprehensive unified file upload system with three layers:
1. **UnifiedFileUploadService** - Core service with all upload logic
2. **useUnifiedFileUpload** - Flexible hook for upload functionality
3. **UnifiedFileUploader** - Reusable component with consistent UI

## Architecture

### Service Layer

```
UnifiedFileUploadService
├── Configuration Management
│   ├── Preset configurations (IMAGE, AVATAR, DOCUMENT)
│   ├── Dynamic config updates
│   └── Type-specific settings
├── File Validation
│   ├── Size validation
│   ├── Type validation
│   ├── Dimension validation
│   └── Filename validation
├── Upload Management
│   ├── Single/batch upload
│   ├── Progress tracking
│   ├── Cancel support
│   └── Queue management
├── Preview Generation
│   ├── Standard image preview
│   ├── TIFF/BMP server preview
│   └── Fallback mechanisms
└── Error Handling
    ├── Validation errors
    ├── Network errors
    ├── Local storage fallback
    └── Retry logic
```

### Hook Layer

```
useUnifiedFileUpload
├── State Management
│   ├── File list state
│   ├── Upload progress
│   └── Error tracking
├── Dropzone Integration
│   ├── Drag & drop support
│   ├── File selection
│   └── Auto-validation
├── Upload Control
│   ├── Start/cancel uploads
│   ├── Retry failed uploads
│   └── Clear completed
└── Specialized Hooks
    ├── useImageUpload
    ├── useAvatarUpload
    └── useDocumentUpload
```

### Component Layer

```
UnifiedFileUploader
├── Dropzone UI
│   ├── Drag & drop area
│   ├── File selection button
│   └── Upload instructions
├── File List Display
│   ├── Preview thumbnails
│   ├── Progress bars
│   ├── Status indicators
│   └── File actions
├── Upload Controls
│   ├── Upload/cancel buttons
│   ├── Retry failed button
│   └── Clear all button
└── Specialized Components
    ├── ImageUploader
    ├── AvatarUploader
    └── DocumentUploader
```

## Usage Examples

### Basic File Upload

```typescript
import { useUnifiedFileUpload } from '@/hooks/useUnifiedFileUpload';

function MyUploadComponent() {
  const {
    files,
    isUploading,
    uploadProgress,
    getRootProps,
    getInputProps,
    isDragActive,
    uploadFiles,
  } = useUnifiedFileUpload({
    projectId: 'project123',
    autoUpload: true,
    onUploadComplete: (result) => {
      console.log('Upload complete:', result);
    },
  });

  return (
    <div {...getRootProps()}>
      <input {...getInputProps()} />
      {isDragActive ? (
        <p>Drop files here...</p>
      ) : (
        <p>Drag & drop files here, or click to select</p>
      )}
      {isUploading && <p>Uploading... {uploadProgress}%</p>}
    </div>
  );
}
```

### Using the Component

```typescript
import { ImageUploader } from '@/components/upload/UnifiedFileUploader';

function ProjectUpload({ projectId }) {
  return (
    <ImageUploader
      projectId={projectId}
      autoUpload={false}
      maxFiles={20}
      onUploadComplete={(result) => {
        // Handle upload completion
        console.log(`Uploaded ${result.successful.length} files`);
      }}
      onError={(error) => {
        // Handle errors
        console.error('Upload error:', error);
      }}
    />
  );
}
```

### Custom Configuration

```typescript
import fileUploadService, { UPLOAD_CONFIGS } from '@/services/unifiedFileUploadService';

// Create custom config
const customConfig = {
  ...UPLOAD_CONFIGS.IMAGE,
  maxFileSize: 20 * 1024 * 1024, // 20MB
  acceptedTypes: [...UPLOAD_CONFIGS.IMAGE.acceptedTypes, 'image/svg+xml'],
  batchSize: 10,
};

// Use with hook
const { uploadFiles } = useUnifiedFileUpload({
  config: customConfig,
});
```

### Avatar Upload with Cropping

```typescript
import { AvatarUploader } from '@/components/upload/UnifiedFileUploader';

function ProfileSettings() {
  const [avatarUrl, setAvatarUrl] = useState<string>();

  return (
    <AvatarUploader
      onFileComplete={(file) => {
        if (file.status === 'complete' && file.preview) {
          setAvatarUrl(file.preview);
        }
      }}
      renderDropzone={({ getRootProps, getInputProps, files }) => (
        <div {...getRootProps()} className="avatar-upload">
          <input {...getInputProps()} />
          {files[0]?.preview ? (
            <img src={files[0].preview} alt="Avatar" />
          ) : (
            <div>Click to upload avatar</div>
          )}
        </div>
      )}
    />
  );
}
```

## Features

### File Validation

```typescript
// Comprehensive validation
const validation = await fileUploadService.validateFile(file);
if (!validation.valid) {
  console.error(validation.error);
} else if (validation.warnings) {
  validation.warnings.forEach(w => console.warn(w));
}

// Validation includes:
- File size limits
- MIME type checking
- Extension validation
- Image dimension checks
- Filename sanitization
```

### Progress Tracking

```typescript
const { uploadFiles } = useUnifiedFileUpload({
  onUploadProgress: (progress) => {
    console.log(`${progress.fileName}: ${progress.progress}%`);
    console.log(`Status: ${progress.status}`);
    console.log(`Uploaded: ${progress.uploaded}/${progress.total}`);
  },
});
```

### Upload Queue Management

```typescript
// Get current queue
const queue = fileUploadService.getUploadQueue();

// Cancel specific upload
fileUploadService.cancelUpload(fileId);

// Cancel all uploads
fileUploadService.cancelAllUploads();

// Clear completed uploads
fileUploadService.clearCompleted();
```

### Local Storage Fallback

```typescript
// Automatic fallback when API fails
const result = await fileUploadService.uploadWithFallback(files, {
  projectId: 'project123',
});

// Files are saved locally and can be synced later
```

## Configuration Presets

### IMAGE Preset
```typescript
{
  maxFileSize: 10MB,
  maxFiles: 50,
  acceptedTypes: ['image/jpeg', 'image/png', 'image/tiff', ...],
  batchSize: 20,
  generatePreviews: true
}
```

### AVATAR Preset
```typescript
{
  maxFileSize: 5MB,
  maxFiles: 1,
  acceptedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  batchSize: 1,
  generatePreviews: true
}
```

### DOCUMENT Preset
```typescript
{
  maxFileSize: 50MB,
  maxFiles: 10,
  acceptedTypes: ['application/pdf', 'text/plain', 'application/json'],
  batchSize: 5,
  generatePreviews: false
}
```

## Migration Guide

### From ImageUploader Component

```typescript
// Old
import ImageUploader from '@/components/ImageUploader';

<ImageUploader
  projectId={projectId}
  onUploadComplete={handleComplete}
  maxFiles={20}
  autoSegment={true}
/>

// New
import { ImageUploader } from '@/components/upload/UnifiedFileUploader';

<ImageUploader
  projectId={projectId}
  onUploadComplete={handleComplete}
  config={{ maxFiles: 20, autoSegment: true }}
/>
```

### From AvatarUploader Component

```typescript
// Old
import AvatarUploader from '@/components/settings/AvatarUploader';

<AvatarUploader
  onFileSelect={handleFileSelect}
  onRemove={handleRemove}
/>

// New
import { AvatarUploader } from '@/components/upload/UnifiedFileUploader';

<AvatarUploader
  onFileComplete={handleFileSelect}
  onError={handleError}
/>
```

### From Direct API Usage

```typescript
// Old
import { uploadFiles } from '@/api/imageUpload';

const result = await uploadFiles(files, projectId, onProgress);

// New
import fileUploadService from '@/services/unifiedFileUploadService';

const result = await fileUploadService.uploadFiles(files, {
  projectId,
  onProgress,
});
```

## Benefits Achieved

1. **Code Reduction**: Eliminated ~800+ lines of duplicate code
2. **Consistency**: Same upload behavior everywhere
3. **Better UX**: Unified progress tracking and error handling
4. **Performance**: Efficient batch uploads and preview generation
5. **Reliability**: Automatic retry and fallback mechanisms
6. **Type Safety**: Full TypeScript support
7. **Memory Management**: Proper cleanup of object URLs

## Best Practices

### 1. Use Appropriate Presets

```typescript
// For images in projects
useImageUpload({ projectId });

// For user avatars
useAvatarUpload({ onFileComplete });

// For documents
useDocumentUpload({ maxFiles: 5 });
```

### 2. Handle Validation Warnings

```typescript
const { files } = useUnifiedFileUpload({
  onFilesSelected: (selectedFiles) => {
    // Check for validation warnings
    files.forEach(file => {
      if (file.error) {
        console.error(`${file.name}: ${file.error}`);
      }
    });
  },
});
```

### 3. Implement Progress Feedback

```typescript
<UnifiedFileUploader
  onUploadProgress={(progress) => {
    updateProgressBar(progress.progress);
  }}
  renderFileItem={(file) => (
    <CustomFileItem file={file} />
  )}
/>
```

### 4. Clean Up Resources

```typescript
useEffect(() => {
  return () => {
    // Component automatically handles cleanup
    // but you can do additional cleanup here
  };
}, []);
```

## Future Improvements

1. **Chunked Uploads**
   - Split large files into chunks
   - Resume interrupted uploads
   - Parallel chunk uploading

2. **Image Processing**
   - Client-side image resizing
   - Format conversion
   - EXIF data handling

3. **Advanced Previews**
   - Video thumbnails
   - PDF preview pages
   - 3D model previews

4. **Cloud Integration**
   - Direct upload to S3/GCS
   - Signed URL generation
   - Multipart uploads

5. **Accessibility**
   - Screen reader support
   - Keyboard navigation
   - ARIA attributes