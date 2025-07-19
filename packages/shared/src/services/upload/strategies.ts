/**
 * Upload Strategy Pattern Implementation
 * 
 * Provides different upload strategies for various file types and scenarios
 */

import type { UploadOptions, UploadResult, ChunkInfo } from './types';

export interface UploadStrategy {
  name: string;
  canHandle(file: File): boolean;
  upload(file: File, options: UploadOptions): Promise<UploadResult>;
  supportsChunking: boolean;
  supportsResume: boolean;
}

/**
 * Base upload strategy with common functionality
 */
export abstract class BaseUploadStrategy implements UploadStrategy {
  abstract name: string;
  abstract canHandle(file: File): boolean;
  supportsChunking = false;
  supportsResume = false;

  abstract upload(file: File, options: UploadOptions): Promise<UploadResult>;

  protected async readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  protected async createChunks(file: File, chunkSize: number): Promise<ChunkInfo[]> {
    const chunks: ChunkInfo[] = [];
    const totalChunks = Math.ceil(file.size / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);

      chunks.push({
        index: i,
        start,
        end,
        size: end - start,
        blob: chunk,
        hash: await this.calculateHash(chunk),
      });
    }

    return chunks;
  }

  protected async calculateHash(blob: Blob): Promise<string> {
    const buffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  protected createFormData(
    file: File | Blob,
    options: UploadOptions,
    additionalData?: Record<string, string | number | boolean>
  ): FormData {
    const formData = new FormData();
    formData.append('file', file instanceof File ? file : new File([file], 'chunk'));

    if (options.projectId) {
      formData.append('projectId', options.projectId);
    }

    if (options.metadata) {
      formData.append('metadata', JSON.stringify(options.metadata));
    }

    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, String(value));
      });
    }

    return formData;
  }
}

/**
 * Standard upload strategy for small files
 */
export class StandardUploadStrategy extends BaseUploadStrategy {
  name = 'standard';
  maxFileSize = 10 * 1024 * 1024; // 10MB

  canHandle(file: File): boolean {
    return file.size <= this.maxFileSize;
  }

  async upload(file: File, options: UploadOptions): Promise<UploadResult> {
    const startTime = Date.now();
    const formData = this.createFormData(file, options);

    const response = await fetch(options.endpoint || '/api/upload', {
      method: 'POST',
      body: formData,
      signal: options.signal,
      headers: options.headers,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      id: data.id || `upload_${Date.now()}`,
      url: data.url,
      thumbnailUrl: data.thumbnailUrl,
      metadata: data.metadata,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Chunked upload strategy for large files
 */
export class ChunkedUploadStrategy extends BaseUploadStrategy {
  name = 'chunked';
  override supportsChunking = true;
  override supportsResume = true;
  chunkSize = 5 * 1024 * 1024; // 5MB chunks

  canHandle(file: File): boolean {
    return file.size > 10 * 1024 * 1024; // Files larger than 10MB
  }

  async upload(file: File, options: UploadOptions): Promise<UploadResult> {
    const startTime = Date.now();
    const chunks = await this.createChunks(file, options.chunkSize || this.chunkSize);
    const uploadId = await this.initializeUpload(file, chunks, options);

    let uploadedChunks = 0;
    const existingChunks = await this.checkExistingChunks(uploadId, options);

    for (const chunk of chunks) {
      // Skip already uploaded chunks (resume support)
      if (existingChunks.includes(chunk.index)) {
        uploadedChunks++;
        continue;
      }

      await this.uploadChunk(uploadId, chunk, options);
      uploadedChunks++;

      // Report progress
      if (options.onProgress) {
        const progress = (uploadedChunks / chunks.length) * 100;
        options.onProgress({
          loaded: uploadedChunks * this.chunkSize,
          total: file.size,
          progress,
        });
      }

      // Check if upload was cancelled
      if (options.signal?.aborted) {
        throw new Error('Upload cancelled');
      }
    }

    // Finalize the upload
    const result = await this.finalizeUpload(uploadId, file, options);

    return {
      ...result,
      duration: Date.now() - startTime,
    };
  }

  private async initializeUpload(
    file: File,
    chunks: ChunkInfo[],
    options: UploadOptions
  ): Promise<string> {
    const response = await fetch(`${options.endpoint || '/api/upload'}/chunked/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        totalChunks: chunks.length,
        chunkSize: this.chunkSize,
        projectId: options.projectId,
        metadata: options.metadata,
      }),
      signal: options.signal,
    });

    if (!response.ok) {
      throw new Error('Failed to initialize chunked upload');
    }

    const data = await response.json();
    return data.uploadId;
  }

  private async uploadChunk(
    uploadId: string,
    chunk: ChunkInfo,
    options: UploadOptions
  ): Promise<void> {
    const formData = new FormData();
    formData.append('chunk', chunk.blob);
    formData.append('uploadId', uploadId);
    formData.append('chunkIndex', String(chunk.index));
    formData.append('chunkHash', chunk.hash);

    const response = await fetch(`${options.endpoint || '/api/upload'}/chunked/chunk`, {
      method: 'POST',
      body: formData,
      headers: options.headers,
      signal: options.signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload chunk ${chunk.index}`);
    }
  }

  private async checkExistingChunks(
    uploadId: string,
    options: UploadOptions
  ): Promise<number[]> {
    try {
      const response = await fetch(
        `${options.endpoint || '/api/upload'}/chunked/status/${uploadId}`,
        {
          headers: options.headers,
          signal: options.signal,
        }
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.uploadedChunks || [];
    } catch {
      return [];
    }
  }

  private async finalizeUpload(
    uploadId: string,
    file: File,
    options: UploadOptions
  ): Promise<UploadResult> {
    const response = await fetch(`${options.endpoint || '/api/upload'}/chunked/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify({
        uploadId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      }),
      signal: options.signal,
    });

    if (!response.ok) {
      throw new Error('Failed to finalize chunked upload');
    }

    const data = await response.json();
    return data;
  }
}

/**
 * Image-specific upload strategy with optimization
 */
export class ImageUploadStrategy extends BaseUploadStrategy {
  name = 'image';
  supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  maxDimension = 4096;
  quality = 0.85;

  canHandle(file: File): boolean {
    return this.supportedTypes.includes(file.type.toLowerCase());
  }

  async upload(file: File, options: UploadOptions): Promise<UploadResult> {
    const startTime = Date.now();
    
    // Check if image needs optimization
    const shouldOptimize = await this.shouldOptimizeImage(file);
    const fileToUpload = shouldOptimize ? await this.optimizeImage(file) : file;

    const formData = this.createFormData(fileToUpload, options, {
      originalSize: file.size,
      optimized: shouldOptimize,
    });

    const response = await fetch(options.endpoint || '/api/upload/image', {
      method: 'POST',
      body: formData,
      signal: options.signal,
      headers: options.headers,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      id: data.id,
      url: data.url,
      thumbnailUrl: data.thumbnailUrl,
      metadata: {
        ...data.metadata,
        originalSize: file.size,
        optimizedSize: fileToUpload.size,
        optimized: shouldOptimize,
      },
      duration: Date.now() - startTime,
    };
  }

  private async shouldOptimizeImage(file: File): Promise<boolean> {
    // Don't optimize if file is already small
    if (file.size < 500 * 1024) return false;

    // Check image dimensions
    const dimensions = await this.getImageDimensions(file);
    return dimensions.width > this.maxDimension || dimensions.height > this.maxDimension;
  }

  private async getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = () => resolve({ width: 0, height: 0 });
      img.src = URL.createObjectURL(file);
    });
  }

  private async optimizeImage(file: File): Promise<File> {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    return new Promise((resolve) => {
      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;
        if (width > this.maxDimension || height > this.maxDimension) {
          const ratio = Math.min(this.maxDimension / width, this.maxDimension / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(new File([blob], file.name, { type: file.type }));
            } else {
              resolve(file);
            }
          },
          file.type,
          this.quality
        );
      };

      img.src = URL.createObjectURL(file);
    });
  }
}

/**
 * Special handling for TIFF/BMP images
 */
export class SpecialImageUploadStrategy extends StandardUploadStrategy {
  override name = 'special-image';
  supportedTypes = ['image/tiff', 'image/tif', 'image/bmp'];

  override canHandle(file: File): boolean {
    const ext = file.name.toLowerCase();
    return (
      this.supportedTypes.includes(file.type.toLowerCase()) ||
      ext.endsWith('.tiff') ||
      ext.endsWith('.tif') ||
      ext.endsWith('.bmp')
    );
  }

  override async upload(file: File, options: UploadOptions): Promise<UploadResult> {
    // Use special endpoint for TIFF/BMP conversion
    const endpoint = options.endpoint || '/api/upload/special-image';
    return super.upload(file, { ...options, endpoint });
  }
}

/**
 * Avatar upload strategy with cropping support
 */
export class AvatarUploadStrategy extends ImageUploadStrategy {
  override name = 'avatar';
  maxFileSize = 5 * 1024 * 1024; // 5MB
  override maxDimension = 512; // Smaller dimension for avatars

  override canHandle(file: File): boolean {
    return file.type.startsWith('image/') && file.size <= this.maxFileSize;
  }

  override async upload(file: File, options: UploadOptions): Promise<UploadResult> {
    // Avatar uploads go to a specific endpoint
    const endpoint = options.endpoint || '/api/upload/avatar';
    return super.upload(file, { ...options, endpoint });
  }
}

// Export strategy factory
export function createUploadStrategy(file: File, type?: string): UploadStrategy {
  // If type is specified, use specific strategy
  if (type === 'avatar') {
    return new AvatarUploadStrategy();
  }

  // Otherwise, auto-detect based on file
  const strategies = [
    new SpecialImageUploadStrategy(),
    new ImageUploadStrategy(),
    new ChunkedUploadStrategy(),
    new StandardUploadStrategy(),
  ];

  const strategy = strategies.find(s => s.canHandle(file));
  if (!strategy) {
    throw new Error('No suitable upload strategy found for file');
  }

  return strategy;
}