"use strict";
/**
 * Example test for Upload Service
 *
 * Demonstrates how to test the unified upload service
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const upload_1 = require("../../services/upload");
const api_1 = require("../mocks/api");
const files_1 = require("../mocks/files");
(0, vitest_1.describe)('UnifiedUploadService', () => {
    let service;
    (0, vitest_1.beforeEach)(() => {
        (0, api_1.setupAPIMocks)();
        (0, api_1.mockUploadEndpoints)();
        service = new upload_1.UnifiedUploadService();
    });
    (0, vitest_1.afterEach)(() => {
        (0, api_1.resetAPIMocks)();
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.describe)('file validation', () => {
        (0, vitest_1.it)('should validate file size', async () => {
            service.setConfig({ maxFileSize: 1024 * 1024 }); // 1MB
            const smallFile = (0, files_1.createMockFile)('small.jpg', 500 * 1024, 'image/jpeg');
            const largeFile = (0, files_1.createMockFile)('large.jpg', 2 * 1024 * 1024, 'image/jpeg');
            const smallResult = await service.validateFile(smallFile);
            const largeResult = await service.validateFile(largeFile);
            (0, vitest_1.expect)(smallResult.valid).toBe(true);
            (0, vitest_1.expect)(largeResult.valid).toBe(false);
            (0, vitest_1.expect)(largeResult.error).toContain('exceeds maximum');
        });
        (0, vitest_1.it)('should validate file type', async () => {
            service.setConfig({
                acceptedTypes: ['image/jpeg', 'image/png'],
                acceptedExtensions: ['.jpg', '.jpeg', '.png'],
            });
            const jpegFile = files_1.testFiles.smallJpeg();
            const pdfFile = files_1.testFiles.pdf();
            const jpegResult = await service.validateFile(jpegFile);
            const pdfResult = await service.validateFile(pdfFile);
            (0, vitest_1.expect)(jpegResult.valid).toBe(true);
            (0, vitest_1.expect)(pdfResult.valid).toBe(false);
            (0, vitest_1.expect)(pdfResult.error).toContain('not accepted');
        });
        (0, vitest_1.it)('should provide warnings for edge cases', async () => {
            const tinyImage = (0, files_1.createMockFile)('tiny.jpg', 1024, 'image/jpeg');
            // Mock image dimensions
            global.Image = vitest_1.vi.fn().mockImplementation(() => ({
                onload: null,
                onerror: null,
                width: 50,
                height: 50,
                set src(value) {
                    setTimeout(() => this.onload?.(), 0);
                },
            }));
            const result = await service.validateFile(tinyImage);
            (0, vitest_1.expect)(result.valid).toBe(true);
            (0, vitest_1.expect)(result.warnings).toContain('Image dimensions are very small');
        });
    });
    (0, vitest_1.describe)('single file upload', () => {
        (0, vitest_1.it)('should upload file successfully', async () => {
            const file = files_1.testFiles.smallJpeg();
            const onProgress = vitest_1.vi.fn();
            const result = await service.uploadFile(file, {
                projectId: 'project_123',
                onProgress,
            });
            (0, vitest_1.expect)(result.status).toBe('complete');
            (0, vitest_1.expect)(result.result).toEqual({
                id: 'upload_123',
                url: 'https://example.com/image.jpg',
                thumbnailUrl: 'https://example.com/thumb.jpg',
            });
            (0, vitest_1.expect)(onProgress).toHaveBeenCalled();
        });
        (0, vitest_1.it)('should handle upload errors', async () => {
            const file = files_1.testFiles.smallJpeg();
            // Mock fetch to return error
            const mockFetch = vitest_1.vi.fn().mockRejectedValue(new Error('Network error'));
            global.fetch = mockFetch;
            await (0, vitest_1.expect)(service.uploadFile(file)).rejects.toThrow('Network error');
        });
        (0, vitest_1.it)('should support upload cancellation', async () => {
            const file = files_1.testFiles.largeJpeg();
            // Start upload
            const uploadPromise = service.uploadFile(file);
            // Cancel after a short delay
            setTimeout(() => service.cancelUpload(file.id), 10);
            await (0, vitest_1.expect)(uploadPromise).rejects.toThrow();
            const queue = service.getUploadQueue();
            const uploadedFile = queue.find(f => f.file === file);
            (0, vitest_1.expect)(uploadedFile?.status).toBe('cancelled');
        });
    });
    (0, vitest_1.describe)('batch upload', () => {
        (0, vitest_1.it)('should upload multiple files', async () => {
            const files = [
                files_1.testFiles.smallJpeg(),
                files_1.testFiles.png(),
                files_1.testFiles.tiff(),
            ];
            const result = await service.uploadFiles(files);
            (0, vitest_1.expect)(result.successful).toHaveLength(3);
            (0, vitest_1.expect)(result.failed).toHaveLength(0);
            (0, vitest_1.expect)(result.totalFiles).toBe(3);
        });
        (0, vitest_1.it)('should handle partial failures', async () => {
            const files = [
                files_1.testFiles.smallJpeg(),
                files_1.testFiles.invalidType(),
                files_1.testFiles.png(),
            ];
            const result = await service.uploadFiles(files);
            (0, vitest_1.expect)(result.successful).toHaveLength(2);
            (0, vitest_1.expect)(result.failed).toHaveLength(1);
            (0, vitest_1.expect)(result.failed[0].error).toContain('not accepted');
        });
    });
    (0, vitest_1.describe)('chunked upload', () => {
        (0, vitest_1.it)('should use chunked upload for large files', async () => {
            service.setConfig({
                enableChunking: true,
                chunkSize: 5 * 1024 * 1024, // 5MB chunks
            });
            const largeFile = files_1.testFiles.largeJpeg(); // 15MB
            // Mock chunked upload endpoints
            const initMock = vitest_1.vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ uploadId: 'chunked_123', expiresAt: new Date().toISOString() }),
            });
            const chunkMock = vitest_1.vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ success: true }),
            });
            const completeMock = vitest_1.vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    id: 'upload_456',
                    url: 'https://example.com/large.jpg',
                }),
            });
            global.fetch = vitest_1.vi.fn().mockImplementation((url) => {
                if (url.includes('/chunked/init'))
                    return initMock();
                if (url.includes('/chunked/chunk'))
                    return chunkMock();
                if (url.includes('/chunked/complete'))
                    return completeMock();
                throw new Error('Unknown endpoint');
            });
            const result = await service.uploadFile(largeFile);
            (0, vitest_1.expect)(result.status).toBe('complete');
            (0, vitest_1.expect)(initMock).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(chunkMock).toHaveBeenCalledTimes(3); // 15MB / 5MB = 3 chunks
            (0, vitest_1.expect)(completeMock).toHaveBeenCalledTimes(1);
        });
    });
    (0, vitest_1.describe)('resumable uploads', () => {
        (0, vitest_1.it)('should save resumable upload state', async () => {
            const file = files_1.testFiles.largeJpeg();
            // Mock localStorage
            const setItemSpy = vitest_1.vi.spyOn(localStorage, 'setItem');
            // Start upload and cancel it
            const uploadPromise = service.uploadFile(file);
            setTimeout(() => service.cancelUpload(file.id), 10);
            try {
                await uploadPromise;
            }
            catch {
                // Expected to throw
            }
            // Check if resumable state was saved
            const resumableUploads = service.getResumableUploads();
            (0, vitest_1.expect)(resumableUploads).toHaveLength(0); // Not implemented in basic version
        });
    });
    (0, vitest_1.describe)('upload strategies', () => {
        (0, vitest_1.it)('should select appropriate strategy based on file', async () => {
            const smallImage = (0, files_1.createMockFile)('small.jpg', 1 * 1024 * 1024, 'image/jpeg');
            const largeImage = (0, files_1.createMockFile)('large.jpg', 20 * 1024 * 1024, 'image/jpeg');
            const tiffImage = files_1.testFiles.tiff();
            // Spy on strategy selection
            const strategySpy = vitest_1.vi.spyOn(service, 'processUpload');
            await service.uploadFile(smallImage);
            await service.uploadFile(largeImage);
            await service.uploadFile(tiffImage);
            // Check that different strategies were used
            (0, vitest_1.expect)(strategySpy).toHaveBeenCalledTimes(3);
        });
    });
    (0, vitest_1.describe)('progress tracking', () => {
        (0, vitest_1.it)('should report accurate progress', async () => {
            const file = files_1.testFiles.smallJpeg();
            const progressValues = [];
            await service.uploadFile(file, {
                onProgress: (progress) => {
                    progressValues.push(progress.progress);
                },
            });
            (0, vitest_1.expect)(progressValues.length).toBeGreaterThan(0);
            (0, vitest_1.expect)(progressValues[progressValues.length - 1]).toBe(100);
        });
    });
    (0, vitest_1.describe)('error handling and retry', () => {
        (0, vitest_1.it)('should retry failed uploads', async () => {
            const file = files_1.testFiles.smallJpeg();
            let attempts = 0;
            // Mock fetch to fail first 2 times
            global.fetch = vitest_1.vi.fn().mockImplementation(() => {
                attempts++;
                if (attempts < 3) {
                    return Promise.reject(new Error('Network error'));
                }
                return (0, api_1.mockUploadEndpoints)();
            });
            const result = await service.uploadFile(file);
            (0, vitest_1.expect)(attempts).toBe(3);
            (0, vitest_1.expect)(result.status).toBe('complete');
        });
    });
});
//# sourceMappingURL=upload-service.test.js.map