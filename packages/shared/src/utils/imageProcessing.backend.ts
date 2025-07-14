/**
 * Backend-specific Image Processing Utilities
 * 
 * Sharp-based image processing for Node.js environment.
 * Provides high-performance server-side image manipulation.
 */

import type { Sharp, Metadata, OutputInfo, Region } from 'sharp';
import { Readable } from 'stream';
import {
  ImageDimensions,
  ImageMetadata,
  ProcessingOptions,
  ThumbnailOptions,
  ThumbnailSize,
  THUMBNAIL_SIZES,
  QUALITY_PRESETS,
  calculateThumbnailDimensions,
  getQualityPreset,
  determineOptimalFormat,
  getMimeTypeFromFormat,
  validateProcessingOptions,
  mergeProcessingOptions,
} from './imageProcessing.unified';

// Sharp instance type for TypeScript
export type SharpInstance = Sharp;

// Stream processing options
export interface StreamOptions {
  highWaterMark?: number;
  timeout?: number;
}

// Batch processing options
export interface BatchOptions {
  concurrency?: number;
  onProgress?: (processed: number, total: number) => void;
  onError?: (error: Error, index: number) => void;
}

// Processing result with additional server-side metadata
export interface ProcessingResult {
  buffer: Buffer;
  metadata: ImageMetadata;
  info: OutputInfo;
}

// Image optimization result
export interface OptimizationResult {
  original: { size: number; format: string };
  optimized: { size: number; format: string };
  savings: { bytes: number; percentage: number };
  buffer: Buffer;
}

/**
 * Create Sharp instance (to be implemented by consumer)
 * This allows the shared module to work without directly importing sharp
 */
export interface SharpFactory {
  (input?: Buffer | string): SharpInstance;
}

let sharpFactory: SharpFactory | null = null;

/**
 * Initialize Sharp factory
 */
export function initializeSharp(factory: SharpFactory): void {
  sharpFactory = factory;
}

/**
 * Get Sharp instance
 */
function getSharp(input?: Buffer | string): SharpInstance {
  if (!sharpFactory) {
    throw new Error('Sharp not initialized. Call initializeSharp() first.');
  }
  return sharpFactory(input);
}

/**
 * Extract metadata using Sharp
 */
export async function extractMetadata(input: Buffer | string): Promise<ImageMetadata> {
  const sharp = getSharp(input);
  const metadata = await sharp.metadata();
  
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
    format: metadata.format || 'unknown',
    size: metadata.size || 0,
    mimeType: getMimeTypeFromFormat(metadata.format || 'unknown'),
    channels: metadata.channels,
    density: metadata.density,
    hasAlpha: metadata.hasAlpha,
    orientation: metadata.orientation,
    colorSpace: metadata.space,
  };
}

/**
 * Process image with Sharp
 */
export async function processImageWithSharp(
  input: Buffer | string,
  options: ProcessingOptions
): Promise<ProcessingResult> {
  // Validate options
  const errors = validateProcessingOptions(options);
  if (errors.length > 0) {
    throw new Error(`Invalid processing options: ${errors.join(', ')}`);
  }

  const sharp = getSharp(input);
  const metadata = await sharp.metadata();

  // Apply transformations
  if (options.resize) {
    sharp.resize(options.resize.width, options.resize.height, {
      fit: options.resize.fit as any,
      withoutEnlargement: options.resize.withoutEnlargement,
    });
  }

  if (options.crop) {
    sharp.extract({
      left: options.crop.left,
      top: options.crop.top,
      width: options.crop.width,
      height: options.crop.height,
    });
  }

  if (options.rotate) {
    sharp.rotate(options.rotate);
  }

  if (options.flip) {
    sharp.flip();
  }

  if (options.flop) {
    sharp.flop();
  }

  if (options.blur && options.blur > 0) {
    sharp.blur(options.blur);
  }

  if (options.sharpen) {
    sharp.sharpen();
  }

  if (options.grayscale) {
    sharp.grayscale();
  }

  if (options.normalize) {
    sharp.normalize();
  }

  // Apply format-specific options
  const format = options.format || 'jpeg';
  switch (format) {
    case 'jpeg':
      sharp.jpeg({
        quality: options.quality || 90,
        progressive: options.progressive || false,
        optimizeScans: options.optimizeScans || false,
        mozjpeg: options.mozjpeg || false,
      });
      break;
    case 'png':
      sharp.png({
        quality: options.quality || 90,
        progressive: options.progressive || false,
        compressionLevel: 6,
      });
      break;
    case 'webp':
      sharp.webp({
        quality: options.quality || 90,
        lossless: options.quality === 100,
        effort: 4,
      });
      break;
    case 'avif':
      sharp.avif({
        quality: options.quality || 90,
        lossless: options.quality === 100,
        effort: 4,
      });
      break;
  }

  // Process image
  const buffer = await sharp.toBuffer({ resolveWithObject: true });
  
  return {
    buffer: buffer.data,
    info: buffer.info,
    metadata: {
      width: buffer.info.width,
      height: buffer.info.height,
      format: buffer.info.format,
      size: buffer.info.size,
      mimeType: getMimeTypeFromFormat(buffer.info.format),
      channels: buffer.info.channels as number,
    },
  };
}

/**
 * Generate single thumbnail
 */
export async function generateThumbnail(
  input: Buffer | string,
  options: ThumbnailOptions
): Promise<ProcessingResult> {
  const metadata = await extractMetadata(input);
  const targetDimensions = calculateThumbnailDimensions(
    metadata,
    { width: options.width, height: options.height },
    options.fit || 'inside'
  );

  const processingOptions: ProcessingOptions = {
    resize: {
      width: targetDimensions.width,
      height: targetDimensions.height,
      fit: options.fit || 'inside',
      withoutEnlargement: true,
    },
    format: options.format || 'jpeg',
    quality: options.quality || 75,
    progressive: true,
    mozjpeg: true,
  };

  if (options.background) {
    // Note: Sharp requires background to be set before resize
    const sharp = getSharp(input);
    sharp.flatten({ background: options.background });
    const buffer = await sharp.toBuffer();
    return processImageWithSharp(buffer, processingOptions);
  }

  return processImageWithSharp(input, processingOptions);
}

/**
 * Generate multiple thumbnails in parallel
 */
export async function generateMultipleThumbnails(
  input: Buffer | string,
  sizes: Array<ThumbnailSize | (ThumbnailOptions & { name: string })>
): Promise<Record<string, ProcessingResult>> {
  const results: Record<string, ProcessingResult> = {};

  // Process thumbnails in parallel
  await Promise.all(
    sizes.map(async (sizeOrOptions) => {
      try {
        let name: string;
        let options: ThumbnailOptions;

        if (typeof sizeOrOptions === 'string') {
          name = sizeOrOptions;
          options = THUMBNAIL_SIZES[sizeOrOptions];
        } else {
          name = sizeOrOptions.name;
          const { name: _, ...opts } = sizeOrOptions;
          options = opts;
        }

        results[name] = await generateThumbnail(input, options);
      } catch (error) {
        console.error(`Failed to generate thumbnail ${name}:`, error);
      }
    })
  );

  return results;
}

/**
 * Stream-based image processing for large files
 */
export function createProcessingStream(
  options: ProcessingOptions,
  streamOptions?: StreamOptions
): { input: Readable; output: Readable; sharp: SharpInstance } {
  const sharp = getSharp();

  // Apply processing options
  if (options.resize) {
    sharp.resize(options.resize.width, options.resize.height, {
      fit: options.resize.fit as any,
      withoutEnlargement: options.resize.withoutEnlargement,
    });
  }

  // Format conversion
  const format = options.format || 'jpeg';
  switch (format) {
    case 'jpeg':
      sharp.jpeg({ quality: options.quality || 90 });
      break;
    case 'png':
      sharp.png({ quality: options.quality || 90 });
      break;
    case 'webp':
      sharp.webp({ quality: options.quality || 90 });
      break;
  }

  return {
    input: sharp as any,
    output: sharp as any,
    sharp,
  };
}

/**
 * Optimize image for web delivery
 */
export async function optimizeForWeb(
  input: Buffer | string,
  maxWidth: number = 2048,
  maxHeight: number = 2048,
  targetSizeKB?: number
): Promise<OptimizationResult> {
  const metadata = await extractMetadata(input);
  const originalSize = Buffer.isBuffer(input) ? input.length : 0;

  // Determine optimal format
  const targetFormat = determineOptimalFormat(metadata);
  
  // Calculate resize dimensions if needed
  let resize: ProcessingOptions['resize'] | undefined;
  if (metadata.width > maxWidth || metadata.height > maxHeight) {
    const dimensions = calculateThumbnailDimensions(
      metadata,
      { width: maxWidth, height: maxHeight },
      'inside'
    );
    resize = {
      width: dimensions.width,
      height: dimensions.height,
      fit: 'inside',
      withoutEnlargement: true,
    };
  }

  // Start with high quality
  let quality = 90;
  let result: ProcessingResult;

  // If target size specified, use binary search to find optimal quality
  if (targetSizeKB) {
    const targetSize = targetSizeKB * 1024;
    let minQuality = 10;
    let maxQuality = 95;

    while (maxQuality - minQuality > 5) {
      quality = Math.floor((minQuality + maxQuality) / 2);
      result = await processImageWithSharp(input, {
        format: targetFormat,
        quality,
        resize,
        progressive: true,
        mozjpeg: true,
      });

      if (result.buffer.length > targetSize) {
        maxQuality = quality;
      } else {
        minQuality = quality;
      }
    }
    quality = minQuality;
  }

  // Final processing
  result = await processImageWithSharp(input, {
    format: targetFormat,
    quality,
    resize,
    progressive: true,
    mozjpeg: true,
    optimizeScans: true,
  });

  const savings = originalSize - result.buffer.length;
  const percentage = originalSize > 0 ? (savings / originalSize) * 100 : 0;

  return {
    original: {
      size: originalSize,
      format: metadata.format,
    },
    optimized: {
      size: result.buffer.length,
      format: targetFormat,
    },
    savings: {
      bytes: Math.max(0, savings),
      percentage: Math.max(0, percentage),
    },
    buffer: result.buffer,
  };
}

/**
 * Convert TIFF/BMP to web-friendly format
 */
export async function convertToWebFormat(
  input: Buffer | string,
  preferredFormat: 'jpeg' | 'png' | 'webp' = 'jpeg'
): Promise<ProcessingResult> {
  const metadata = await extractMetadata(input);
  
  // Use PNG for images with transparency
  const format = metadata.hasAlpha ? 'png' : preferredFormat;
  
  return processImageWithSharp(input, {
    format,
    quality: format === 'png' ? 100 : 90,
    progressive: true,
  });
}

/**
 * Extract region from image
 */
export async function extractRegion(
  input: Buffer | string,
  region: Region
): Promise<ProcessingResult> {
  return processImageWithSharp(input, {
    crop: {
      left: region.left,
      top: region.top,
      width: region.width,
      height: region.height,
    },
  });
}

/**
 * Batch process images
 */
export async function batchProcess(
  inputs: Array<{ input: Buffer | string; options: ProcessingOptions }>,
  batchOptions?: BatchOptions
): Promise<ProcessingResult[]> {
  const concurrency = batchOptions?.concurrency || 3;
  const results: ProcessingResult[] = [];
  const errors: Array<{ index: number; error: Error }> = [];

  // Process in chunks
  for (let i = 0; i < inputs.length; i += concurrency) {
    const chunk = inputs.slice(i, i + concurrency);
    const chunkResults = await Promise.allSettled(
      chunk.map(({ input, options }) => processImageWithSharp(input, options))
    );

    chunkResults.forEach((result, index) => {
      const actualIndex = i + index;
      if (result.status === 'fulfilled') {
        results[actualIndex] = result.value;
      } else {
        const error = new Error(result.reason);
        errors.push({ index: actualIndex, error });
        batchOptions?.onError?.(error, actualIndex);
      }
    });

    batchOptions?.onProgress?.(i + chunk.length, inputs.length);
  }

  if (errors.length > 0) {
    console.error(`Batch processing completed with ${errors.length} errors`);
  }

  return results;
}

/**
 * Validate image file
 */
export async function validateImage(
  input: Buffer | string,
  options?: {
    maxWidth?: number;
    maxHeight?: number;
    maxSizeMB?: number;
    allowedFormats?: string[];
  }
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    const metadata = await extractMetadata(input);

    if (options?.maxWidth && metadata.width > options.maxWidth) {
      errors.push(`Image width ${metadata.width}px exceeds maximum ${options.maxWidth}px`);
    }

    if (options?.maxHeight && metadata.height > options.maxHeight) {
      errors.push(`Image height ${metadata.height}px exceeds maximum ${options.maxHeight}px`);
    }

    if (options?.maxSizeMB && metadata.size > options.maxSizeMB * 1024 * 1024) {
      const sizeMB = (metadata.size / 1024 / 1024).toFixed(2);
      errors.push(`Image size ${sizeMB}MB exceeds maximum ${options.maxSizeMB}MB`);
    }

    if (options?.allowedFormats && !options.allowedFormats.includes(metadata.format)) {
      errors.push(`Image format ${metadata.format} not allowed. Allowed: ${options.allowedFormats.join(', ')}`);
    }
  } catch (error) {
    errors.push(`Invalid image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Export utilities
export default {
  initializeSharp,
  extractMetadata,
  processImageWithSharp,
  generateThumbnail,
  generateMultipleThumbnails,
  createProcessingStream,
  optimizeForWeb,
  convertToWebFormat,
  extractRegion,
  batchProcess,
  validateImage,
};