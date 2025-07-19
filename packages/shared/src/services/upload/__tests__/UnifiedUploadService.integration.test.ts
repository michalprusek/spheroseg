/**
 * Integration tests for UnifiedUploadService
 * 
 * Tests the complete upload workflow with mocked HTTP requests
 */

/// <reference types="vitest/globals" />
import { vi } from 'vitest';
import { UnifiedUploadService } from '../UnifiedUploadService';
import type { UploadFile, UploadOptions } from '../types';

// Mock fetch globally
global.fetch = vi.fn();
global.FormData = vi.fn(() => ({
  append: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  has: vi.fn(),
  entries: vi.fn(() => []),
  keys: vi.fn(() => []),
  values: vi.fn(() => []),
  forEach: vi.fn(),
})) as any;

// Mock File constructor
global.File = vi.fn((bits, name, options) => ({
  name,
  size: bits[0]?.length || 0,
  type: options?.type || 'application/octet-stream',
  lastModified: Date.now(),
  slice: vi.fn(),
  stream: vi.fn(),
  text: vi.fn(),
  arrayBuffer: vi.fn(),
})) as any;

// Mock Image for preview generation
global.Image = vi.fn().mockImplementation(() => ({
  onload: null,
  onerror: null,
  width: 1920,
  height: 1080,
  set src(value: string) {
    setTimeout(() => this.onload?.(), 0);
  },
})) as any;

// Mock FileReader for preview generation
global.FileReader = vi.fn().mockImplementation(() => ({
  readAsDataURL: vi.fn(function() {
    setTimeout(() => {
      this.result = 'data:image/jpeg;base64,mock';
      this.onload?.();
    }, 0);
  }),
  result: null,
  onload: null,
  onerror: null,
})) as any;

describe('UnifiedUploadService Integration Tests', () => {
  let service: UnifiedUploadService;
  const mockFetch = global.fetch as any;

  beforeEach(() => {
    service = new UnifiedUploadService();
    vi.clearAllMocks();
    
    // Default mock response
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'upload_123',
        url: 'https://example.com/uploads/image.jpg',
        thumbnailUrl: 'https://example.com/uploads/thumb.jpg',
      }),
    });
  });

  afterEach(() => {
    service.cancelAllUploads();
  });

  describe('single file upload', () => {
    it('should upload a file successfully', async () => {
      const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
      const progressEvents: number[] = [];

      const result = await service.uploadFile(file as any, {
        onProgress: ({ progress }) => progressEvents.push(progress),
      });

      expect(result.status).toBe('complete');
      expect(result.result).toEqual({
        id: 'upload_123',
        url: 'https://example.com/uploads/image.jpg',
        thumbnailUrl: 'https://example.com/uploads/thumb.jpg',
      });
      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[progressEvents.length - 1]).toBe(100);
    });

    it('should handle upload with metadata', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const metadata = {
        projectId: 'proj_123',
        description: 'Test image',
        tags: ['test', 'sample'],
      };

      await service.uploadFile(file as any, { metadata });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );
    });

    it('should handle upload errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      await expect(service.uploadFile(file as any))
        .rejects.toThrow('Upload failed');
    });

    it('should retry on failure', async () => {
      let attempts = 0;
      mockFetch.mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: 'upload_123' }),
        });
      });

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const result = await service.uploadFile(file as any);

      expect(attempts).toBe(3);
      expect(result.status).toBe('complete');
    });

    it('should handle upload cancellation', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      
      // Delay the mock response
      mockFetch.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      );

      const uploadPromise = service.uploadFile(file as any);
      
      // Cancel after starting
      setTimeout(() => service.cancelUpload((file as any).id), 50);

      await expect(uploadPromise).rejects.toThrow();
      
      const queue = service.getUploadQueue();
      const uploadFile = queue.find(f => f.file === file);
      expect(uploadFile?.status).toBe('cancelled');
    });
  });

  describe('batch upload', () => {
    it('should upload multiple files', async () => {
      const files = [
        new File(['content1'], 'file1.jpg', { type: 'image/jpeg' }),
        new File(['content2'], 'file2.jpg', { type: 'image/jpeg' }),
        new File(['content3'], 'file3.jpg', { type: 'image/jpeg' }),
      ];

      const result = await service.uploadFiles(files as any);

      expect(result.successful).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
      expect(result.totalFiles).toBe(3);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should handle partial failures in batch', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'upload_1' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Server Error',
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'upload_3' }),
        });

      const files = [
        new File(['content1'], 'file1.jpg', { type: 'image/jpeg' }),
        new File(['content2'], 'file2.jpg', { type: 'image/jpeg' }),
        new File(['content3'], 'file3.jpg', { type: 'image/jpeg' }),
      ];

      const result = await service.uploadFiles(files as any);

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].file.name).toBe('file2.jpg');
    });

    it('should respect concurrency limits', async () => {
      service.setConfig({ maxConcurrentUploads: 2 });

      let activeRequests = 0;
      let maxConcurrent = 0;

      mockFetch.mockImplementation(() => {
        activeRequests++;
        maxConcurrent = Math.max(maxConcurrent, activeRequests);
        
        return new Promise(resolve => {
          setTimeout(() => {
            activeRequests--;
            resolve({
              ok: true,
              json: async () => ({ id: 'upload_' + Date.now() }),
            });
          }, 50);
        });
      });

      const files = Array.from({ length: 5 }, (_, i) => 
        new File([`content${i}`], `file${i}.jpg`, { type: 'image/jpeg' })
      );

      await service.uploadFiles(files as any);

      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });
  });

  describe('chunked upload', () => {
    it('should use chunked upload for large files', async () => {
      service.setConfig({
        enableChunking: true,
        chunkSize: 5 * 1024 * 1024, // 5MB
      });

      // Create a "large" file (mock 15MB)
      const largeFile = {
        name: 'large.jpg',
        size: 15 * 1024 * 1024,
        type: 'image/jpeg',
        slice: vi.fn((start, end) => ({
          size: end - start,
        })),
      };

      // Mock chunked upload responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            uploadId: 'chunked_123',
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          }),
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({ success: true }),
        });

      const progressEvents: number[] = [];
      const result = await service.uploadFile(largeFile as any, {
        onProgress: ({ progress }) => progressEvents.push(progress),
      });

      expect(result.status).toBe('complete');
      
      // Should call init, 3 chunks, and complete
      expect(mockFetch).toHaveBeenCalledTimes(5);
      
      // Check progress events
      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[progressEvents.length - 1]).toBe(100);
    });

    it('should handle chunk upload failures', async () => {
      service.setConfig({
        enableChunking: true,
        chunkSize: 5 * 1024 * 1024,
      });

      const largeFile = {
        name: 'large.jpg',
        size: 10 * 1024 * 1024,
        type: 'image/jpeg',
        slice: vi.fn(() => ({ size: 5 * 1024 * 1024 })),
      };

      // Mock: init succeeds, first chunk fails
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ uploadId: 'chunked_123' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        });

      await expect(service.uploadFile(largeFile as any))
        .rejects.toThrow();
    });
  });

  describe('file validation', () => {
    it('should validate file size', async () => {
      service.setConfig({ maxFileSize: 1024 * 1024 }); // 1MB

      const smallFile = new File(['small'], 'small.jpg', { type: 'image/jpeg' });
      const largeFile = {
        name: 'large.jpg',
        size: 2 * 1024 * 1024,
        type: 'image/jpeg',
      };

      const smallResult = await service.validateFile(smallFile as any);
      const largeResult = await service.validateFile(largeFile as any);

      expect(smallResult.valid).toBe(true);
      expect(largeResult.valid).toBe(false);
      expect(largeResult.error).toContain('exceeds maximum');
    });

    it('should validate file types', async () => {
      service.setConfig({
        acceptedTypes: ['image/jpeg', 'image/png'],
        acceptedExtensions: ['.jpg', '.jpeg', '.png'],
      });

      const jpegFile = new File(['jpeg'], 'image.jpg', { type: 'image/jpeg' });
      const pdfFile = new File(['pdf'], 'doc.pdf', { type: 'application/pdf' });

      const jpegResult = await service.validateFile(jpegFile as any);
      const pdfResult = await service.validateFile(pdfFile as any);

      expect(jpegResult.valid).toBe(true);
      expect(pdfResult.valid).toBe(false);
      expect(pdfResult.error).toContain('type is not accepted');
    });

    it('should check image dimensions', async () => {
      const file = new File(['image'], 'test.jpg', { type: 'image/jpeg' });
      
      const result = await service.validateFile(file as any);

      expect(result.valid).toBe(true);
      expect(result.metadata?.dimensions).toEqual({
        width: 1920,
        height: 1080,
      });
    });
  });

  describe('progress tracking', () => {
    it('should track individual file progress', async () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      const progressUpdates: any[] = [];

      await service.uploadFile(file as any, {
        onProgress: (update) => progressUpdates.push(update),
      });

      expect(progressUpdates.length).toBeGreaterThan(0);
      
      const lastUpdate = progressUpdates[progressUpdates.length - 1];
      expect(lastUpdate.progress).toBe(100);
      expect(lastUpdate.loaded).toBe(lastUpdate.total);
    });

    it('should track overall batch progress', async () => {
      const files = [
        new File(['content1'], 'file1.jpg', { type: 'image/jpeg' }),
        new File(['content2'], 'file2.jpg', { type: 'image/jpeg' }),
      ];

      const batchProgress: number[] = [];
      
      await service.uploadFiles(files as any, {
        onBatchProgress: ({ overallProgress }) => {
          batchProgress.push(overallProgress);
        },
      });

      expect(batchProgress.length).toBeGreaterThan(0);
      expect(batchProgress[batchProgress.length - 1]).toBe(100);
    });
  });

  describe('upload strategies', () => {
    it('should select appropriate strategy based on file', async () => {
      const strategies = {
        small: new File(['small'], 'small.jpg', { type: 'image/jpeg' }),
        large: { name: 'large.jpg', size: 20 * 1024 * 1024, type: 'image/jpeg' },
        tiff: new File(['tiff'], 'image.tiff', { type: 'image/tiff' }),
      };

      service.setConfig({
        enableChunking: true,
        chunkSize: 10 * 1024 * 1024,
      });

      // Upload each file and check strategy selection
      for (const [type, file] of Object.entries(strategies)) {
        const spy = vi.spyOn(service as any, 'selectUploadStrategy');
        
        try {
          await service.uploadFile(file as any);
        } catch {
          // Some might fail, that's ok for this test
        }

        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
      }
    });
  });

  describe('error recovery', () => {
    it('should implement exponential backoff on retries', async () => {
      const delays: number[] = [];
      let lastCallTime = Date.now();

      mockFetch.mockImplementation(() => {
        const now = Date.now();
        delays.push(now - lastCallTime);
        lastCallTime = now;
        return Promise.reject(new Error('Network error'));
      });

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      
      try {
        await service.uploadFile(file as any);
      } catch {
        // Expected to fail after retries
      }

      // Check that delays increase
      for (let i = 2; i < delays.length; i++) {
        expect(delays[i]).toBeGreaterThan(delays[i - 1] * 0.8); // Allow some variance
      }
    });

    it('should handle network timeouts', async () => {
      service.setConfig({ uploadTimeout: 100 }); // 100ms timeout

      mockFetch.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      );

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      await expect(service.uploadFile(file as any))
        .rejects.toThrow('timeout');
    });
  });

  describe('preview generation', () => {
    it('should generate previews for images', async () => {
      const file = new File(['image'], 'test.jpg', { type: 'image/jpeg' });
      
      const preview = await service.generatePreview(file as any);

      expect(preview).toBe('data:image/jpeg;base64,mock');
    });

    it('should handle preview generation errors', async () => {
      const fileReader = global.FileReader as any;
      fileReader.mockImplementationOnce(() => ({
        readAsDataURL: vi.fn(function() {
          setTimeout(() => this.onerror?.(new Error('Read error')), 0);
        }),
        onerror: null,
      }));

      const file = new File(['image'], 'test.jpg', { type: 'image/jpeg' });
      
      const preview = await service.generatePreview(file as any);

      expect(preview).toBeNull();
    });
  });
});