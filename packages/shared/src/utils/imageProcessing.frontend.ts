/**
 * Frontend-specific Image Processing Utilities
 * 
 * Canvas-based image processing for the browser environment.
 * Provides client-side image manipulation without server round-trips.
 */

import {
  ImageDimensions,
  ImageMetadata,
  ProcessingOptions,
  ThumbnailOptions,
  calculateThumbnailDimensions,
  generateImageCacheKey,
  getMimeTypeFromFormat,
} from './imageProcessing.unified';

// Image source types supported by frontend
export type ImageSource = File | Blob | string | HTMLImageElement;

// Canvas processing result
export interface CanvasResult {
  canvas: HTMLCanvasElement;
  blob: Blob;
  dataUrl: string;
  metadata: ImageMetadata;
}

// Processing queue to prevent duplicate operations
class ProcessingQueue {
  private queue = new Map<string, Promise<any>>();

  async process<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.queue.get(key);
    if (existing) {
      return existing;
    }

    const promise = fn().finally(() => {
      this.queue.delete(key);
    });

    this.queue.set(key, promise);
    return promise;
  }
}

const processingQueue = new ProcessingQueue();

// Image caching for processed images
class ImageCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private maxAge = 5 * 60 * 1000; // 5 minutes

  set(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
    this.cleanup();
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > this.maxAge) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

const imageCache = new ImageCache();

/**
 * Load image from various sources
 */
export async function loadImage(source: ImageSource): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));

    if (source instanceof File || source instanceof Blob) {
      const url = URL.createObjectURL(source);
      img.src = url;
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
    } else if (typeof source === 'string') {
      img.src = source;
    } else if (source instanceof HTMLImageElement) {
      resolve(source);
    } else {
      reject(new Error('Invalid image source'));
    }
  });
}

/**
 * Create canvas from image
 */
export function createCanvas(
  width: number,
  height: number
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: true });
  
  if (!ctx) {
    throw new Error('Failed to create canvas context');
  }

  // Enable image smoothing for better quality
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  return { canvas, ctx };
}

/**
 * Extract metadata from image
 */
export async function extractImageMetadata(source: ImageSource): Promise<ImageMetadata> {
  const img = await loadImage(source);
  
  let format = 'unknown';
  let size = 0;
  let mimeType = 'image/unknown';

  if (source instanceof File) {
    format = source.name.split('.').pop()?.toLowerCase() || 'unknown';
    size = source.size;
    mimeType = source.type;
  } else if (source instanceof Blob) {
    mimeType = source.type;
    format = mimeType.split('/')[1] || 'unknown';
    size = source.size;
  }

  return {
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
    format,
    size,
    mimeType,
    hasAlpha: format === 'png' || format === 'webp',
  };
}

/**
 * Process image with canvas
 */
export async function processImageWithCanvas(
  source: ImageSource,
  options: ProcessingOptions
): Promise<CanvasResult> {
  const cacheKey = generateImageCacheKey(
    source instanceof File ? source.name : String(source),
    options
  );

  // Check cache
  const cached = imageCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Process with queue to prevent duplicates
  return processingQueue.process(cacheKey, async () => {
    const img = await loadImage(source);
    const metadata = await extractImageMetadata(source);

    // Calculate dimensions
    let { width, height } = metadata;
    if (options.resize) {
      const resized = calculateThumbnailDimensions(
        { width, height },
        options.resize,
        options.resize.fit || 'inside'
      );
      width = resized.width;
      height = resized.height;
    }

    // Create canvas
    const { canvas, ctx } = createCanvas(width, height);

    // Apply transformations
    ctx.save();

    // Handle rotation
    if (options.rotate) {
      ctx.translate(width / 2, height / 2);
      ctx.rotate((options.rotate * Math.PI) / 180);
      ctx.translate(-width / 2, -height / 2);
    }

    // Handle flip/flop
    if (options.flip || options.flop) {
      ctx.scale(options.flop ? -1 : 1, options.flip ? -1 : 1);
      ctx.translate(
        options.flop ? -width : 0,
        options.flip ? -height : 0
      );
    }

    // Draw image
    if (options.crop) {
      ctx.drawImage(
        img,
        options.crop.left,
        options.crop.top,
        options.crop.width,
        options.crop.height,
        0,
        0,
        width,
        height
      );
    } else {
      ctx.drawImage(img, 0, 0, width, height);
    }

    ctx.restore();

    // Apply filters
    if (options.grayscale || options.blur || options.sharpen) {
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // Grayscale
      if (options.grayscale) {
        for (let i = 0; i < data.length; i += 4) {
          const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          data[i] = gray;
          data[i + 1] = gray;
          data[i + 2] = gray;
        }
      }

      // Simple blur (box blur)
      if (options.blur && options.blur > 0) {
        // This is a simplified blur - for production use, implement proper Gaussian blur
        ctx.filter = `blur(${options.blur}px)`;
        ctx.drawImage(canvas, 0, 0);
      }

      ctx.putImageData(imageData, 0, 0);
    }

    // Convert to blob
    const format = options.format || 'jpeg';
    const quality = (options.quality || 90) / 100;
    const mimeType = getMimeTypeFromFormat(format);

    return new Promise<CanvasResult>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob'));
            return;
          }

          const dataUrl = canvas.toDataURL(mimeType, quality);
          const result: CanvasResult = {
            canvas,
            blob,
            dataUrl,
            metadata: {
              width,
              height,
              format,
              size: blob.size,
              mimeType,
              hasAlpha: format === 'png' || format === 'webp',
            },
          };

          // Cache result
          imageCache.set(cacheKey, result);
          resolve(result);
        },
        mimeType,
        quality
      );
    });
  });
}

/**
 * Generate thumbnail
 */
export async function generateThumbnail(
  source: ImageSource,
  options: ThumbnailOptions
): Promise<CanvasResult> {
  const processingOptions: ProcessingOptions = {
    resize: {
      width: options.width,
      height: options.height,
      fit: options.fit || 'inside',
    },
    format: options.format || 'jpeg',
    quality: options.quality || 75,
  };

  return processImageWithCanvas(source, processingOptions);
}

/**
 * Generate multiple thumbnails
 */
export async function generateMultipleThumbnails(
  source: ImageSource,
  sizes: Array<{ name: string } & ThumbnailOptions>
): Promise<Record<string, CanvasResult>> {
  const results: Record<string, CanvasResult> = {};

  // Process in parallel
  await Promise.all(
    sizes.map(async ({ name, ...options }) => {
      try {
        results[name] = await generateThumbnail(source, options);
      } catch (error) {
        console.error(`Failed to generate thumbnail ${name}:`, error);
      }
    })
  );

  return results;
}

/**
 * Convert image format
 */
export async function convertImageFormat(
  source: ImageSource,
  format: 'jpeg' | 'png' | 'webp',
  quality?: number
): Promise<Blob> {
  const result = await processImageWithCanvas(source, { format, quality });
  return result.blob;
}

/**
 * Create preview for unsupported formats (BMP, TIFF)
 */
export async function createFallbackPreview(
  file: File,
  maxWidth: number = 800,
  maxHeight: number = 600
): Promise<string> {
  try {
    // For BMP files, we can use the browser's native support
    if (file.type === 'image/bmp' || file.name.toLowerCase().endsWith('.bmp')) {
      const result = await generateThumbnail(file, {
        width: maxWidth,
        height: maxHeight,
        format: 'jpeg',
        quality: 85,
      });
      return result.dataUrl;
    }

    // For TIFF and other formats, return a placeholder
    // In production, you'd want to use a server-side conversion
    return createPlaceholderImage(file.name, maxWidth, maxHeight);
  } catch (error) {
    console.error('Failed to create preview:', error);
    return createPlaceholderImage(file.name, maxWidth, maxHeight);
  }
}

/**
 * Create placeholder image
 */
function createPlaceholderImage(
  filename: string,
  width: number,
  height: number
): string {
  const { canvas, ctx } = createCanvas(width, height);
  
  // Background
  ctx.fillStyle = '#f3f4f6';
  ctx.fillRect(0, 0, width, height);
  
  // Border
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, width, height);
  
  // Text
  ctx.fillStyle = '#6b7280';
  ctx.font = '14px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  const extension = filename.split('.').pop()?.toUpperCase() || 'FILE';
  ctx.fillText(`${extension} Preview Not Available`, width / 2, height / 2);
  ctx.font = '12px system-ui, -apple-system, sans-serif';
  ctx.fillText('Click to download', width / 2, height / 2 + 20);
  
  return canvas.toDataURL('image/png');
}

/**
 * Check if image needs processing
 */
export function needsProcessing(
  metadata: ImageMetadata,
  targetFormat?: string,
  maxSize?: number
): boolean {
  // Check if format conversion needed
  if (targetFormat && metadata.format !== targetFormat) {
    return true;
  }

  // Check if size reduction needed
  if (maxSize && metadata.size > maxSize) {
    return true;
  }

  // Check if format is not web-compatible
  const webFormats = ['jpeg', 'jpg', 'png', 'webp', 'gif'];
  if (!webFormats.includes(metadata.format.toLowerCase())) {
    return true;
  }

  return false;
}

/**
 * Estimate processed image size
 */
export function estimateProcessedSize(
  metadata: ImageMetadata,
  options: ProcessingOptions
): number {
  const { width, height } = metadata;
  let newWidth = width;
  let newHeight = height;

  if (options.resize) {
    const resized = calculateThumbnailDimensions(
      { width, height },
      options.resize,
      options.resize.fit || 'inside'
    );
    newWidth = resized.width;
    newHeight = resized.height;
  }

  const pixels = newWidth * newHeight;
  const quality = (options.quality || 90) / 100;

  // Rough estimates based on format
  switch (options.format) {
    case 'png':
      return pixels * 3 * 0.5; // ~50% compression for PNG
    case 'webp':
      return pixels * 3 * quality * 0.3; // WebP is very efficient
    case 'jpeg':
    default:
      return pixels * 3 * quality * 0.4; // JPEG compression
  }
}

// Export utilities
export default {
  loadImage,
  createCanvas,
  extractImageMetadata,
  processImageWithCanvas,
  generateThumbnail,
  generateMultipleThumbnails,
  convertImageFormat,
  createFallbackPreview,
  needsProcessing,
  estimateProcessedSize,
  imageCache,
};