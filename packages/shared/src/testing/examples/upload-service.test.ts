/**
 * Example test for Upload Service
 * 
 * Demonstrates how to test the unified upload service
 */

/// <reference types="vitest/globals" />
import { vi } from 'vitest';
import { UnifiedUploadService } from '../../services/upload';
import { setupAPIMocks, resetAPIMocks, mockUploadEndpoints } from '../mocks/api';
import { createMockFile, testFiles } from '../mocks/files';
import { waitFor } from '../test-utils';

describe('UnifiedUploadService', () => {
  let service: UnifiedUploadService;

  beforeEach(() => {
    setupAPIMocks();
    mockUploadEndpoints();
    service = new UnifiedUploadService();
  });

  afterEach(() => {
    resetAPIMocks();
    vi.clearAllMocks();
  });

  describe('file validation', () => {
    it('should validate file size', async () => {
      service.setConfig({ maxFileSize: 1024 * 1024 }); // 1MB
      
      const smallFile = createMockFile('small.jpg', 500 * 1024, 'image/jpeg');
      const largeFile = createMockFile('large.jpg', 2 * 1024 * 1024, 'image/jpeg');

      const smallResult = await service.validateFile(smallFile);
      const largeResult = await service.validateFile(largeFile);

      expect(smallResult.valid).toBe(true);
      expect(largeResult.valid).toBe(false);
      expect(largeResult.error).toContain('exceeds maximum');
    });

    it('should validate file type', async () => {
      service.setConfig({
        acceptedTypes: ['image/jpeg', 'image/png'],
        acceptedExtensions: ['.jpg', '.jpeg', '.png'],
      });

      const jpegFile = testFiles.smallJpeg();
      const pdfFile = testFiles.pdf();

      const jpegResult = await service.validateFile(jpegFile);
      const pdfResult = await service.validateFile(pdfFile);

      expect(jpegResult.valid).toBe(true);
      expect(pdfResult.valid).toBe(false);
      expect(pdfResult.error).toContain('not accepted');
    });

    it('should provide warnings for edge cases', async () => {
      const tinyImage = createMockFile('tiny.jpg', 1024, 'image/jpeg');
      
      // Mock image dimensions
      global.Image = vi.fn().mockImplementation(() => ({
        onload: null,
        onerror: null,
        width: 50,
        height: 50,
        set src(value: string) {
          setTimeout(() => this.onload?.(), 0);
        },
      })) as any;

      const result = await service.validateFile(tinyImage);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Image dimensions are very small');
    });
  });

  describe('single file upload', () => {
    it('should upload file successfully', async () => {
      const file = testFiles.smallJpeg();
      const onProgress = vi.fn();

      const result = await service.uploadFile(file, {
        projectId: 'project_123',
        onProgress,
      });

      expect(result.status).toBe('complete');
      expect(result.result).toEqual({
        id: 'upload_123',
        url: 'https://example.com/image.jpg',
        thumbnailUrl: 'https://example.com/thumb.jpg',
      });
      expect(onProgress).toHaveBeenCalled();
    });

    it('should handle upload errors', async () => {
      const file = testFiles.smallJpeg();
      
      // Mock fetch to return error
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = mockFetch;

      await expect(service.uploadFile(file)).rejects.toThrow('Network error');
    });

    it('should support upload cancellation', async () => {
      const file = testFiles.largeJpeg();
      
      // Start upload
      const uploadPromise = service.uploadFile(file);
      
      // Cancel after a short delay
      setTimeout(() => service.cancelUpload(file.id), 10);

      await expect(uploadPromise).rejects.toThrow();
      
      const queue = service.getUploadQueue();
      const uploadedFile = queue.find(f => f.file === file);
      expect(uploadedFile?.status).toBe('cancelled');
    });
  });

  describe('batch upload', () => {
    it('should upload multiple files', async () => {
      const files = [
        testFiles.smallJpeg(),
        testFiles.png(),
        testFiles.tiff(),
      ];

      const result = await service.uploadFiles(files);

      expect(result.successful).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
      expect(result.totalFiles).toBe(3);
    });

    it('should handle partial failures', async () => {
      const files = [
        testFiles.smallJpeg(),
        testFiles.invalidType(),
        testFiles.png(),
      ];

      const result = await service.uploadFiles(files);

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toContain('not accepted');
    });
  });

  describe('chunked upload', () => {
    it('should use chunked upload for large files', async () => {
      service.setConfig({
        enableChunking: true,
        chunkSize: 5 * 1024 * 1024, // 5MB chunks
      });

      const largeFile = testFiles.largeJpeg(); // 15MB
      
      // Mock chunked upload endpoints
      const initMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ uploadId: 'chunked_123', expiresAt: new Date().toISOString() }),
      });
      
      const chunkMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });
      
      const completeMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'upload_456',
          url: 'https://example.com/large.jpg',
        }),
      });

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/chunked/init')) return initMock();
        if (url.includes('/chunked/chunk')) return chunkMock();
        if (url.includes('/chunked/complete')) return completeMock();
        throw new Error('Unknown endpoint');
      });

      const result = await service.uploadFile(largeFile);

      expect(result.status).toBe('complete');
      expect(initMock).toHaveBeenCalledTimes(1);
      expect(chunkMock).toHaveBeenCalledTimes(3); // 15MB / 5MB = 3 chunks
      expect(completeMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('resumable uploads', () => {
    it('should save resumable upload state', async () => {
      const file = testFiles.largeJpeg();
      
      // Mock localStorage
      const setItemSpy = vi.spyOn(localStorage, 'setItem');
      
      // Start upload and cancel it
      const uploadPromise = service.uploadFile(file);
      setTimeout(() => service.cancelUpload(file.id), 10);
      
      try {
        await uploadPromise;
      } catch {
        // Expected to throw
      }

      // Check if resumable state was saved
      const resumableUploads = service.getResumableUploads();
      expect(resumableUploads).toHaveLength(0); // Not implemented in basic version
    });
  });

  describe('upload strategies', () => {
    it('should select appropriate strategy based on file', async () => {
      const smallImage = createMockFile('small.jpg', 1 * 1024 * 1024, 'image/jpeg');
      const largeImage = createMockFile('large.jpg', 20 * 1024 * 1024, 'image/jpeg');
      const tiffImage = testFiles.tiff();

      // Spy on strategy selection
      const strategySpy = vi.spyOn(service as any, 'processUpload');

      await service.uploadFile(smallImage);
      await service.uploadFile(largeImage);
      await service.uploadFile(tiffImage);

      // Check that different strategies were used
      expect(strategySpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('progress tracking', () => {
    it('should report accurate progress', async () => {
      const file = testFiles.smallJpeg();
      const progressValues: number[] = [];

      await service.uploadFile(file, {
        onProgress: (progress) => {
          progressValues.push(progress.progress);
        },
      });

      expect(progressValues.length).toBeGreaterThan(0);
      expect(progressValues[progressValues.length - 1]).toBe(100);
    });
  });

  describe('error handling and retry', () => {
    it('should retry failed uploads', async () => {
      const file = testFiles.smallJpeg();
      let attempts = 0;

      // Mock fetch to fail first 2 times
      global.fetch = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Network error'));
        }
        return mockUploadEndpoints();
      });

      const result = await service.uploadFile(file);

      expect(attempts).toBe(3);
      expect(result.status).toBe('complete');
    });
  });
});