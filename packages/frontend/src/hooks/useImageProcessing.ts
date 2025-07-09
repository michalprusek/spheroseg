/**
 * React Hook for Image Processing
 *
 * Provides a convenient React interface for the unified image processing service
 * with state management, progress tracking, and error handling.
 */

import { useState, useCallback, useRef } from 'react';
import imageProcessingService, {
  ImageProcessingOptions,
  CropOptions,
  RotateOptions,
  ThumbnailOptions,
  ImageFormat,
  ProcessingResult,
  ImageMetadata,
  ImageDimensions,
} from '@/services/unifiedImageProcessingService';
import { createLogger } from '@/utils/logging/unifiedLogger';
import { toast } from 'sonner';

const logger = createLogger('useImageProcessing');

// ===========================
// Types
// ===========================

export interface UseImageProcessingOptions {
  onSuccess?: (result: ProcessingResult) => void;
  onError?: (error: Error) => void;
  showToasts?: boolean;
  autoProcess?: boolean;
}

export interface ProcessingState {
  isProcessing: boolean;
  progress: number;
  currentOperation: string | null;
  error: Error | null;
  result: ProcessingResult | null;
}

export interface BatchProcessingState {
  isProcessing: boolean;
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  results: ProcessingResult[];
  errors: Array<{ file: File; error: Error }>;
}

// ===========================
// Main Hook
// ===========================

export function useImageProcessing(options: UseImageProcessingOptions = {}) {
  const [state, setState] = useState<ProcessingState>({
    isProcessing: false,
    progress: 0,
    currentOperation: null,
    error: null,
    result: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  // Load image utility
  const loadImage = useCallback(
    async (source: string | File | Blob) => {
      try {
        setState((prev) => ({
          ...prev,
          isProcessing: true,
          currentOperation: 'Loading image',
          error: null,
        }));

        const img = await imageProcessingService.loadImage(source);

        setState((prev) => ({
          ...prev,
          isProcessing: false,
          currentOperation: null,
        }));

        return img;
      } catch (error) {
        const err = error as Error;
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          error: err,
          currentOperation: null,
        }));

        if (options.showToasts) {
          toast.error(`Failed to load image: ${err.message}`);
        }

        options.onError?.(err);
        throw err;
      }
    },
    [options],
  );

  // Get image dimensions
  const getImageDimensions = useCallback(
    async (source: string | File | Blob): Promise<ImageDimensions> => {
      try {
        return await imageProcessingService.getImageDimensions(source);
      } catch (error) {
        const err = error as Error;
        logger.error('Failed to get image dimensions:', err);

        if (options.showToasts) {
          toast.error('Failed to read image dimensions');
        }

        throw err;
      }
    },
    [options.showToasts],
  );

  // Resize image
  const resizeImage = useCallback(
    async (
      source: string | File | Blob | HTMLImageElement,
      processingOptions: ImageProcessingOptions = {},
    ): Promise<ProcessingResult> => {
      try {
        setState((prev) => ({
          ...prev,
          isProcessing: true,
          currentOperation: 'Resizing image',
          error: null,
          progress: 0,
        }));

        const result = await imageProcessingService.resizeImage(source, processingOptions);

        setState((prev) => ({
          ...prev,
          isProcessing: false,
          currentOperation: null,
          result,
          progress: 100,
        }));

        if (options.showToasts) {
          toast.success('Image resized successfully');
        }

        options.onSuccess?.(result);
        return result;
      } catch (error) {
        const err = error as Error;
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          error: err,
          currentOperation: null,
        }));

        if (options.showToasts) {
          toast.error(`Failed to resize image: ${err.message}`);
        }

        options.onError?.(err);
        throw err;
      }
    },
    [options],
  );

  // Crop image
  const cropImage = useCallback(
    async (
      source: string | File | Blob | HTMLImageElement,
      cropOptions: CropOptions,
      processOptions: ImageProcessingOptions = {},
    ): Promise<ProcessingResult> => {
      try {
        setState((prev) => ({
          ...prev,
          isProcessing: true,
          currentOperation: 'Cropping image',
          error: null,
          progress: 0,
        }));

        const result = await imageProcessingService.cropImage(source, cropOptions, processOptions);

        setState((prev) => ({
          ...prev,
          isProcessing: false,
          currentOperation: null,
          result,
          progress: 100,
        }));

        if (options.showToasts) {
          toast.success('Image cropped successfully');
        }

        options.onSuccess?.(result);
        return result;
      } catch (error) {
        const err = error as Error;
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          error: err,
          currentOperation: null,
        }));

        if (options.showToasts) {
          toast.error(`Failed to crop image: ${err.message}`);
        }

        options.onError?.(err);
        throw err;
      }
    },
    [options],
  );

  // Rotate image
  const rotateImage = useCallback(
    async (
      source: string | File | Blob | HTMLImageElement,
      rotateOptions: RotateOptions,
      processOptions: ImageProcessingOptions = {},
    ): Promise<ProcessingResult> => {
      try {
        setState((prev) => ({
          ...prev,
          isProcessing: true,
          currentOperation: 'Rotating image',
          error: null,
          progress: 0,
        }));

        const result = await imageProcessingService.rotateImage(source, rotateOptions, processOptions);

        setState((prev) => ({
          ...prev,
          isProcessing: false,
          currentOperation: null,
          result,
          progress: 100,
        }));

        if (options.showToasts) {
          toast.success('Image rotated successfully');
        }

        options.onSuccess?.(result);
        return result;
      } catch (error) {
        const err = error as Error;
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          error: err,
          currentOperation: null,
        }));

        if (options.showToasts) {
          toast.error(`Failed to rotate image: ${err.message}`);
        }

        options.onError?.(err);
        throw err;
      }
    },
    [options],
  );

  // Generate thumbnail
  const generateThumbnail = useCallback(
    async (
      source: string | File | Blob | HTMLImageElement,
      thumbnailOptions: ThumbnailOptions,
    ): Promise<ProcessingResult> => {
      try {
        setState((prev) => ({
          ...prev,
          isProcessing: true,
          currentOperation: 'Generating thumbnail',
          error: null,
          progress: 0,
        }));

        const result = await imageProcessingService.generateThumbnail(source, thumbnailOptions);

        setState((prev) => ({
          ...prev,
          isProcessing: false,
          currentOperation: null,
          result,
          progress: 100,
        }));

        if (options.showToasts) {
          toast.success('Thumbnail generated successfully');
        }

        options.onSuccess?.(result);
        return result;
      } catch (error) {
        const err = error as Error;
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          error: err,
          currentOperation: null,
        }));

        if (options.showToasts) {
          toast.error(`Failed to generate thumbnail: ${err.message}`);
        }

        options.onError?.(err);
        throw err;
      }
    },
    [options],
  );

  // Convert format
  const convertFormat = useCallback(
    async (
      source: string | File | Blob | HTMLImageElement,
      format: ImageFormat,
      processOptions: ImageProcessingOptions = {},
    ): Promise<ProcessingResult> => {
      try {
        setState((prev) => ({
          ...prev,
          isProcessing: true,
          currentOperation: `Converting to ${format}`,
          error: null,
          progress: 0,
        }));

        const result = await imageProcessingService.convertFormat(source, format, processOptions);

        setState((prev) => ({
          ...prev,
          isProcessing: false,
          currentOperation: null,
          result,
          progress: 100,
        }));

        if (options.showToasts) {
          toast.success(`Image converted to ${format} successfully`);
        }

        options.onSuccess?.(result);
        return result;
      } catch (error) {
        const err = error as Error;
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          error: err,
          currentOperation: null,
        }));

        if (options.showToasts) {
          toast.error(`Failed to convert format: ${err.message}`);
        }

        options.onError?.(err);
        throw err;
      }
    },
    [options],
  );

  // Get metadata
  const getImageMetadata = useCallback(
    async (source: string | File | Blob): Promise<ImageMetadata> => {
      try {
        return await imageProcessingService.getImageMetadata(source);
      } catch (error) {
        const err = error as Error;
        logger.error('Failed to get image metadata:', err);

        if (options.showToasts) {
          toast.error('Failed to read image metadata');
        }

        throw err;
      }
    },
    [options.showToasts],
  );

  // Process pipeline
  const processImagePipeline = useCallback(
    async (
      source: string | File | Blob,
      operations: Array<{
        type: 'resize' | 'crop' | 'rotate' | 'format' | 'thumbnail';
        options: any;
      }>,
    ): Promise<ProcessingResult> => {
      try {
        setState((prev) => ({
          ...prev,
          isProcessing: true,
          currentOperation: 'Processing image',
          error: null,
          progress: 0,
        }));

        const totalOperations = operations.length;
        let completedOperations = 0;

        // Update progress as we go
        const updateProgress = () => {
          completedOperations++;
          const progress = (completedOperations / totalOperations) * 100;
          setState((prev) => ({
            ...prev,
            progress,
            currentOperation: operations[completedOperations - 1]?.type || 'Processing',
          }));
        };

        const result = await imageProcessingService.processImagePipeline(source, operations);

        setState((prev) => ({
          ...prev,
          isProcessing: false,
          currentOperation: null,
          result,
          progress: 100,
        }));

        if (options.showToasts) {
          toast.success('Image processing completed');
        }

        options.onSuccess?.(result);
        return result;
      } catch (error) {
        const err = error as Error;
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          error: err,
          currentOperation: null,
        }));

        if (options.showToasts) {
          toast.error(`Image processing failed: ${err.message}`);
        }

        options.onError?.(err);
        throw err;
      }
    },
    [options],
  );

  // Validate image
  const validateImage = useCallback(
    async (
      file: File,
      validationOptions?: {
        maxSize?: number;
        minWidth?: number;
        minHeight?: number;
        maxWidth?: number;
        maxHeight?: number;
        allowedFormats?: string[];
      },
    ): Promise<{ valid: boolean; errors: string[] }> => {
      try {
        const result = await imageProcessingService.validateImage(file, validationOptions);

        if (!result.valid && options.showToasts) {
          toast.error(result.errors.join(', '));
        }

        return result;
      } catch (error) {
        const err = error as Error;
        logger.error('Failed to validate image:', err);

        if (options.showToasts) {
          toast.error('Failed to validate image');
        }

        throw err;
      }
    },
    [options.showToasts],
  );

  // Clear cache
  const clearCache = useCallback(async () => {
    await imageProcessingService.clearCache();
    logger.info('Image processing cache cleared');
  }, []);

  // Cancel processing
  const cancelProcessing = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setState((prev) => ({
      ...prev,
      isProcessing: false,
      currentOperation: null,
      progress: 0,
    }));

    if (options.showToasts) {
      toast.info('Processing cancelled');
    }
  }, [options.showToasts]);

  return {
    // State
    ...state,

    // Methods
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
    cancelProcessing,
  };
}

// ===========================
// Batch Processing Hook
// ===========================

export function useBatchImageProcessing(options: UseImageProcessingOptions = {}) {
  const [state, setState] = useState<BatchProcessingState>({
    isProcessing: false,
    totalFiles: 0,
    processedFiles: 0,
    failedFiles: 0,
    results: [],
    errors: [],
  });

  const processBatch = useCallback(
    async (
      files: File[],
      processOptions: ImageProcessingOptions & {
        generateThumbnails?: boolean;
        thumbnailOptions?: ThumbnailOptions;
      } = {},
    ): Promise<ProcessingResult[]> => {
      setState({
        isProcessing: true,
        totalFiles: files.length,
        processedFiles: 0,
        failedFiles: 0,
        results: [],
        errors: [],
      });

      const results: ProcessingResult[] = [];
      const errors: Array<{ file: File; error: Error }> = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        try {
          // Validate file first
          const validation = await imageProcessingService.validateImage(file, {
            maxSize: processOptions.maxWidth ? 10 * 1024 * 1024 : undefined, // 10MB default
            allowedFormats: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
          });

          if (!validation.valid) {
            throw new Error(validation.errors.join(', '));
          }

          // Process image
          let result = await imageProcessingService.resizeImage(file, processOptions);

          // Generate thumbnail if requested
          if (processOptions.generateThumbnails && processOptions.thumbnailOptions) {
            const thumbnail = await imageProcessingService.generateThumbnail(
              result.blob,
              processOptions.thumbnailOptions,
            );

            // Store thumbnail in result metadata
            result = {
              ...result,
              metadata: {
                ...result.metadata,
                thumbnail: thumbnail,
              },
            };
          }

          results.push(result);

          setState((prev) => ({
            ...prev,
            processedFiles: prev.processedFiles + 1,
            results: [...prev.results, result],
          }));
        } catch (error) {
          const err = error as Error;
          errors.push({ file, error: err });

          setState((prev) => ({
            ...prev,
            processedFiles: prev.processedFiles + 1,
            failedFiles: prev.failedFiles + 1,
            errors: [...prev.errors, { file, error: err }],
          }));

          logger.error(`Failed to process ${file.name}:`, err);
        }
      }

      setState((prev) => ({
        ...prev,
        isProcessing: false,
      }));

      if (options.showToasts) {
        if (errors.length === 0) {
          toast.success(`Successfully processed ${results.length} images`);
        } else {
          toast.warning(`Processed ${results.length} images, ${errors.length} failed`);
        }
      }

      return results;
    },
    [options],
  );

  return {
    ...state,
    processBatch,
  };
}

// ===========================
// Presets Hook
// ===========================

export function useImageProcessingPresets() {
  const { resizeImage, generateThumbnail, processImagePipeline } = useImageProcessing();

  const presets = {
    // Social media presets
    socialMedia: {
      instagram: {
        square: async (source: File | Blob) => resizeImage(source, { maxWidth: 1080, maxHeight: 1080 }),
        story: async (source: File | Blob) => resizeImage(source, { maxWidth: 1080, maxHeight: 1920 }),
      },
      twitter: async (source: File | Blob) => resizeImage(source, { maxWidth: 1200, maxHeight: 675 }),
      facebook: async (source: File | Blob) => resizeImage(source, { maxWidth: 1200, maxHeight: 630 }),
    },

    // Web optimization presets
    web: {
      thumbnail: async (source: File | Blob) =>
        generateThumbnail(source, {
          width: 150,
          height: 150,
          mode: 'cover',
          quality: 85,
          format: ImageFormat.JPEG,
        }),
      preview: async (source: File | Blob) =>
        resizeImage(source, {
          maxWidth: 800,
          maxHeight: 600,
          quality: 90,
          format: ImageFormat.JPEG,
        }),
      fullSize: async (source: File | Blob) =>
        resizeImage(source, {
          maxWidth: 1920,
          maxHeight: 1080,
          quality: 95,
          format: ImageFormat.JPEG,
        }),
    },

    // Scientific image presets
    scientific: {
      microscopy: async (source: File | Blob) =>
        processImagePipeline(source, [
          {
            type: 'resize',
            options: { maxWidth: 2048, maxHeight: 2048, format: ImageFormat.PNG },
          },
          {
            type: 'format',
            options: { format: ImageFormat.PNG, quality: 100 },
          },
        ]),
      publication: async (source: File | Blob) =>
        resizeImage(source, {
          maxWidth: 3000,
          quality: 100,
          format: ImageFormat.PNG,
        }),
    },
  };

  return presets;
}
