"use strict";
/**
 * Integration tests for UnifiedUploadService
 *
 * Tests the complete upload workflow with mocked HTTP requests
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const UnifiedUploadService_1 = require("../UnifiedUploadService");
// Mock fetch globally
global.fetch = vitest_1.vi.fn();
global.FormData = vitest_1.vi.fn(() => ({
    append: vitest_1.vi.fn(),
    get: vitest_1.vi.fn(),
    set: vitest_1.vi.fn(),
    delete: vitest_1.vi.fn(),
    has: vitest_1.vi.fn(),
    entries: vitest_1.vi.fn(() => []),
    keys: vitest_1.vi.fn(() => []),
    values: vitest_1.vi.fn(() => []),
    forEach: vitest_1.vi.fn(),
}));
// Mock File constructor
global.File = vitest_1.vi.fn((bits, name, options) => ({
    name,
    size: bits[0]?.length || 0,
    type: options?.type || 'application/octet-stream',
    lastModified: Date.now(),
    slice: vitest_1.vi.fn(),
    stream: vitest_1.vi.fn(),
    text: vitest_1.vi.fn(),
    arrayBuffer: vitest_1.vi.fn(),
}));
// Mock Image for preview generation
global.Image = vitest_1.vi.fn().mockImplementation(() => ({
    onload: null,
    onerror: null,
    width: 1920,
    height: 1080,
    set src(value) {
        setTimeout(() => this.onload?.(), 0);
    },
}));
// Mock FileReader for preview generation
global.FileReader = vitest_1.vi.fn().mockImplementation(() => ({
    readAsDataURL: vitest_1.vi.fn(function () {
        setTimeout(() => {
            this.result = 'data:image/jpeg;base64,mock';
            this.onload?.();
        }, 0);
    }),
    result: null,
    onload: null,
    onerror: null,
}));
(0, vitest_1.describe)('UnifiedUploadService Integration Tests', () => {
    let service;
    const mockFetch = global.fetch;
    (0, vitest_1.beforeEach)(() => {
        service = new UnifiedUploadService_1.UnifiedUploadService();
        vitest_1.vi.clearAllMocks();
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
    (0, vitest_1.afterEach)(() => {
        service.cancelAllUploads();
    });
    (0, vitest_1.describe)('single file upload', () => {
        (0, vitest_1.it)('should upload a file successfully', async () => {
            const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
            const progressEvents = [];
            const result = await service.uploadFile(file, {
                onProgress: ({ progress }) => progressEvents.push(progress),
            });
            (0, vitest_1.expect)(result.status).toBe('complete');
            (0, vitest_1.expect)(result.result).toEqual({
                id: 'upload_123',
                url: 'https://example.com/uploads/image.jpg',
                thumbnailUrl: 'https://example.com/uploads/thumb.jpg',
            });
            (0, vitest_1.expect)(progressEvents.length).toBeGreaterThan(0);
            (0, vitest_1.expect)(progressEvents[progressEvents.length - 1]).toBe(100);
        });
        (0, vitest_1.it)('should handle upload with metadata', async () => {
            const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
            const metadata = {
                projectId: 'proj_123',
                description: 'Test image',
                tags: ['test', 'sample'],
            };
            await service.uploadFile(file, { metadata });
            (0, vitest_1.expect)(mockFetch).toHaveBeenCalledWith(vitest_1.expect.any(String), vitest_1.expect.objectContaining({
                method: 'POST',
                body: vitest_1.expect.any(FormData),
            }));
        });
        (0, vitest_1.it)('should handle upload errors', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
            });
            const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
            await (0, vitest_1.expect)(service.uploadFile(file))
                .rejects.toThrow('Upload failed');
        });
        (0, vitest_1.it)('should retry on failure', async () => {
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
            const result = await service.uploadFile(file);
            (0, vitest_1.expect)(attempts).toBe(3);
            (0, vitest_1.expect)(result.status).toBe('complete');
        });
        (0, vitest_1.it)('should handle upload cancellation', async () => {
            const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
            // Delay the mock response
            mockFetch.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));
            const uploadPromise = service.uploadFile(file);
            // Cancel after starting
            setTimeout(() => service.cancelUpload(file.id), 50);
            await (0, vitest_1.expect)(uploadPromise).rejects.toThrow();
            const queue = service.getUploadQueue();
            const uploadFile = queue.find(f => f.file === file);
            (0, vitest_1.expect)(uploadFile?.status).toBe('cancelled');
        });
    });
    (0, vitest_1.describe)('batch upload', () => {
        (0, vitest_1.it)('should upload multiple files', async () => {
            const files = [
                new File(['content1'], 'file1.jpg', { type: 'image/jpeg' }),
                new File(['content2'], 'file2.jpg', { type: 'image/jpeg' }),
                new File(['content3'], 'file3.jpg', { type: 'image/jpeg' }),
            ];
            const result = await service.uploadFiles(files);
            (0, vitest_1.expect)(result.successful).toHaveLength(3);
            (0, vitest_1.expect)(result.failed).toHaveLength(0);
            (0, vitest_1.expect)(result.totalFiles).toBe(3);
            (0, vitest_1.expect)(mockFetch).toHaveBeenCalledTimes(3);
        });
        (0, vitest_1.it)('should handle partial failures in batch', async () => {
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
            const result = await service.uploadFiles(files);
            (0, vitest_1.expect)(result.successful).toHaveLength(2);
            (0, vitest_1.expect)(result.failed).toHaveLength(1);
            (0, vitest_1.expect)(result.failed[0].file.name).toBe('file2.jpg');
        });
        (0, vitest_1.it)('should respect concurrency limits', async () => {
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
            const files = Array.from({ length: 5 }, (_, i) => new File([`content${i}`], `file${i}.jpg`, { type: 'image/jpeg' }));
            await service.uploadFiles(files);
            (0, vitest_1.expect)(maxConcurrent).toBeLessThanOrEqual(2);
        });
    });
    (0, vitest_1.describe)('chunked upload', () => {
        (0, vitest_1.it)('should use chunked upload for large files', async () => {
            service.setConfig({
                enableChunking: true,
                chunkSize: 5 * 1024 * 1024, // 5MB
            });
            // Create a "large" file (mock 15MB)
            const largeFile = {
                name: 'large.jpg',
                size: 15 * 1024 * 1024,
                type: 'image/jpeg',
                slice: vitest_1.vi.fn((start, end) => ({
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
            const progressEvents = [];
            const result = await service.uploadFile(largeFile, {
                onProgress: ({ progress }) => progressEvents.push(progress),
            });
            (0, vitest_1.expect)(result.status).toBe('complete');
            // Should call init, 3 chunks, and complete
            (0, vitest_1.expect)(mockFetch).toHaveBeenCalledTimes(5);
            // Check progress events
            (0, vitest_1.expect)(progressEvents.length).toBeGreaterThan(0);
            (0, vitest_1.expect)(progressEvents[progressEvents.length - 1]).toBe(100);
        });
        (0, vitest_1.it)('should handle chunk upload failures', async () => {
            service.setConfig({
                enableChunking: true,
                chunkSize: 5 * 1024 * 1024,
            });
            const largeFile = {
                name: 'large.jpg',
                size: 10 * 1024 * 1024,
                type: 'image/jpeg',
                slice: vitest_1.vi.fn(() => ({ size: 5 * 1024 * 1024 })),
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
            await (0, vitest_1.expect)(service.uploadFile(largeFile))
                .rejects.toThrow();
        });
    });
    (0, vitest_1.describe)('file validation', () => {
        (0, vitest_1.it)('should validate file size', async () => {
            service.setConfig({ maxFileSize: 1024 * 1024 }); // 1MB
            const smallFile = new File(['small'], 'small.jpg', { type: 'image/jpeg' });
            const largeFile = {
                name: 'large.jpg',
                size: 2 * 1024 * 1024,
                type: 'image/jpeg',
            };
            const smallResult = await service.validateFile(smallFile);
            const largeResult = await service.validateFile(largeFile);
            (0, vitest_1.expect)(smallResult.valid).toBe(true);
            (0, vitest_1.expect)(largeResult.valid).toBe(false);
            (0, vitest_1.expect)(largeResult.error).toContain('exceeds maximum');
        });
        (0, vitest_1.it)('should validate file types', async () => {
            service.setConfig({
                acceptedTypes: ['image/jpeg', 'image/png'],
                acceptedExtensions: ['.jpg', '.jpeg', '.png'],
            });
            const jpegFile = new File(['jpeg'], 'image.jpg', { type: 'image/jpeg' });
            const pdfFile = new File(['pdf'], 'doc.pdf', { type: 'application/pdf' });
            const jpegResult = await service.validateFile(jpegFile);
            const pdfResult = await service.validateFile(pdfFile);
            (0, vitest_1.expect)(jpegResult.valid).toBe(true);
            (0, vitest_1.expect)(pdfResult.valid).toBe(false);
            (0, vitest_1.expect)(pdfResult.error).toContain('type is not accepted');
        });
        (0, vitest_1.it)('should check image dimensions', async () => {
            const file = new File(['image'], 'test.jpg', { type: 'image/jpeg' });
            const result = await service.validateFile(file);
            (0, vitest_1.expect)(result.valid).toBe(true);
            (0, vitest_1.expect)(result.metadata?.dimensions).toEqual({
                width: 1920,
                height: 1080,
            });
        });
    });
    (0, vitest_1.describe)('progress tracking', () => {
        (0, vitest_1.it)('should track individual file progress', async () => {
            const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
            const progressUpdates = [];
            await service.uploadFile(file, {
                onProgress: (update) => progressUpdates.push(update),
            });
            (0, vitest_1.expect)(progressUpdates.length).toBeGreaterThan(0);
            const lastUpdate = progressUpdates[progressUpdates.length - 1];
            (0, vitest_1.expect)(lastUpdate.progress).toBe(100);
            (0, vitest_1.expect)(lastUpdate.loaded).toBe(lastUpdate.total);
        });
        (0, vitest_1.it)('should track overall batch progress', async () => {
            const files = [
                new File(['content1'], 'file1.jpg', { type: 'image/jpeg' }),
                new File(['content2'], 'file2.jpg', { type: 'image/jpeg' }),
            ];
            const batchProgress = [];
            await service.uploadFiles(files, {
                onBatchProgress: ({ overallProgress }) => {
                    batchProgress.push(overallProgress);
                },
            });
            (0, vitest_1.expect)(batchProgress.length).toBeGreaterThan(0);
            (0, vitest_1.expect)(batchProgress[batchProgress.length - 1]).toBe(100);
        });
    });
    (0, vitest_1.describe)('upload strategies', () => {
        (0, vitest_1.it)('should select appropriate strategy based on file', async () => {
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
                const spy = vitest_1.vi.spyOn(service, 'selectUploadStrategy');
                try {
                    await service.uploadFile(file);
                }
                catch {
                    // Some might fail, that's ok for this test
                }
                (0, vitest_1.expect)(spy).toHaveBeenCalled();
                spy.mockRestore();
            }
        });
    });
    (0, vitest_1.describe)('error recovery', () => {
        (0, vitest_1.it)('should implement exponential backoff on retries', async () => {
            const delays = [];
            let lastCallTime = Date.now();
            mockFetch.mockImplementation(() => {
                const now = Date.now();
                delays.push(now - lastCallTime);
                lastCallTime = now;
                return Promise.reject(new Error('Network error'));
            });
            const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
            try {
                await service.uploadFile(file);
            }
            catch {
                // Expected to fail after retries
            }
            // Check that delays increase
            for (let i = 2; i < delays.length; i++) {
                (0, vitest_1.expect)(delays[i]).toBeGreaterThan(delays[i - 1] * 0.8); // Allow some variance
            }
        });
        (0, vitest_1.it)('should handle network timeouts', async () => {
            service.setConfig({ uploadTimeout: 100 }); // 100ms timeout
            mockFetch.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 200)));
            const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
            await (0, vitest_1.expect)(service.uploadFile(file))
                .rejects.toThrow('timeout');
        });
    });
    (0, vitest_1.describe)('preview generation', () => {
        (0, vitest_1.it)('should generate previews for images', async () => {
            const file = new File(['image'], 'test.jpg', { type: 'image/jpeg' });
            const preview = await service.generatePreview(file);
            (0, vitest_1.expect)(preview).toBe('data:image/jpeg;base64,mock');
        });
        (0, vitest_1.it)('should handle preview generation errors', async () => {
            const fileReader = global.FileReader;
            fileReader.mockImplementationOnce(() => ({
                readAsDataURL: vitest_1.vi.fn(function () {
                    setTimeout(() => this.onerror?.(new Error('Read error')), 0);
                }),
                onerror: null,
            }));
            const file = new File(['image'], 'test.jpg', { type: 'image/jpeg' });
            const preview = await service.generatePreview(file);
            (0, vitest_1.expect)(preview).toBeNull();
        });
    });
});
//# sourceMappingURL=UnifiedUploadService.integration.test.js.map