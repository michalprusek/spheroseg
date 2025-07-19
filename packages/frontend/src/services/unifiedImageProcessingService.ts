/**
 * Unified Image Processing Service
 *
 * This service consolidates all image processing functionality into a single,
 * comprehensive API for image manipulation, format conversion, and optimization.
 */

import { createLogger } from '@/utils/logging/unifiedLogger';
import { handleError, AppError, ErrorType } from '@/utils/error/unifiedErrorHandler';
import cacheService, { CacheLayer } from '@/services/unifiedCacheService';

const logger = createLogger('UnifiedImageProcessingService');

// ===========================
// Types and Interfaces
// ===========================

export interface ImageDimensions {
  width: number;
  height: number;
  aspectRatio: number;
}

export interface ImageProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-100 for JPEG
  format?: ImageFormat;
  preserveAspectRatio?: boolean;
  background?: string; // For formats that don't support transparency
  sharpen?: boolean;
  blur?: number;
  brightness?: number; // -100 to 100
  contrast?: number; // -100 to 100
  grayscale?: boolean;
  cache?: boolean;
  cacheKey?: string;
  cacheTTL?: number;
}

export interface CropOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  circular?: boolean;
}

export interface RotateOptions {
  angle: number; // Degrees
  background?: string;
  expand?: boolean; // Expand canvas to fit rotated image
}

export interface ThumbnailOptions {
  width: number;
  height: number;
  mode?: 'cover' | 'contain' | 'fill' | 'scale-down';
  quality?: number;
  format?: ImageFormat;
}

export enum ImageFormat {
  JPEG = 'jpeg',
  PNG = 'png',
  WEBP = 'webp',
  AVIF = 'avif',
}

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
  hasAlpha: boolean;
  colorSpace?: string;
  exif?: Record<string, any>;
}

export interface ProcessingResult {
  blob: Blob;
  dataUrl: string;
  metadata: ImageMetadata;
  cached?: boolean;
}

// ===========================
// Service Class
// ===========================

class UnifiedImageProcessingService {
  private readonly supportedFormats = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
  private readonly maxCanvasSize = 4096 * 4096; // Browser limit
  private processingQueue: Map<string, Promise<any>> = new Map();

  /**
   * Load image from various sources
   */
  public async loadImage(source: string | File | Blob): Promise<HTMLImageElement> {
    try {
      let url: string;

      if (source instanceof File || source instanceof Blob) {
        url = URL.createObjectURL(source);
      } else {
        url = source;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';

      return new Promise((resolve, reject) => {
        img.onload = () => {
          if (source instanceof File || source instanceof Blob) {
            URL.revokeObjectURL(url);
          }
          resolve(img);
        };

        img.onerror = () => {
          if (source instanceof File || source instanceof Blob) {
            URL.revokeObjectURL(url);
          }
          reject(new Error('Failed to load image'));
        };

        img.src = url;
      });
    } catch (error) {
      throw handleError(error, {
        context: 'loadImage',
        type: ErrorType.VALIDATION,
      });
    }
  }

  /**
   * Get image dimensions without fully loading it
   */
  public async getImageDimensions(source: string | File | Blob): Promise<ImageDimensions> {
    const img = await this.loadImage(source);
    return {
      width: img.width,
      height: img.height,
      aspectRatio: img.width / img.height,
    };
  }

  /**
   * Resize image with various options
   */
  public async resizeImage(
    source: string | File | Blob | HTMLImageElement,
    options: ImageProcessingOptions = {},
  ): Promise<ProcessingResult> {
    try {
      // Check cache first
      if (options.cache && options.cacheKey) {
        const cached = await this.getFromCache(options.cacheKey);
        if (cached) return cached;
      }

      const img = source instanceof HTMLImageElement ? source : await this.loadImage(source);

      // Calculate new dimensions
      const { width, height } = this.calculateDimensions(img, options);

      // Create canvas and context
      const canvas = this.createCanvas(width, height);
      const ctx = canvas.getContext('2d')!;

      // Set background if specified
      if (options.background) {
        ctx.fillStyle = options.background;
        ctx.fillRect(0, 0, width, height);
      }

      // Apply image smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Draw resized image
      ctx.drawImage(img, 0, 0, width, height);

      // Apply filters if requested
      if (options.brightness || options.contrast || options.grayscale || options.blur) {
        await this.applyFilters(ctx, width, height, options);
      }

      // Convert to blob
      const result = await this.canvasToResult(canvas, options);

      // Cache if requested
      if (options.cache && options.cacheKey) {
        await this.saveToCache(options.cacheKey, result, options.cacheTTL);
      }

      return result;
    } catch (error) {
      throw handleError(error, {
        context: 'resizeImage',
        type: ErrorType.PROCESSING,
      });
    }
  }

  /**
   * Crop image to specified region
   */
  public async cropImage(
    source: string | File | Blob | HTMLImageElement,
    cropOptions: CropOptions,
    processOptions: ImageProcessingOptions = {},
  ): Promise<ProcessingResult> {
    try {
      const img = source instanceof HTMLImageElement ? source : await this.loadImage(source);

      // Validate crop dimensions
      if (
        cropOptions.x < 0 ||
        cropOptions.y < 0 ||
        cropOptions.x + cropOptions.width > img.width ||
        cropOptions.y + cropOptions.height > img.height
      ) {
        throw new AppError('Crop dimensions exceed image bounds', ErrorType.VALIDATION);
      }

      const canvas = this.createCanvas(cropOptions.width, cropOptions.height);
      const ctx = canvas.getContext('2d')!;

      // Set background for circular crops
      if (cropOptions.circular && processOptions.background) {
        ctx.fillStyle = processOptions.background;
        ctx.fillRect(0, 0, cropOptions.width, cropOptions.height);
      }

      // Apply circular mask if requested
      if (cropOptions.circular) {
        ctx.beginPath();
        ctx.arc(
          cropOptions.width / 2,
          cropOptions.height / 2,
          Math.min(cropOptions.width, cropOptions.height) / 2,
          0,
          Math.PI * 2,
        );
        ctx.closePath();
        ctx.clip();
      }

      // Draw cropped region
      ctx.drawImage(
        img,
        cropOptions.x,
        cropOptions.y,
        cropOptions.width,
        cropOptions.height,
        0,
        0,
        cropOptions.width,
        cropOptions.height,
      );

      return this.canvasToResult(canvas, processOptions);
    } catch (error) {
      throw handleError(error, {
        context: 'cropImage',
        type: ErrorType.PROCESSING,
      });
    }
  }

  /**
   * Rotate image by specified angle
   */
  public async rotateImage(
    source: string | File | Blob | HTMLImageElement,
    rotateOptions: RotateOptions,
    processOptions: ImageProcessingOptions = {},
  ): Promise<ProcessingResult> {
    try {
      const img = source instanceof HTMLImageElement ? source : await this.loadImage(source);
      const radians = (rotateOptions.angle * Math.PI) / 180;

      // Calculate new dimensions if expanding
      let canvasWidth = img.width;
      let canvasHeight = img.height;

      if (rotateOptions.expand) {
        const cos = Math.abs(Math.cos(radians));
        const sin = Math.abs(Math.sin(radians));
        canvasWidth = Math.floor(img.width * cos + img.height * sin);
        canvasHeight = Math.floor(img.width * sin + img.height * cos);
      }

      const canvas = this.createCanvas(canvasWidth, canvasHeight);
      const ctx = canvas.getContext('2d')!;

      // Set background
      if (rotateOptions.background) {
        ctx.fillStyle = rotateOptions.background;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      }

      // Translate to center, rotate, and draw
      ctx.translate(canvasWidth / 2, canvasHeight / 2);
      ctx.rotate(radians);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      return this.canvasToResult(canvas, processOptions);
    } catch (error) {
      throw handleError(error, {
        context: 'rotateImage',
        type: ErrorType.PROCESSING,
      });
    }
  }

  /**
   * Generate thumbnail with smart cropping
   */
  public async generateThumbnail(
    source: string | File | Blob | HTMLImageElement,
    options: ThumbnailOptions,
  ): Promise<ProcessingResult> {
    try {
      const img = source instanceof HTMLImageElement ? source : await this.loadImage(source);

      const canvas = this.createCanvas(options.width, options.height);
      const ctx = canvas.getContext('2d')!;

      let sx = 0,
        sy = 0,
        sw = img.width,
        sh = img.height;
      let dx = 0,
        dy = 0,
        dw = options.width,
        dh = options.height;

      switch (options.mode) {
        case 'cover': {
          // Crop to fill entire thumbnail
          const scale = Math.max(options.width / img.width, options.height / img.height);
          const scaledWidth = img.width * scale;
          const scaledHeight = img.height * scale;

          sx = (scaledWidth - options.width) / 2 / scale;
          sy = (scaledHeight - options.height) / 2 / scale;
          sw = options.width / scale;
          sh = options.height / scale;
          break;
        }

        case 'contain': {
          // Fit entire image in thumbnail
          const scale = Math.min(options.width / img.width, options.height / img.height);
          dw = img.width * scale;
          dh = img.height * scale;
          dx = (options.width - dw) / 2;
          dy = (options.height - dh) / 2;

          // Clear background
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, options.width, options.height);
          break;
        }

        case 'fill': {
          // Stretch to fill (may distort)
          // Default values work
          break;
        }

        case 'scale-down': {
          // Only scale down, never up
          if (img.width > options.width || img.height > options.height) {
            const scale = Math.min(options.width / img.width, options.height / img.height);
            dw = img.width * scale;
            dh = img.height * scale;
            dx = (options.width - dw) / 2;
            dy = (options.height - dh) / 2;
          } else {
            dw = img.width;
            dh = img.height;
            dx = (options.width - img.width) / 2;
            dy = (options.height - img.height) / 2;
          }

          // Clear background
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, options.width, options.height);
          break;
        }
      }

      ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);

      return this.canvasToResult(canvas, {
        quality: options.quality,
        format: options.format,
      });
    } catch (error) {
      throw handleError(error, {
        context: 'generateThumbnail',
        type: ErrorType.PROCESSING,
      });
    }
  }

  /**
   * Convert image format
   */
  public async convertFormat(
    source: string | File | Blob | HTMLImageElement,
    format: ImageFormat,
    options: ImageProcessingOptions = {},
  ): Promise<ProcessingResult> {
    try {
      const img = source instanceof HTMLImageElement ? source : await this.loadImage(source);

      const canvas = this.createCanvas(img.width, img.height);
      const ctx = canvas.getContext('2d')!;

      // Set background for formats that don't support transparency
      if (format === ImageFormat.JPEG && options.background) {
        ctx.fillStyle = options.background || '#ffffff';
        ctx.fillRect(0, 0, img.width, img.height);
      }

      ctx.drawImage(img, 0, 0);

      return this.canvasToResult(canvas, { ...options, format });
    } catch (error) {
      throw handleError(error, {
        context: 'convertFormat',
        type: ErrorType.PROCESSING,
      });
    }
  }

  /**
   * Extract image metadata
   */
  public async getImageMetadata(source: string | File | Blob): Promise<ImageMetadata> {
    try {
      const img = await this.loadImage(source);
      const file = source instanceof File ? source : null;

      return {
        width: img.width,
        height: img.height,
        format: file?.type || 'unknown',
        size: file?.size || 0,
        hasAlpha: file?.type === 'image/png' || file?.type === 'image/webp',
        // EXIF data would require additional library
      };
    } catch (error) {
      throw handleError(error, {
        context: 'getImageMetadata',
        type: ErrorType.PROCESSING,
      });
    }
  }

  /**
   * Apply multiple processing operations in sequence
   */
  public async processImagePipeline(
    source: string | File | Blob,
    operations: Array<{
      type: 'resize' | 'crop' | 'rotate' | 'format' | 'thumbnail';
      options: unknown;
    }>,
  ): Promise<ProcessingResult> {
    try {
      const currentImage: HTMLImageElement | ProcessingResult = await this.loadImage(source);
      let result: ProcessingResult | null = null;

      for (const operation of operations) {
        const img = result ? await this.loadImage(result.blob) : (currentImage as HTMLImageElement);

        switch (operation.type) {
          case 'resize':
            result = await this.resizeImage(img, operation.options);
            break;
          case 'crop':
            result = await this.cropImage(img, operation.options.crop, operation.options.process);
            break;
          case 'rotate':
            result = await this.rotateImage(img, operation.options.rotate, operation.options.process);
            break;
          case 'format':
            result = await this.convertFormat(img, operation.options.format, operation.options);
            break;
          case 'thumbnail':
            result = await this.generateThumbnail(img, operation.options);
            break;
        }
      }

      if (!result) {
        throw new Error('No operations performed');
      }

      return result;
    } catch (error) {
      throw handleError(error, {
        context: 'processImagePipeline',
        type: ErrorType.PROCESSING,
      });
    }
  }

  /**
   * Validate image file
   */
  public async validateImage(
    file: File,
    options: {
      maxSize?: number;
      minWidth?: number;
      minHeight?: number;
      maxWidth?: number;
      maxHeight?: number;
      allowedFormats?: string[];
    } = {},
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check file size
    if (options.maxSize && file.size > options.maxSize) {
      errors.push(`File size exceeds ${(options.maxSize / 1024 / 1024).toFixed(2)}MB limit`);
    }

    // Check format
    if (options.allowedFormats && !options.allowedFormats.includes(file.type)) {
      errors.push(`File format ${file.type} is not allowed`);
    }

    // Check dimensions
    try {
      const dimensions = await this.getImageDimensions(file);

      if (options.minWidth && dimensions.width < options.minWidth) {
        errors.push(`Image width must be at least ${options.minWidth}px`);
      }
      if (options.minHeight && dimensions.height < options.minHeight) {
        errors.push(`Image height must be at least ${options.minHeight}px`);
      }
      if (options.maxWidth && dimensions.width > options.maxWidth) {
        errors.push(`Image width must not exceed ${options.maxWidth}px`);
      }
      if (options.maxHeight && dimensions.height > options.maxHeight) {
        errors.push(`Image height must not exceed ${options.maxHeight}px`);
      }
    } catch (error) {
      errors.push('Failed to read image dimensions');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // ===========================
  // Private Helper Methods
  // ===========================

  private createCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  private calculateDimensions(
    img: HTMLImageElement,
    options: ImageProcessingOptions,
  ): { width: number; height: number } {
    let { width, height } = img;

    if (options.maxWidth || options.maxHeight) {
      const scale = Math.min(
        options.maxWidth ? options.maxWidth / width : Infinity,
        options.maxHeight ? options.maxHeight / height : Infinity,
        1, // Never scale up
      );

      if (scale < 1) {
        width = Math.floor(width * scale);
        height = Math.floor(height * scale);
      }
    }

    return { width, height };
  }

  private async applyFilters(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    options: ImageProcessingOptions,
  ): Promise<void> {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // Brightness adjustment
      if (options.brightness) {
        const adjustment = (options.brightness / 100) * 255;
        r = Math.max(0, Math.min(255, r + adjustment));
        g = Math.max(0, Math.min(255, g + adjustment));
        b = Math.max(0, Math.min(255, b + adjustment));
      }

      // Contrast adjustment
      if (options.contrast) {
        const factor = (259 * (options.contrast + 100)) / (100 * (259 - options.contrast));
        r = Math.max(0, Math.min(255, factor * (r - 128) + 128));
        g = Math.max(0, Math.min(255, factor * (g - 128) + 128));
        b = Math.max(0, Math.min(255, factor * (b - 128) + 128));
      }

      // Grayscale conversion
      if (options.grayscale) {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        r = g = b = gray;
      }

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }

    ctx.putImageData(imageData, 0, 0);

    // Apply blur if requested
    if (options.blur && options.blur > 0) {
      ctx.filter = `blur(${options.blur}px)`;
      ctx.drawImage(ctx.canvas, 0, 0);
    }
  }

  private async canvasToResult(
    canvas: HTMLCanvasElement,
    options: ImageProcessingOptions = {},
  ): Promise<ProcessingResult> {
    const format = options.format || ImageFormat.JPEG;
    const mimeType = `image/${format}`;
    const quality = options.quality || 85;

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob'));
            return;
          }

          const dataUrl = await this.blobToDataUrl(blob);

          resolve({
            blob,
            dataUrl,
            metadata: {
              width: canvas.width,
              height: canvas.height,
              format: mimeType,
              size: blob.size,
              hasAlpha: format === ImageFormat.PNG || format === ImageFormat.WEBP,
            },
          });
        },
        mimeType,
        quality / 100,
      );
    });
  }

  private async blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private async getFromCache(key: string): Promise<ProcessingResult | null> {
    const cached = await cacheService.get<ProcessingResult>(`image-processing:${key}`, { layer: [CacheLayer.MEMORY] });

    if (cached) {
      return { ...cached, cached: true };
    }

    return null;
  }

  private async saveToCache(key: string, result: ProcessingResult, ttl: number = 5 * 60 * 1000): Promise<void> {
    await cacheService.set(`image-processing:${key}`, result, {
      ttl,
      layer: [CacheLayer.MEMORY],
      tags: ['image-processing'],
    });
  }

  /**
   * Clear all image processing cache
   */
  public async clearCache(): Promise<void> {
    await cacheService.deleteByTag('image-processing');
  }
}

// ===========================
// Singleton Instance
// ===========================

const imageProcessingService = new UnifiedImageProcessingService();

// ===========================
// Export
// ===========================

export default imageProcessingService;

// Named exports for convenience
export const {
  loadImage,
  getImageDimensions,
  resizeImage,
  cropImage,
  rotateImage,
  generateThumbnail,
  convertFormat,
  getImageMetadata,
  processImagePipeline,
  validateImage,
  clearCache,
} = imageProcessingService;
