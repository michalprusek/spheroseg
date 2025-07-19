"use strict";
/**
 * Example test for Upload Hooks
 *
 * Demonstrates how to test React hooks with the upload service
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const test_utils_1 = require("../test-utils");
const upload_1 = require("../../services/upload");
const api_1 = require("../mocks/api");
const files_1 = require("../mocks/files");
(0, vitest_1.describe)('useImageUpload', () => {
    (0, vitest_1.beforeEach)(() => {
        (0, api_1.setupAPIMocks)();
        (0, api_1.mockUploadEndpoints)();
    });
    (0, vitest_1.afterEach)(() => {
        (0, api_1.resetAPIMocks)();
    });
    (0, vitest_1.it)('should initialize with empty state', () => {
        const { result } = (0, test_utils_1.renderHook)(() => (0, upload_1.useImageUpload)());
        (0, vitest_1.expect)(result.current.files).toHaveLength(0);
        (0, vitest_1.expect)(result.current.isUploading).toBe(false);
        (0, vitest_1.expect)(result.current.uploadProgress).toBe(0);
    });
    (0, vitest_1.it)('should handle file selection', async () => {
        const onFilesSelected = vitest_1.vi.fn();
        const { result } = (0, test_utils_1.renderHook)(() => (0, upload_1.useImageUpload)({ onFilesSelected }));
        const files = [files_1.testFiles.smallJpeg(), files_1.testFiles.png()];
        await (0, test_utils_1.act)(async () => {
            // Manually trigger handleFilesSelected
            await result.current.uploadFiles(files);
        });
        await (0, test_utils_1.waitFor)(() => {
            (0, vitest_1.expect)(result.current.files).toHaveLength(2);
            (0, vitest_1.expect)(onFilesSelected).toHaveBeenCalledWith(files);
        });
    });
    (0, vitest_1.it)('should validate files on selection', async () => {
        const onError = vitest_1.vi.fn();
        const { result } = (0, test_utils_1.renderHook)(() => (0, upload_1.useImageUpload)({
            onError,
            config: {
                maxFileSize: 1 * 1024 * 1024, // 1MB
            }
        }));
        const files = [
            files_1.testFiles.smallJpeg(), // Valid
            files_1.testFiles.oversized(), // Too large
        ];
        await (0, test_utils_1.act)(async () => {
            // Manually trigger handleFilesSelected
            await result.current.uploadFiles(files);
        });
        await (0, test_utils_1.waitFor)(() => {
            (0, vitest_1.expect)(result.current.files).toHaveLength(1);
            (0, vitest_1.expect)(onError).toHaveBeenCalled();
        });
    });
    (0, vitest_1.it)('should upload files', async () => {
        const onUploadComplete = vitest_1.vi.fn();
        const { result } = (0, test_utils_1.renderHook)(() => (0, upload_1.useImageUpload)({ onUploadComplete }));
        // Select files
        const files = [files_1.testFiles.smallJpeg()];
        await (0, test_utils_1.act)(async () => {
            // Manually trigger handleFilesSelected
            await result.current.uploadFiles(files);
        });
        // Upload
        await (0, test_utils_1.act)(async () => {
            await result.current.uploadFiles();
        });
        await (0, test_utils_1.waitFor)(() => {
            (0, vitest_1.expect)(result.current.isUploading).toBe(false);
            (0, vitest_1.expect)(onUploadComplete).toHaveBeenCalled();
            (0, vitest_1.expect)(result.current.files[0]?.status).toBe('complete');
        });
    });
    (0, vitest_1.it)('should track upload progress', async () => {
        const progressValues = [];
        const { result } = (0, test_utils_1.renderHook)(() => (0, upload_1.useImageUpload)({
            onUploadProgress: (progress) => {
                progressValues.push(progress.progress);
            }
        }));
        const files = [files_1.testFiles.smallJpeg()];
        await (0, test_utils_1.act)(async () => {
            // Manually trigger handleFilesSelected
            await result.current.uploadFiles(files);
            await result.current.uploadFiles();
        });
        await (0, test_utils_1.waitFor)(() => {
            (0, vitest_1.expect)(progressValues.length).toBeGreaterThan(0);
            (0, vitest_1.expect)(result.current.uploadProgress).toBe(100);
        });
    });
    (0, vitest_1.it)('should handle upload cancellation', async () => {
        const { result } = (0, test_utils_1.renderHook)(() => (0, upload_1.useImageUpload)());
        const files = [files_1.testFiles.largeJpeg()];
        await (0, test_utils_1.act)(async () => {
            // Manually trigger handleFilesSelected
            await result.current.uploadFiles(files);
        });
        // Start upload
        (0, test_utils_1.act)(() => {
            result.current.uploadFiles();
        });
        // Cancel immediately
        (0, test_utils_1.act)(() => {
            result.current.cancelAllUploads();
        });
        await (0, test_utils_1.waitFor)(() => {
            (0, vitest_1.expect)(result.current.isUploading).toBe(false);
            (0, vitest_1.expect)(result.current.files[0]?.status).toBe('cancelled');
        });
    });
    (0, vitest_1.it)('should remove individual files', async () => {
        const { result } = (0, test_utils_1.renderHook)(() => (0, upload_1.useImageUpload)());
        const files = [files_1.testFiles.smallJpeg(), files_1.testFiles.png()];
        await (0, test_utils_1.act)(async () => {
            // Manually trigger handleFilesSelected
            await result.current.uploadFiles(files);
        });
        (0, vitest_1.expect)(result.current.files).toHaveLength(2);
        const fileToRemove = result.current.files[0];
        if (fileToRemove) {
            (0, test_utils_1.act)(() => {
                result.current.removeFile(fileToRemove.id);
            });
            (0, vitest_1.expect)(result.current.files).toHaveLength(1);
            (0, vitest_1.expect)(result.current.files[0]?.id).not.toBe(fileToRemove.id);
        }
    });
    (0, vitest_1.it)('should clear all files', async () => {
        const { result } = (0, test_utils_1.renderHook)(() => (0, upload_1.useImageUpload)());
        const files = [files_1.testFiles.smallJpeg(), files_1.testFiles.png()];
        await (0, test_utils_1.act)(async () => {
            // Manually trigger handleFilesSelected
            await result.current.uploadFiles(files);
        });
        (0, vitest_1.expect)(result.current.files).toHaveLength(2);
        (0, test_utils_1.act)(() => {
            result.current.clearFiles();
        });
        (0, vitest_1.expect)(result.current.files).toHaveLength(0);
        (0, vitest_1.expect)(result.current.uploadProgress).toBe(0);
    });
    (0, vitest_1.it)('should retry failed uploads', async () => {
        let attemptCount = 0;
        // Mock fetch to fail first time
        global.fetch = vitest_1.vi.fn().mockImplementation(() => {
            attemptCount++;
            if (attemptCount === 1) {
                return Promise.reject(new Error('Network error'));
            }
            return (0, api_1.mockUploadEndpoints)();
        });
        const { result } = (0, test_utils_1.renderHook)(() => (0, upload_1.useImageUpload)());
        const files = [files_1.testFiles.smallJpeg()];
        await (0, test_utils_1.act)(async () => {
            // Manually trigger handleFilesSelected
            await result.current.uploadFiles(files);
        });
        // First upload fails
        await (0, test_utils_1.act)(async () => {
            try {
                await result.current.uploadFiles();
            }
            catch {
                // Expected to fail
            }
        });
        (0, vitest_1.expect)(result.current.files[0]?.status).toBe('error');
        // Retry
        await (0, test_utils_1.act)(async () => {
            await result.current.retryFailed();
        });
        await (0, test_utils_1.waitFor)(() => {
            (0, vitest_1.expect)(result.current.files[0]?.status).toBe('complete');
            (0, vitest_1.expect)(attemptCount).toBe(2);
        });
    });
    (0, vitest_1.it)('should handle auto upload', async () => {
        const { result } = (0, test_utils_1.renderHook)(() => (0, upload_1.useImageUpload)({ autoUpload: true }));
        const files = [files_1.testFiles.smallJpeg()];
        await (0, test_utils_1.act)(async () => {
            // Manually trigger handleFilesSelected
            await result.current.uploadFiles(files);
        });
        // Should start uploading automatically
        await (0, test_utils_1.waitFor)(() => {
            (0, vitest_1.expect)(result.current.files[0]?.status).toBe('complete');
        });
    });
    (0, vitest_1.it)('should generate previews', async () => {
        const { result } = (0, test_utils_1.renderHook)(() => (0, upload_1.useImageUpload)({ generatePreviews: true }));
        const files = [files_1.testFiles.smallJpeg()];
        await (0, test_utils_1.act)(async () => {
            // Manually trigger handleFilesSelected
            await result.current.uploadFiles(files);
        });
        await (0, test_utils_1.waitFor)(() => {
            (0, vitest_1.expect)(result.current.files[0]?.preview).toBeDefined();
            (0, vitest_1.expect)(result.current.files[0]?.preview).toContain('data:');
        });
    });
    (0, vitest_1.describe)('dropzone integration', () => {
        (0, vitest_1.it)('should handle drag and drop', async () => {
            const { result } = (0, test_utils_1.renderHook)(() => (0, upload_1.useImageUpload)());
            const { getRootProps } = result.current;
            // Simulate drop
            const files = [files_1.testFiles.smallJpeg()];
            const dropEvent = new Event('drop');
            dropEvent.dataTransfer = {
                files: files,
            };
            const rootProps = getRootProps();
            await (0, test_utils_1.act)(async () => {
                rootProps.onDrop(files, [], dropEvent);
            });
            await (0, test_utils_1.waitFor)(() => {
                (0, vitest_1.expect)(result.current.files).toHaveLength(1);
            });
        });
        (0, vitest_1.it)('should indicate drag active state', () => {
            const { result } = (0, test_utils_1.renderHook)(() => (0, upload_1.useImageUpload)());
            (0, vitest_1.expect)(result.current.isDragActive).toBe(false);
            const rootProps = result.current.getRootProps();
            (0, test_utils_1.act)(() => {
                rootProps.onDragEnter(new Event('dragenter'));
            });
            (0, vitest_1.expect)(result.current.isDragActive).toBe(true);
            (0, test_utils_1.act)(() => {
                rootProps.onDragLeave(new Event('dragleave'));
            });
            (0, vitest_1.expect)(result.current.isDragActive).toBe(false);
        });
    });
});
//# sourceMappingURL=upload-hook.test.js.map