/**
 * Image Optimizer Utility
 * 
 * Provides optimized image processing with WebP support,
 * progressive loading, and efficient memory usage.
 */

import sharp from 'sharp';
import path from 'path';
import { logger } from './logger';
import { ensureDirectoryExists } from './asyncFileOperations';

// Image format configurations
export const IMAGE_FORMATS = {
  WEBP: 'webp',
  JPEG: 'jpeg',
  PNG: 'png',
  AVIF: 'avif', // Future-proof for AVIF support
} as const;

export type ImageFormat = typeof IMAGE_FORMATS[keyof typeof IMAGE_FORMATS];

// Thumbnail size configurations
export const THUMBNAIL_SIZES = {
  SMALL: { width: 150, height: 150, suffix: 'sm' },
  MEDIUM: { width: 300, height: 300, suffix: 'md' },
  LARGE: { width: 600, height: 600, suffix: 'lg' },
  XLARGE: { width: 1200, height: 1200, suffix: 'xl' },
} as const;

export type ThumbnailSize = typeof THUMBNAIL_SIZES[keyof typeof THUMBNAIL_SIZES];

// Optimization presets
export const OPTIMIZATION_PRESETS = {
  // High quality for scientific images
  SCIENTIFIC: {
    jpeg: { quality: 95, progressive: true, mozjpeg: true },
    webp: { quality: 95, effort: 6, lossless: false },
    png: { compressionLevel: 9, adaptiveFiltering: true },
  },
  // Balanced quality/size for general use
  BALANCED: {
    jpeg: { quality: 85, progressive: true, mozjpeg: true },
    webp: { quality: 85, effort: 4, lossless: false },
    png: { compressionLevel: 6, adaptiveFiltering: true },
  },
  // Optimized for web thumbnails
  THUMBNAIL: {
    jpeg: { quality: 80, progressive: true, mozjpeg: true },
    webp: { quality: 80, effort: 3, lossless: false },
    png: { compressionLevel: 3, adaptiveFiltering: false },
  },
} as const;

export type OptimizationPreset = keyof typeof OPTIMIZATION_PRESETS;

/**
 * Detect optimal format based on image characteristics
 */
export async function detectOptimalFormat(
  imagePath: string,
  supportsWebP: boolean = true
): Promise<ImageFormat> {
  try {
    const metadata = await sharp(imagePath).metadata();
    
    // If image has transparency, use WebP or PNG
    if (metadata.hasAlpha || metadata.channels === 4) {
      return supportsWebP ? IMAGE_FORMATS.WEBP : IMAGE_FORMATS.PNG;
    }
    
    // For photos and complex images, use WebP or JPEG
    if (metadata.density && metadata.density > 72) {
      return supportsWebP ? IMAGE_FORMATS.WEBP : IMAGE_FORMATS.JPEG;
    }
    
    // Default to WebP for best compression
    return supportsWebP ? IMAGE_FORMATS.WEBP : IMAGE_FORMATS.JPEG;
  } catch (error) {
    logger.error('Error detecting optimal format', { error, imagePath });
    return IMAGE_FORMATS.JPEG; // Safe fallback
  }
}

/**
 * Optimize image for web delivery
 */
export async function optimizeForWeb(
  sourcePath: string,
  targetPath: string,
  options: {
    format?: ImageFormat;
    preset?: OptimizationPreset;
    maxWidth?: number;
    maxHeight?: number;
    supportsWebP?: boolean;
  } = {}
): Promise<{
  path: string;
  format: ImageFormat;
  size: number;
  width: number;
  height: number;
}> {
  const {
    format: requestedFormat,
    preset = 'BALANCED',
    maxWidth = 4096,
    maxHeight = 4096,
    supportsWebP = true,
  } = options;
  
  try {
    // Ensure target directory exists
    await ensureDirectoryExists(path.dirname(targetPath));
    
    // Detect format if not specified
    const format = requestedFormat || await detectOptimalFormat(sourcePath, supportsWebP);
    
    // Get optimization settings for the format
    const formatSettings = OPTIMIZATION_PRESETS[preset][format] || OPTIMIZATION_PRESETS[preset].jpeg;
    
    // Process the image
    const pipeline = sharp(sourcePath)
      .resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .rotate(); // Auto-rotate based on EXIF
    
    // Apply format-specific optimizations
    let outputPath = targetPath;
    switch (format) {
      case IMAGE_FORMATS.WEBP:
        outputPath = targetPath.replace(/\.[^.]+$/, '.webp');
        await pipeline
          .webp(formatSettings as any)
          .toFile(outputPath);
        break;
        
      case IMAGE_FORMATS.PNG:
        outputPath = targetPath.replace(/\.[^.]+$/, '.png');
        await pipeline
          .png(formatSettings as any)
          .toFile(outputPath);
        break;
        
      case IMAGE_FORMATS.JPEG:
      default:
        outputPath = targetPath.replace(/\.[^.]+$/, '.jpg');
        await pipeline
          .jpeg(formatSettings as any)
          .toFile(outputPath);
        break;
    }
    
    // Get output metadata
    const metadata = await sharp(outputPath).metadata();
    const stats = await sharp(outputPath).stats();
    
    logger.debug('Image optimized', {
      source: sourcePath,
      output: outputPath,
      format,
      originalSize: metadata.size,
      width: metadata.width,
      height: metadata.height,
    });
    
    return {
      path: outputPath,
      format,
      size: metadata.size || 0,
      width: metadata.width || 0,
      height: metadata.height || 0,
    };
  } catch (error) {
    logger.error('Error optimizing image', { error, sourcePath, targetPath });
    throw error;
  }
}

/**
 * Generate responsive thumbnails in multiple sizes
 */
export async function generateResponsiveThumbnails(
  sourcePath: string,
  outputDir: string,
  options: {
    sizes?: ThumbnailSize[];
    formats?: ImageFormat[];
    preset?: OptimizationPreset;
    baseFilename?: string;
  } = {}
): Promise<Array<{
  size: ThumbnailSize;
  format: ImageFormat;
  path: string;
  width: number;
  height: number;
  fileSize: number;
}>> {
  const {
    sizes = Object.values(THUMBNAIL_SIZES),
    formats = [IMAGE_FORMATS.WEBP, IMAGE_FORMATS.JPEG],
    preset = 'THUMBNAIL',
    baseFilename = 'thumb',
  } = options;
  
  await ensureDirectoryExists(outputDir);
  
  const results = [];
  
  // Process each size and format combination in parallel
  const promises = [];
  
  for (const size of sizes) {
    for (const format of formats) {
      const promise = (async () => {
        const filename = `${baseFilename}-${size.suffix}.${format}`;
        const outputPath = path.join(outputDir, filename);
        
        try {
          const formatSettings = OPTIMIZATION_PRESETS[preset][format] || OPTIMIZATION_PRESETS[preset].jpeg;
          
          const pipeline = sharp(sourcePath)
            .resize(size.width, size.height, {
              fit: 'cover',
              position: 'center',
            })
            .rotate(); // Auto-rotate based on EXIF
          
          // Apply format-specific settings
          switch (format) {
            case IMAGE_FORMATS.WEBP:
              await pipeline.webp(formatSettings as any).toFile(outputPath);
              break;
            case IMAGE_FORMATS.PNG:
              await pipeline.png(formatSettings as any).toFile(outputPath);
              break;
            case IMAGE_FORMATS.JPEG:
            default:
              await pipeline.jpeg(formatSettings as any).toFile(outputPath);
              break;
          }
          
          // Get file stats
          const metadata = await sharp(outputPath).metadata();
          
          return {
            size,
            format,
            path: outputPath,
            width: metadata.width || size.width,
            height: metadata.height || size.height,
            fileSize: metadata.size || 0,
          };
        } catch (error) {
          logger.error('Error generating thumbnail', {
            error,
            sourcePath,
            outputPath,
            size: size.suffix,
            format,
          });
          return null;
        }
      })();
      
      promises.push(promise);
    }
  }
  
  // Wait for all thumbnails to be generated
  const allResults = await Promise.all(promises);
  
  // Filter out failed generations
  return allResults.filter(result => result !== null) as any[];
}

/**
 * Convert TIFF/BMP to web-friendly format with optimization
 */
export async function convertToWebFormat(
  sourcePath: string,
  targetDir: string,
  options: {
    keepOriginal?: boolean;
    generateThumbnails?: boolean;
    supportsWebP?: boolean;
  } = {}
): Promise<{
  optimized: {
    path: string;
    format: ImageFormat;
    size: number;
  };
  thumbnails?: Array<{
    size: ThumbnailSize;
    format: ImageFormat;
    path: string;
  }>;
}> {
  const {
    keepOriginal = true,
    generateThumbnails = true,
    supportsWebP = true,
  } = options;
  
  const filename = path.basename(sourcePath, path.extname(sourcePath));
  const optimizedPath = path.join(targetDir, `${filename}-optimized`);
  
  // Optimize the main image
  const optimized = await optimizeForWeb(sourcePath, optimizedPath, {
    preset: 'SCIENTIFIC', // High quality for scientific images
    supportsWebP,
  });
  
  let thumbnails;
  if (generateThumbnails) {
    thumbnails = await generateResponsiveThumbnails(sourcePath, targetDir, {
      baseFilename: filename,
      formats: supportsWebP ? [IMAGE_FORMATS.WEBP] : [IMAGE_FORMATS.JPEG],
    });
  }
  
  return {
    optimized,
    thumbnails,
  };
}

/**
 * Estimate processing time based on image size and format
 */
export async function estimateProcessingTime(
  imagePath: string,
  operations: Array<'optimize' | 'thumbnail' | 'convert'>
): Promise<number> {
  try {
    const metadata = await sharp(imagePath).metadata();
    const pixels = (metadata.width || 0) * (metadata.height || 0);
    const megapixels = pixels / 1_000_000;
    
    let estimatedMs = 0;
    
    // Base time estimates (ms per megapixel)
    const timePerMegapixel = {
      optimize: 50,
      thumbnail: 20,
      convert: 100,
    };
    
    for (const operation of operations) {
      estimatedMs += megapixels * timePerMegapixel[operation];
    }
    
    // Add overhead for file I/O
    estimatedMs += 100;
    
    return Math.round(estimatedMs);
  } catch (error) {
    logger.error('Error estimating processing time', { error, imagePath });
    return 5000; // Default 5 seconds
  }
}

export default {
  detectOptimalFormat,
  optimizeForWeb,
  generateResponsiveThumbnails,
  convertToWebFormat,
  estimateProcessingTime,
  IMAGE_FORMATS,
  THUMBNAIL_SIZES,
  OPTIMIZATION_PRESETS,
};