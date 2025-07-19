# Unified Upload Service Migration Guide

This guide helps migrate existing upload implementations to the new unified upload service.

## Overview

The unified upload service provides:
- **Strategy Pattern**: Different strategies for various file types
- **Chunked Uploads**: Automatic chunking for large files (>10MB)
- **Resumable Uploads**: Resume interrupted uploads
- **Progress Tracking**: Detailed progress with chunk-level updates
- **Retry Logic**: Automatic retry with exponential backoff
- **Queue Management**: Priority-based upload queue
- **React Hooks**: Easy integration with React components

## Architecture

```
packages/shared/src/services/upload/
├── UnifiedUploadService.ts  # Core service implementation
├── strategies.ts            # Upload strategies (standard, chunked, image, etc.)
├── types.ts                 # TypeScript type definitions
├── hooks.ts                 # React hooks for easy integration
└── index.ts                 # Main export file
```

## Migration Examples

### 1. Migrating ImageUploader Component

**Before:**
```typescript
// Using custom upload logic
const handleUploadClick = async () => {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));
  
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });
  
  // Handle response...
};
```

**After:**
```typescript
import { useImageUpload } from '@spheroseg/shared/services/upload';

const ImageUploader = ({ projectId, onUploadComplete }) => {
  const {
    files,
    isUploading,
    uploadProgress,
    selectFiles,
    uploadFiles,
    removeFile,
    getRootProps,
    getInputProps,
    isDragActive,
  } = useImageUpload({
    projectId,
    autoUpload: false,
    generatePreviews: true,
    onUploadComplete: (result) => {
      onUploadComplete(projectId, result.successful);
    },
  });

  return (
    <div>
      <div {...getRootProps()} className="dropzone">
        <input {...getInputProps()} />
        {isDragActive ? (
          <p>Drop files here...</p>
        ) : (
          <p>Drag & drop files here, or click to select</p>
        )}
      </div>
      
      {/* File preview list */}
      <div className="file-list">
        {files.map(file => (
          <div key={file.id} className="file-item">
            {file.preview && <img src={file.preview} alt={file.name} />}
            <span>{file.name}</span>
            <span>{file.progress}%</span>
            <button onClick={() => removeFile(file.id)}>Remove</button>
          </div>
        ))}
      </div>
      
      <button onClick={() => uploadFiles()} disabled={isUploading}>
        Upload ({uploadProgress}%)
      </button>
    </div>
  );
};
```

### 2. Migrating AvatarUploader Component

**Before:**
```typescript
// Custom avatar upload logic
const uploadAvatar = async (file: File) => {
  const formData = new FormData();
  formData.append('avatar', file);
  
  const response = await fetch('/api/avatar/upload', {
    method: 'POST',
    body: formData,
  });
  
  // Handle response...
};
```

**After:**
```typescript
import { useAvatarUpload } from '@spheroseg/shared/services/upload';

const AvatarUploader = ({ currentAvatarUrl, onAvatarChange }) => {
  const {
    files,
    isUploading,
    selectFiles,
    uploadFiles,
    clearFiles,
  } = useAvatarUpload({
    autoUpload: true,
    generatePreviews: true,
    onFileComplete: (file) => {
      if (file.status === 'complete' && file.result) {
        onAvatarChange(file.result.url, false);
      }
    },
  });

  const firstFile = files[0];

  return (
    <div className="avatar-uploader">
      <Avatar>
        {firstFile?.preview || currentAvatarUrl ? (
          <AvatarImage src={firstFile?.preview || currentAvatarUrl} />
        ) : (
          <AvatarFallback>
            <UserIcon />
          </AvatarFallback>
        )}
      </Avatar>
      
      <Button onClick={selectFiles} disabled={isUploading}>
        {isUploading ? <Loader2 className="animate-spin" /> : <Camera />}
      </Button>
      
      {currentAvatarUrl && (
        <Button onClick={clearFiles} variant="destructive">
          <X />
        </Button>
      )}
    </div>
  );
};
```

### 3. Using Different Upload Strategies

```typescript
import { uploadService, UPLOAD_PRESETS } from '@spheroseg/shared/services/upload';

// Configure for specific use case
uploadService.setConfig(UPLOAD_PRESETS.IMAGE);

// Or use custom configuration
uploadService.setConfig({
  maxFileSize: 100 * 1024 * 1024, // 100MB
  enableChunking: true,
  chunkSize: 10 * 1024 * 1024, // 10MB chunks
  enableResume: true,
});

// Upload with specific strategy
const result = await uploadService.uploadFile(file, {
  metadata: { type: 'document' }, // Forces document strategy
});
```

### 4. Handling Chunked Uploads

```typescript
const { uploadFiles } = useUpload({
  chunkedUpload: true,
  resumable: true,
  onUploadProgress: (progress, fileId) => {
    console.log(`File ${fileId}: ${progress.progress}%`);
    console.log(`Uploaded: ${progress.loaded} / ${progress.total}`);
  },
  onChunkComplete: (chunkIndex, totalChunks) => {
    console.log(`Chunk ${chunkIndex + 1} of ${totalChunks} complete`);
  },
});
```

### 5. Resuming Interrupted Uploads

```typescript
import { uploadService } from '@spheroseg/shared/services/upload';

// Get resumable uploads
const resumableUploads = uploadService.getResumableUploads();

// Resume a specific upload
if (resumableUploads.length > 0) {
  const uploadToResume = resumableUploads[0];
  await uploadService.resumeUpload(uploadToResume.uploadId);
}

// Or using the hook
const { resumeUpload } = useUpload();
await resumeUpload(uploadId);
```

## API Endpoint Requirements

The unified upload service expects the following API endpoints:

### Standard Upload
- `POST /api/upload` - Standard file upload
- `POST /api/upload/image` - Image-specific upload
- `POST /api/upload/avatar` - Avatar upload
- `POST /api/upload/special-image` - TIFF/BMP conversion

### Chunked Upload
- `POST /api/upload/chunked/init` - Initialize chunked upload
- `POST /api/upload/chunked/chunk` - Upload individual chunk
- `GET /api/upload/chunked/status/:uploadId` - Check upload status
- `POST /api/upload/chunked/complete` - Finalize chunked upload

### Response Format
```typescript
// Success response
{
  id: string;
  url: string;
  thumbnailUrl?: string;
  metadata?: Record<string, unknown>;
}

// Chunked init response
{
  uploadId: string;
  expiresAt: string;
}

// Chunked status response
{
  uploadedChunks: number[];
}
```

## Configuration Options

```typescript
interface FileUploadConfig {
  maxFileSize: number;              // Maximum file size in bytes
  maxFiles: number;                 // Maximum number of files
  acceptedTypes: string[];          // MIME types to accept
  acceptedExtensions: string[];     // File extensions to accept
  batchSize: number;                // Files to upload simultaneously
  generatePreviews: boolean;        // Generate image previews
  autoSegment: boolean;             // Auto-segment after upload (images)
  projectId?: string;               // Default project ID
  chunkSize?: number;               // Size of each chunk
  enableChunking?: boolean;         // Enable chunked uploads
  enableResume?: boolean;           // Enable resumable uploads
}
```

## Benefits of Migration

1. **Consistent API**: Single service for all upload needs
2. **Better Performance**: Chunked uploads for large files
3. **Reliability**: Automatic retry and resume support
4. **Progress Tracking**: Detailed progress information
5. **Type Safety**: Full TypeScript support
6. **Reduced Code**: ~50% less upload-related code
7. **Maintainability**: Centralized upload logic

## Testing

```typescript
import { UnifiedUploadService } from '@spheroseg/shared/services/upload';

describe('Upload Service', () => {
  let service: UnifiedUploadService;
  
  beforeEach(() => {
    service = new UnifiedUploadService({
      maxFileSize: 10 * 1024 * 1024,
      enableChunking: true,
    });
  });
  
  it('should upload file successfully', async () => {
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    const result = await service.uploadFile(file);
    
    expect(result.status).toBe('complete');
    expect(result.result).toBeDefined();
  });
  
  it('should handle chunked upload for large files', async () => {
    const largeFile = new File(
      [new ArrayBuffer(20 * 1024 * 1024)], 
      'large.bin'
    );
    
    const result = await service.uploadFile(largeFile);
    expect(result.status).toBe('complete');
  });
});
```

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure API endpoints allow the frontend origin
2. **Large Files Timeout**: Enable chunked uploads for files >10MB
3. **Preview Generation Fails**: Check browser support for file type
4. **Upload Stuck**: Check network tab for failed requests

### Debug Mode

```typescript
// Enable debug logging
import { createLogger } from '@/utils/logging/unifiedLogger';
const logger = createLogger('UnifiedUploadService');
logger.setLevel('debug');
```

## Next Steps

1. Update API endpoints to support chunked uploads
2. Migrate all upload components to use the unified service
3. Remove old upload implementations
4. Add E2E tests for upload scenarios
5. Monitor upload success rates and performance