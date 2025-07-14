# Image Processing Consolidation Migration Guide

This guide helps you migrate from the various image processing utilities scattered across the codebase to the new unified image processing module.

## Overview

The new unified image processing module consolidates all image manipulation functionality into a single, cohesive system with consistent APIs for both frontend and backend.

### Benefits
- **Consistent API**: Same concepts and patterns across frontend and backend
- **Type Safety**: Full TypeScript support with shared types
- **Performance**: Optimized processing with caching and queuing
- **Flexibility**: Support for all common image operations
- **Extensibility**: Easy to add new features without duplication

## Migration Steps

### Frontend Migration

#### Old Implementation Locations
- `packages/frontend/src/utils/clientSidePreview.ts`
- `packages/frontend/src/utils/tiffPreview.ts`
- `packages/frontend/src/services/unifiedImageProcessingService.ts`
- `packages/frontend/src/utils/imageLoader.ts`

#### New Implementation
```typescript
// Instead of:
import { generateClientSidePreview } from '@/utils/clientSidePreview';
import { getTiffPreview } from '@/utils/tiffPreview';
import unifiedImageProcessingService from '@/services/unifiedImageProcessingService';

// Use:
import imageProcessingService from '@/services/imageProcessing.service';
```

#### Common Migration Patterns

**1. Generating Thumbnails**
```typescript
// Old way
const preview = await generateClientSidePreview(file, 300, 300);

// New way
const result = await imageProcessingService.generateThumbnail(file, 'medium');
// or with custom size
const result = await imageProcessingService.generateThumbnail(file, {
  width: 300,
  height: 300,
  quality: 85
});
```

**2. Creating Previews for Unsupported Formats**
```typescript
// Old way
const preview = file.type === 'image/tiff' 
  ? await getTiffPreview(file)
  : await generateClientSidePreview(file);

// New way
const preview = await imageProcessingService.createPreview(file);
```

**3. Processing Images**
```typescript
// Old way
const processed = await unifiedImageProcessingService.processImage({
  source: file,
  maxWidth: 1920,
  maxHeight: 1080,
  format: 'webp',
  quality: 85
});

// New way
const result = await imageProcessingService.transform(file, {
  resize: { width: 1920, height: 1080, fit: 'inside' },
  format: 'webp',
  quality: 85
});
```

**4. Optimizing for Upload**
```typescript
// Old way
// Custom implementation in each component

// New way
const { file: optimizedFile, wasOptimized, savings } = 
  await imageProcessingService.optimizeForUpload(file, 10); // 10MB max
```

### Backend Migration

#### Old Implementation Locations
- `packages/backend/src/utils/imageUtils.unified.ts`
- `packages/backend/src/utils/imageOptimizer.ts`
- `packages/backend/src/services/imageProcessingService.ts`
- `packages/backend/src/services/imageProcessingQueue.ts`

#### New Implementation
```typescript
// Instead of:
import { processImage } from '@/utils/imageUtils.unified';
import imageOptimizer from '@/utils/imageOptimizer';
import { ImageProcessingService } from '@/services/imageProcessingService';

// Use:
import imageProcessingService from '@/services/imageProcessing.service';
```

#### Common Migration Patterns

**1. Processing Uploaded Images**
```typescript
// Old way
const metadata = await sharp(inputPath).metadata();
const thumbnails = await generateThumbnails(inputPath);
const optimized = await imageOptimizer.optimize(inputPath);

// New way
const result = await imageProcessingService.processUpload(inputPath, {
  generateThumbnails: true,
  optimize: true,
  validate: true
});
```

**2. Generating Thumbnails**
```typescript
// Old way
const sizes = ['small', 'medium', 'large'];
const thumbnails = {};
for (const size of sizes) {
  const output = await sharp(input)
    .resize(SIZES[size])
    .jpeg({ quality: 75 })
    .toFile(outputPath);
  thumbnails[size] = outputPath;
}

// New way
const thumbnails = await imageProcessingService.generateAllThumbnails(inputPath);
```

**3. Converting Formats**
```typescript
// Old way
await sharp(inputPath)
  .toFormat('jpeg')
  .toFile(outputPath);

// New way
const outputPath = await imageProcessingService.convertFormat(
  inputPath, 
  'jpeg', 
  undefined, // auto-generate output path
  90 // quality
);
```

**4. Batch Processing**
```typescript
// Old way
// Custom queue implementation

// New way
await imageProcessingService.batchProcessImages([
  { inputPath: 'img1.png', outputPath: 'img1.jpg', options: { format: 'jpeg' } },
  { inputPath: 'img2.png', outputPath: 'img2.jpg', options: { format: 'jpeg' } }
], (processed, total) => {
  console.log(`Progress: ${processed}/${total}`);
});
```

## API Reference

### Frontend Service API

```typescript
interface ImageProcessingService {
  // Generate thumbnail
  generateThumbnail(source: ImageSource, size: string | ThumbnailOptions): Promise<Result>;
  
  // Generate all standard thumbnails
  generateAllThumbnails(source: ImageSource): Promise<Record<string, Result>>;
  
  // Optimize for upload
  optimizeForUpload(file: File, maxSizeMB?: number): Promise<OptimizationResult>;
  
  // Create preview
  createPreview(file: File, options?: PreviewOptions): Promise<string>;
  
  // Convert format
  convertFormat(source: ImageSource, format: Format, quality?: number): Promise<Result>;
  
  // Apply transformations
  transform(source: ImageSource, options: ProcessingOptions): Promise<Result>;
  
  // Clear cache
  clearCache(): void;
}
```

### Backend Service API

```typescript
interface ImageProcessingService {
  // Process uploaded image
  processUpload(inputPath: string, options?: ProcessOptions): Promise<ProcessResult>;
  
  // Generate thumbnails
  generateAllThumbnails(inputPath: string): Promise<Record<string, string>>;
  generateSingleThumbnail(inputPath: string, size: Size, outputPath?: string): Promise<string>;
  
  // Optimize image
  optimizeImage(inputPath: string): Promise<string | null>;
  
  // Convert format
  convertFormat(inputPath: string, format: Format, outputPath?: string): Promise<string>;
  
  // Stream process
  streamProcess(inputPath: string, outputPath: string, options: ProcessingOptions): Promise<void>;
  
  // Batch process
  batchProcessImages(tasks: Task[], onProgress?: ProgressCallback): Promise<void>;
  
  // Validate image
  validate(inputPath: string, options?: ValidationOptions): Promise<ValidationResult>;
}
```

## Configuration

### Frontend Configuration
```typescript
imageProcessingService.configure({
  enableCache: true,
  maxConcurrentProcessing: 3,
  defaultQuality: 85,
  autoWebPConversion: true
});
```

### Backend Configuration
```typescript
imageProcessingService.configure({
  uploadDir: './uploads',
  thumbnailDir: './uploads/thumbnails',
  maxFileSize: 50, // MB
  maxDimensions: { width: 8192, height: 8192 },
  allowedFormats: ['jpeg', 'jpg', 'png', 'webp', 'tiff', 'bmp'],
  enableOptimization: true,
  concurrency: 3
});
```

## Environment Variables

```bash
# Backend environment variables
UPLOAD_DIR=./uploads
THUMBNAIL_DIR=./uploads/thumbnails
MAX_FILE_SIZE=50
MAX_IMAGE_WIDTH=8192
MAX_IMAGE_HEIGHT=8192
ENABLE_IMAGE_OPTIMIZATION=true
IMAGE_PROCESSING_CONCURRENCY=3
```

## Testing

The unified module includes comprehensive tests. Update your existing tests to use the new APIs:

```typescript
// Frontend test example
import { imageProcessingService } from '@/services/imageProcessing.service';

describe('Image Processing', () => {
  it('should generate thumbnail', async () => {
    const file = new File(['...'], 'test.jpg', { type: 'image/jpeg' });
    const result = await imageProcessingService.generateThumbnail(file, 'small');
    expect(result.metadata.width).toBe(150);
    expect(result.metadata.height).toBeLessThanOrEqual(150);
  });
});

// Backend test example
import imageProcessingService from '@/services/imageProcessing.service';

describe('Image Processing', () => {
  it('should process upload', async () => {
    const result = await imageProcessingService.processUpload('./test.jpg');
    expect(result.metadata).toBeDefined();
    expect(result.thumbnails).toBeDefined();
  });
});
```

## Gradual Migration Strategy

1. **Phase 1**: Update imports to use new service
2. **Phase 2**: Migrate simple operations (thumbnails, format conversion)
3. **Phase 3**: Migrate complex operations (batch processing, optimization)
4. **Phase 4**: Remove old implementations
5. **Phase 5**: Update tests

## Troubleshooting

### Common Issues

1. **Memory Usage**: The new service includes automatic memory management, but you can tune concurrency:
   ```typescript
   imageProcessingService.configure({ maxConcurrentProcessing: 2 });
   ```

2. **Cache Issues**: Clear cache if you see stale images:
   ```typescript
   imageProcessingService.clearCache();
   ```

3. **Format Support**: Check supported formats:
   ```typescript
   import { SUPPORTED_FORMATS } from '@spheroseg/shared/utils/imageProcessing.unified';
   ```

## Support

For questions or issues with the migration, please:
1. Check the consolidated module source code
2. Review the comprehensive tests for usage examples
3. Contact the development team

## Cleanup Checklist

After migration, remove these files:
- [ ] `packages/frontend/src/utils/clientSidePreview.ts`
- [ ] `packages/frontend/src/utils/tiffPreview.ts`
- [ ] `packages/frontend/src/services/unifiedImageProcessingService.ts`
- [ ] `packages/frontend/src/utils/imageLoader.ts`
- [ ] `packages/backend/src/utils/imageUtils.unified.ts`
- [ ] `packages/backend/src/utils/imageOptimizer.ts`
- [ ] `packages/backend/src/services/imageProcessingService.ts`
- [ ] `packages/backend/src/services/imageProcessingQueue.ts`