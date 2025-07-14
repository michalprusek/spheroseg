/**
 * Backend Image Processing Service
 * 
 * Integration of the unified image processing module for backend use.
 * Provides high-performance image processing with Sharp.
 */

import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';

import {
  initializeSharp,
  extractMetadata,
  processImageWithSharp,
  generateThumbnail,
  generateMultipleThumbnails,
  createProcessingStream,
  optimizeForWeb,
  convertToWebFormat,
  batchProcess,
  validateImage,
} from '@spheroseg/shared/utils/imageProcessing.backend';

import {
  THUMBNAIL_SIZES,
  QUALITY_PRESETS,
  ProcessingOptions,
  ThumbnailOptions,
  ImageMetadata,
  getQualityPreset,
} from '@spheroseg/shared/utils/imageProcessing.unified';

// Initialize Sharp factory
initializeSharp(sharp);

// Service configuration
interface ServiceConfig {
  uploadDir: string;
  thumbnailDir: string;
  maxFileSize: number; // in MB
  maxDimensions: { width: number; height: number };
  allowedFormats: string[];
  enableOptimization: boolean;
  concurrency: number;
}

class ImageProcessingService {
  private config: ServiceConfig = {
    uploadDir: process.env.UPLOAD_DIR || './uploads',
    thumbnailDir: process.env.THUMBNAIL_DIR || './uploads/thumbnails',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '50', 10),
    maxDimensions: {
      width: parseInt(process.env.MAX_IMAGE_WIDTH || '8192', 10),
      height: parseInt(process.env.MAX_IMAGE_HEIGHT || '8192', 10),
    },
    allowedFormats: ['jpeg', 'jpg', 'png', 'webp', 'tiff', 'tif', 'bmp'],
    enableOptimization: process.env.ENABLE_IMAGE_OPTIMIZATION !== 'false',
    concurrency: parseInt(process.env.IMAGE_PROCESSING_CONCURRENCY || '3', 10),
  };

  constructor() {
    this.ensureDirectories();
  }

  /**
   * Ensure required directories exist
   */
  private async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.config.uploadDir, { recursive: true });
      await fs.mkdir(this.config.thumbnailDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create directories:', error);
    }
  }

  /**
   * Configure the service
   */
  configure(config: Partial<ServiceConfig>): void {
    this.config = { ...this.config, ...config };
    this.ensureDirectories();
  }

  /**
   * Process uploaded image
   */
  async processUpload(
    inputPath: string,
    options?: {
      generateThumbnails?: boolean;
      optimize?: boolean;
      validate?: boolean;
    }
  ): Promise<{
    metadata: ImageMetadata;
    thumbnails?: Record<string, string>;
    optimized?: string;
    errors?: string[];
  }> {
    const { generateThumbnails = true, optimize = true, validate = true } = options || {};

    // Validate image
    if (validate) {
      const validation = await validateImage(inputPath, {
        maxWidth: this.config.maxDimensions.width,
        maxHeight: this.config.maxDimensions.height,
        maxSizeMB: this.config.maxFileSize,
        allowedFormats: this.config.allowedFormats,
      });

      if (!validation.valid) {
        return { 
          metadata: await extractMetadata(inputPath),
          errors: validation.errors 
        };
      }
    }

    // Extract metadata
    const metadata = await extractMetadata(inputPath);
    const result: any = { metadata };

    // Generate thumbnails
    if (generateThumbnails) {
      result.thumbnails = await this.generateAllThumbnails(inputPath, metadata);
    }

    // Optimize image
    if (optimize && this.config.enableOptimization) {
      const optimizedPath = await this.optimizeImage(inputPath, metadata);
      if (optimizedPath) {
        result.optimized = optimizedPath;
      }
    }

    return result;
  }

  /**
   * Generate all standard thumbnails
   */
  async generateAllThumbnails(
    inputPath: string,
    metadata?: ImageMetadata
  ): Promise<Record<string, string>> {
    if (!metadata) {
      metadata = await extractMetadata(inputPath);
    }

    const baseName = path.basename(inputPath, path.extname(inputPath));
    const thumbnailPaths: Record<string, string> = {};

    // Generate thumbnails for standard sizes
    const sizes = Object.entries(THUMBNAIL_SIZES).map(([name, dimensions]) => ({
      name,
      ...dimensions,
      quality: QUALITY_PRESETS.thumbnail.quality,
      format: 'jpeg' as const,
    }));

    const results = await generateMultipleThumbnails(inputPath, sizes);

    // Save thumbnails
    for (const [size, result] of Object.entries(results)) {
      const fileName = `${baseName}_${size}.jpg`;
      const outputPath = path.join(this.config.thumbnailDir, fileName);
      
      await fs.writeFile(outputPath, result.buffer);
      thumbnailPaths[size] = outputPath;
    }

    return thumbnailPaths;
  }

  /**
   * Generate single thumbnail
   */
  async generateSingleThumbnail(
    inputPath: string,
    size: keyof typeof THUMBNAIL_SIZES | ThumbnailOptions,
    outputPath?: string
  ): Promise<string> {
    const options: ThumbnailOptions = 
      typeof size === 'string' 
        ? { ...THUMBNAIL_SIZES[size], quality: QUALITY_PRESETS.thumbnail.quality }
        : size;

    const result = await generateThumbnail(inputPath, options);

    if (!outputPath) {
      const baseName = path.basename(inputPath, path.extname(inputPath));
      const sizeName = typeof size === 'string' ? size : 'custom';
      outputPath = path.join(this.config.thumbnailDir, `${baseName}_${sizeName}.jpg`);
    }

    await fs.writeFile(outputPath, result.buffer);
    return outputPath;
  }

  /**
   * Optimize image for storage
   */
  async optimizeImage(
    inputPath: string,
    metadata?: ImageMetadata
  ): Promise<string | null> {
    if (!metadata) {
      metadata = await extractMetadata(inputPath);
    }

    // Skip optimization for already optimized formats/sizes
    if (metadata.size < 100 * 1024) { // Skip if less than 100KB
      return null;
    }

    const result = await optimizeForWeb(inputPath);

    // Only save if we achieved meaningful savings
    if (result.savings.percentage > 10) {
      const baseName = path.basename(inputPath, path.extname(inputPath));
      const outputPath = path.join(
        path.dirname(inputPath),
        `${baseName}_optimized.${result.optimized.format}`
      );
      
      await fs.writeFile(outputPath, result.buffer);
      return outputPath;
    }

    return null;
  }

  /**
   * Convert image format
   */
  async convertFormat(
    inputPath: string,
    format: 'jpeg' | 'png' | 'webp',
    outputPath?: string,
    quality?: number
  ): Promise<string> {
    const preset = getQualityPreset(format === 'png' ? 'highQuality' : 'balanced');
    const result = await processImageWithSharp(inputPath, {
      format,
      quality: quality || preset.quality,
      progressive: preset.progressive,
      mozjpeg: preset.mozjpeg,
    });

    if (!outputPath) {
      const baseName = path.basename(inputPath, path.extname(inputPath));
      outputPath = path.join(
        path.dirname(inputPath),
        `${baseName}.${format}`
      );
    }

    await fs.writeFile(outputPath, result.buffer);
    return outputPath;
  }

  /**
   * Convert TIFF/BMP to web format
   */
  async convertToWebFormat(
    inputPath: string,
    outputPath?: string
  ): Promise<string> {
    const result = await convertToWebFormat(inputPath);

    if (!outputPath) {
      const baseName = path.basename(inputPath, path.extname(inputPath));
      outputPath = path.join(
        path.dirname(inputPath),
        `${baseName}_converted.${result.metadata.format}`
      );
    }

    await fs.writeFile(outputPath, result.buffer);
    return outputPath;
  }

  /**
   * Stream process large images
   */
  async streamProcess(
    inputPath: string,
    outputPath: string,
    options: ProcessingOptions
  ): Promise<void> {
    const { input, output } = createProcessingStream(options);
    
    await pipeline(
      createReadStream(inputPath),
      input as any,
      output as any,
      createWriteStream(outputPath)
    );
  }

  /**
   * Batch process multiple images
   */
  async batchProcessImages(
    tasks: Array<{
      inputPath: string;
      outputPath: string;
      options: ProcessingOptions;
    }>,
    onProgress?: (processed: number, total: number) => void
  ): Promise<void> {
    const inputs = tasks.map(task => ({
      input: task.inputPath,
      options: task.options,
    }));

    const results = await batchProcess(inputs, {
      concurrency: this.config.concurrency,
      onProgress,
      onError: (error, index) => {
        console.error(`Failed to process ${tasks[index].inputPath}:`, error);
      },
    });

    // Save results
    await Promise.all(
      results.map(async (result, index) => {
        if (result) {
          await fs.writeFile(tasks[index].outputPath, result.buffer);
        }
      })
    );
  }

  /**
   * Extract image metadata
   */
  async getMetadata(inputPath: string): Promise<ImageMetadata> {
    return extractMetadata(inputPath);
  }

  /**
   * Validate image file
   */
  async validate(
    inputPath: string,
    options?: {
      maxWidth?: number;
      maxHeight?: number;
      maxSizeMB?: number;
      allowedFormats?: string[];
    }
  ): Promise<{ valid: boolean; errors: string[] }> {
    return validateImage(inputPath, options || {
      maxWidth: this.config.maxDimensions.width,
      maxHeight: this.config.maxDimensions.height,
      maxSizeMB: this.config.maxFileSize,
      allowedFormats: this.config.allowedFormats,
    });
  }

  /**
   * Clean up old thumbnails
   */
  async cleanupThumbnails(olderThanDays: number = 30): Promise<number> {
    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    const files = await fs.readdir(this.config.thumbnailDir);
    
    for (const file of files) {
      const filePath = path.join(this.config.thumbnailDir, file);
      const stats = await fs.stat(filePath);
      
      if (stats.mtimeMs < cutoffTime) {
        await fs.unlink(filePath);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Get service configuration
   */
  getConfig(): ServiceConfig {
    return { ...this.config };
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
};

// Export specific functions for direct use
export {
  extractMetadata,
  validateImage,
  optimizeForWeb,
  convertToWebFormat,
} from '@spheroseg/shared/utils/imageProcessing.backend';

export default imageProcessingService;