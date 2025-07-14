/**
 * Unified Image Processing Module
 * 
 * This module consolidates all image processing functionality across the application,
 * providing a consistent API for both frontend and backend usage.
 * 
 * Features:
 * - Format detection and validation
 * - Image transformation (resize, crop, rotate, flip)
 * - Format conversion (JPEG, PNG, WebP, BMP, TIFF)
 * - Thumbnail generation with multiple sizes
 * - Quality optimization for different use cases
 * - Caching and performance optimization
 * - Progressive loading support
 */

// Type definitions for image processing
export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ImageMetadata extends ImageDimensions {
  format: string;
  size: number;
  mimeType: string;
  channels?: number;
  density?: number;
  hasAlpha?: boolean;
  orientation?: number;
  colorSpace?: string;
}

export interface ThumbnailOptions {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  position?: 'center' | 'top' | 'bottom' | 'left' | 'right' | string;
  background?: string;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

export interface ProcessingOptions {
  format?: 'jpeg' | 'png' | 'webp' | 'avif';
  quality?: number;
  resize?: {
    width?: number;
    height?: number;
    fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
    withoutEnlargement?: boolean;
  };
  crop?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  rotate?: number;
  flip?: boolean;
  flop?: boolean;
  blur?: number;
  sharpen?: boolean;
  grayscale?: boolean;
  normalize?: boolean;
  progressive?: boolean;
  optimizeScans?: boolean;
  mozjpeg?: boolean;
}

export interface QualityPreset {
  name: string;
  quality: number;
  format: 'jpeg' | 'png' | 'webp';
  progressive?: boolean;
  optimizeScans?: boolean;
  mozjpeg?: boolean;
  pngCompressionLevel?: number;
  webpEffort?: number;
}

// Supported image formats
export const SUPPORTED_FORMATS = {
  input: ['jpeg', 'jpg', 'png', 'webp', 'tiff', 'tif', 'bmp', 'gif', 'svg'] as const,
  output: ['jpeg', 'png', 'webp', 'avif'] as const,
  web: ['jpeg', 'jpg', 'png', 'webp', 'gif', 'svg'] as const,
  scientific: ['tiff', 'tif', 'png'] as const,
} as const;

export type InputFormat = typeof SUPPORTED_FORMATS.input[number];
export type OutputFormat = typeof SUPPORTED_FORMATS.output[number];

// Quality presets for different use cases
export const QUALITY_PRESETS: Record<string, QualityPreset> = {
  thumbnail: {
    name: 'thumbnail',
    quality: 75,
    format: 'jpeg',
    progressive: false,
    mozjpeg: true,
  },
  web: {
    name: 'web',
    quality: 85,
    format: 'webp',
    progressive: true,
  },
  scientific: {
    name: 'scientific',
    quality: 100,
    format: 'png',
    pngCompressionLevel: 1,
  },
  balanced: {
    name: 'balanced',
    quality: 90,
    format: 'jpeg',
    progressive: true,
    optimizeScans: true,
    mozjpeg: true,
  },
  highQuality: {
    name: 'highQuality',
    quality: 95,
    format: 'png',
    pngCompressionLevel: 6,
  },
};

// Thumbnail size presets
export const THUMBNAIL_SIZES = {
  micro: { width: 50, height: 50 },
  tiny: { width: 100, height: 100 },
  small: { width: 150, height: 150 },
  medium: { width: 300, height: 300 },
  large: { width: 600, height: 600 },
  xlarge: { width: 1200, height: 1200 },
  preview: { width: 800, height: 600 },
} as const;

export type ThumbnailSize = keyof typeof THUMBNAIL_SIZES;

// Image validation utilities
export function isValidImageFormat(format: string): format is InputFormat {
  return SUPPORTED_FORMATS.input.includes(format.toLowerCase() as InputFormat);
}

export function isWebFormat(format: string): boolean {
  return SUPPORTED_FORMATS.web.includes(format.toLowerCase() as any);
}

export function isScientificFormat(format: string): boolean {
  return SUPPORTED_FORMATS.scientific.includes(format.toLowerCase() as any);
}

export function getFormatFromMimeType(mimeType: string): string | null {
  const mimeMap: Record<string, string> = {
    'image/jpeg': 'jpeg',
    'image/jpg': 'jpeg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/tiff': 'tiff',
    'image/bmp': 'bmp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'image/avif': 'avif',
  };
  return mimeMap[mimeType.toLowerCase()] || null;
}

export function getMimeTypeFromFormat(format: string): string {
  const formatMap: Record<string, string> = {
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    tiff: 'image/tiff',
    tif: 'image/tiff',
    bmp: 'image/bmp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    avif: 'image/avif',
  };
  return formatMap[format.toLowerCase()] || 'application/octet-stream';
}

export function getExtensionFromFormat(format: string): string {
  const extensionMap: Record<string, string> = {
    jpeg: '.jpg',
    jpg: '.jpg',
    png: '.png',
    webp: '.webp',
    tiff: '.tiff',
    tif: '.tiff',
    bmp: '.bmp',
    gif: '.gif',
    svg: '.svg',
    avif: '.avif',
  };
  return extensionMap[format.toLowerCase()] || '';
}

// Calculate optimal thumbnail dimensions maintaining aspect ratio
export function calculateThumbnailDimensions(
  original: ImageDimensions,
  target: Partial<ImageDimensions>,
  fit: 'cover' | 'contain' | 'fill' | 'inside' | 'outside' = 'inside'
): ImageDimensions {
  const { width: origWidth, height: origHeight } = original;
  const { width: targetWidth, height: targetHeight } = target;

  if (!targetWidth && !targetHeight) {
    return original;
  }

  const aspectRatio = origWidth / origHeight;

  if (targetWidth && !targetHeight) {
    return {
      width: targetWidth,
      height: Math.round(targetWidth / aspectRatio),
    };
  }

  if (!targetWidth && targetHeight) {
    return {
      width: Math.round(targetHeight * aspectRatio),
      height: targetHeight,
    };
  }

  if (targetWidth && targetHeight) {
    switch (fit) {
      case 'fill':
        return { width: targetWidth, height: targetHeight };
      
      case 'cover': {
        const scale = Math.max(targetWidth / origWidth, targetHeight / origHeight);
        return {
          width: Math.round(origWidth * scale),
          height: Math.round(origHeight * scale),
        };
      }
      
      case 'contain':
      case 'inside': {
        const scale = Math.min(targetWidth / origWidth, targetHeight / origHeight);
        return {
          width: Math.round(origWidth * scale),
          height: Math.round(origHeight * scale),
        };
      }
      
      case 'outside': {
        const scale = Math.max(targetWidth / origWidth, targetHeight / origHeight);
        return {
          width: Math.round(origWidth * scale),
          height: Math.round(origHeight * scale),
        };
      }
      
      default:
        return { width: targetWidth, height: targetHeight };
    }
  }

  return original;
}

// Get quality preset based on use case
export function getQualityPreset(
  useCase: 'thumbnail' | 'web' | 'scientific' | 'balanced' | 'highQuality' | string
): QualityPreset {
  return QUALITY_PRESETS[useCase] || QUALITY_PRESETS.balanced;
}

// Determine optimal format based on image characteristics
export function determineOptimalFormat(metadata: Partial<ImageMetadata>): OutputFormat {
  // If the image has transparency, use PNG or WebP
  if (metadata.hasAlpha) {
    return 'webp'; // WebP supports transparency and is more efficient
  }

  // For scientific images, prefer lossless formats
  if (metadata.format && isScientificFormat(metadata.format)) {
    return 'png';
  }

  // For small images, PNG might be more efficient
  if (metadata.width && metadata.height && metadata.width * metadata.height < 10000) {
    return 'png';
  }

  // Default to WebP for best compression
  return 'webp';
}

// Generate cache key for processed images
export function generateImageCacheKey(
  source: string,
  options: ProcessingOptions
): string {
  const optionString = JSON.stringify(options, Object.keys(options).sort());
  const hash = simpleHash(source + optionString);
  return `img_${hash}`;
}

// Simple hash function for cache keys
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

// Validate processing options
export function validateProcessingOptions(options: ProcessingOptions): string[] {
  const errors: string[] = [];

  if (options.format && !SUPPORTED_FORMATS.output.includes(options.format)) {
    errors.push(`Unsupported output format: ${options.format}`);
  }

  if (options.quality !== undefined) {
    if (options.quality < 0 || options.quality > 100) {
      errors.push('Quality must be between 0 and 100');
    }
  }

  if (options.resize) {
    if (options.resize.width !== undefined && options.resize.width <= 0) {
      errors.push('Resize width must be positive');
    }
    if (options.resize.height !== undefined && options.resize.height <= 0) {
      errors.push('Resize height must be positive');
    }
  }

  if (options.crop) {
    if (options.crop.width <= 0 || options.crop.height <= 0) {
      errors.push('Crop dimensions must be positive');
    }
    if (options.crop.left < 0 || options.crop.top < 0) {
      errors.push('Crop position cannot be negative');
    }
  }

  if (options.rotate !== undefined) {
    if (![-270, -180, -90, 0, 90, 180, 270].includes(options.rotate)) {
      errors.push('Rotate must be -270, -180, -90, 0, 90, 180, or 270');
    }
  }

  return errors;
}

// Merge processing options with defaults
export function mergeProcessingOptions(
  options: Partial<ProcessingOptions>,
  preset?: QualityPreset
): ProcessingOptions {
  const defaults: ProcessingOptions = {
    quality: preset?.quality || 90,
    format: preset?.format || 'jpeg',
    progressive: preset?.progressive || false,
    optimizeScans: preset?.optimizeScans || false,
    mozjpeg: preset?.mozjpeg || false,
  };

  return {
    ...defaults,
    ...options,
    resize: options.resize ? { ...options.resize } : undefined,
    crop: options.crop ? { ...options.crop } : undefined,
  };
}

// Export utility functions for specific platforms
export * from './imageProcessing.frontend';
export * from './imageProcessing.backend';

// Default export with all utilities
export default {
  SUPPORTED_FORMATS,
  QUALITY_PRESETS,
  THUMBNAIL_SIZES,
  isValidImageFormat,
  isWebFormat,
  isScientificFormat,
  getFormatFromMimeType,
  getMimeTypeFromFormat,
  getExtensionFromFormat,
  calculateThumbnailDimensions,
  getQualityPreset,
  determineOptimalFormat,
  generateImageCacheKey,
  validateProcessingOptions,
  mergeProcessingOptions,
};