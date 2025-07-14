/**
 * Frontend Image Processing Service
 * 
 * Integration of the unified image processing module for frontend use.
 * Provides a clean API for all image processing needs in the React application.
 */

import {
  ImageSource,
  generateThumbnail,
  generateMultipleThumbnails,
  processImageWithCanvas,
  convertImageFormat,
  createFallbackPreview,
  extractImageMetadata,
  needsProcessing,
  estimateProcessedSize,
  imageCache as cache,
} from '@spheroseg/shared/utils/imageProcessing.frontend';

import {
  THUMBNAIL_SIZES,
  QUALITY_PRESETS,
  ProcessingOptions,
  ThumbnailOptions,
  ImageMetadata,
} from '@spheroseg/shared/utils/imageProcessing.unified';

// Service configuration
interface ServiceConfig {
  enableCache: boolean;
  maxConcurrentProcessing: number;
  defaultQuality: number;
  autoWebPConversion: boolean;
}

class ImageProcessingService {
  private config: ServiceConfig = {
    enableCache: true,
    maxConcurrentProcessing: 3,
    defaultQuality: 85,
    autoWebPConversion: true,
  };

  private processingCount = 0;
  private processingQueue: Array<() => Promise<void>> = [];

  /**
   * Configure the service
   */
  configure(config: Partial<ServiceConfig>): void {
    this.config = { ...this.config, ...config };
    if (!config.enableCache) {
      cache.clear();
    }
  }

  /**
   * Process image with queuing
   */
  private async queueProcessing<T>(fn: () => Promise<T>): Promise<T> {
    if (this.processingCount >= this.config.maxConcurrentProcessing) {
      await new Promise<void>((resolve) => {
        this.processingQueue.push(resolve);
      });
    }

    this.processingCount++;
    try {
      return await fn();
    } finally {
      this.processingCount--;
      const next = this.processingQueue.shift();
      if (next) next();
    }
  }

  /**
   * Generate thumbnail for display
   */
  async generateThumbnail(
    source: ImageSource,
    size: keyof typeof THUMBNAIL_SIZES | ThumbnailOptions
  ): Promise<{ url: string; blob: Blob; metadata: ImageMetadata }> {
    return this.queueProcessing(async () => {
      const options: ThumbnailOptions = 
        typeof size === 'string' 
          ? { ...THUMBNAIL_SIZES[size], quality: this.config.defaultQuality }
          : size;

      const result = await generateThumbnail(source, options);
      return {
        url: result.dataUrl,
        blob: result.blob,
        metadata: result.metadata,
      };
    });
  }

  /**
   * Generate all standard thumbnails
   */
  async generateAllThumbnails(
    source: ImageSource
  ): Promise<Record<string, { url: string; blob: Blob; metadata: ImageMetadata }>> {
    return this.queueProcessing(async () => {
      const sizes = Object.entries(THUMBNAIL_SIZES).map(([name, dimensions]) => ({
        name,
        ...dimensions,
        quality: this.config.defaultQuality,
        format: 'jpeg' as const,
      }));

      const results = await generateMultipleThumbnails(source, sizes);
      const formatted: Record<string, any> = {};

      for (const [name, result] of Object.entries(results)) {
        formatted[name] = {
          url: result.dataUrl,
          blob: result.blob,
          metadata: result.metadata,
        };
      }

      return formatted;
    });
  }

  /**
   * Optimize image for upload
   */
  async optimizeForUpload(
    file: File,
    maxSizeMB: number = 10
  ): Promise<{ file: File; wasOptimized: boolean; savings?: number }> {
    const metadata = await extractImageMetadata(file);
    const maxSize = maxSizeMB * 1024 * 1024;

    // Check if optimization needed
    if (!needsProcessing(metadata, undefined, maxSize)) {
      return { file, wasOptimized: false };
    }

    return this.queueProcessing(async () => {
      // Determine optimal settings
      const targetFormat = this.config.autoWebPConversion ? 'webp' : 'jpeg';
      let quality = this.config.defaultQuality;
      
      // Estimate size and adjust quality if needed
      const estimatedSize = estimateProcessedSize(metadata, {
        format: targetFormat,
        quality,
      });

      if (estimatedSize > maxSize) {
        quality = Math.floor((maxSize / estimatedSize) * quality);
        quality = Math.max(60, Math.min(95, quality)); // Keep quality reasonable
      }

      // Process image
      const options: ProcessingOptions = {
        format: targetFormat,
        quality,
        resize: metadata.width > 4096 || metadata.height > 4096
          ? { width: 4096, height: 4096, fit: 'inside' }
          : undefined,
      };

      const result = await processImageWithCanvas(file, options);
      const optimizedFile = new File(
        [result.blob], 
        file.name.replace(/\.[^.]+$/, `.${targetFormat}`),
        { type: result.blob.type }
      );

      return {
        file: optimizedFile,
        wasOptimized: true,
        savings: file.size - optimizedFile.size,
      };
    });
  }

  /**
   * Create preview for any image type
   */
  async createPreview(
    file: File,
    options?: { maxWidth?: number; maxHeight?: number }
  ): Promise<string> {
    const { maxWidth = 800, maxHeight = 600 } = options || {};

    // Check if it's a supported format
    const metadata = await extractImageMetadata(file);
    if (['jpeg', 'jpg', 'png', 'webp', 'gif'].includes(metadata.format.toLowerCase())) {
      const result = await this.generateThumbnail(file, {
        width: maxWidth,
        height: maxHeight,
        fit: 'inside',
      });
      return result.url;
    }

    // Use fallback for unsupported formats
    return createFallbackPreview(file, maxWidth, maxHeight);
  }

  /**
   * Convert image to specific format
   */
  async convertFormat(
    source: ImageSource,
    format: 'jpeg' | 'png' | 'webp',
    quality?: number
  ): Promise<{ blob: Blob; url: string }> {
    return this.queueProcessing(async () => {
      const blob = await convertImageFormat(
        source,
        format,
        quality || this.config.defaultQuality
      );
      const url = URL.createObjectURL(blob);
      return { blob, url };
    });
  }

  /**
   * Apply image transformations
   */
  async transform(
    source: ImageSource,
    options: ProcessingOptions
  ): Promise<{ blob: Blob; url: string; metadata: ImageMetadata }> {
    return this.queueProcessing(async () => {
      const result = await processImageWithCanvas(source, {
        quality: this.config.defaultQuality,
        ...options,
      });
      return {
        blob: result.blob,
        url: result.dataUrl,
        metadata: result.metadata,
      };
    });
  }

  /**
   * Clear image cache
   */
  clearCache(): void {
    cache.clear();
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      processingCount: this.processingCount,
      queueLength: this.processingQueue.length,
      config: this.config,
    };
  }
}

// Export singleton instance
export const imageProcessingService = new ImageProcessingService();

// Export types and constants for convenience
export { 
  THUMBNAIL_SIZES, 
  QUALITY_PRESETS,
  type ProcessingOptions,
  type ThumbnailOptions,
  type ImageMetadata,
  type ImageSource,
};

// Export specific functions for direct use
export {
  extractImageMetadata,
  needsProcessing,
  estimateProcessedSize,
  createFallbackPreview,
} from '@spheroseg/shared/utils/imageProcessing.frontend';

export default imageProcessingService;