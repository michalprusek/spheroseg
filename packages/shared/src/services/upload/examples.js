"use strict";
/**
 * Examples of using the Unified Upload Service
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomUploadStrategy = void 0;
exports.uploadSingleFile = uploadSingleFile;
exports.uploadBatch = uploadBatch;
exports.uploadAvatar = uploadAvatar;
exports.resumeInterruptedUploads = resumeInterruptedUploads;
exports.cancelUpload = cancelUpload;
exports.monitorUploads = monitorUploads;
exports.validateAndUpload = validateAndUpload;
exports.uploadWithProgressUI = uploadWithProgressUI;
exports.uploadWithRetry = uploadWithRetry;
const index_1 = require("./index");
// Example 1: Simple single file upload
async function uploadSingleFile(file) {
    try {
        const result = await index_1.uploadService.uploadFile(file, {
            projectId: 'project-123',
            onProgress: (progress) => {
                console.log(`Upload progress: ${progress.progress}%`);
            },
        });
        console.log('Upload complete:', result);
    }
    catch (error) {
        console.error('Upload failed:', error);
    }
}
// Example 2: Batch upload with custom configuration
async function uploadBatch(files) {
    // Configure for large files with chunking
    index_1.uploadService.setConfig({
        ...index_1.UPLOAD_PRESETS['IMAGE'],
        maxFileSize: 100 * 1024 * 1024, // 100MB
        enableChunking: true,
        chunkSize: 10 * 1024 * 1024, // 10MB chunks
    });
    const result = await index_1.uploadService.uploadFiles(files, {
        onProgress: (progress) => {
            console.log(`File ${progress.fileId}: ${progress.loaded}/${progress.total} bytes`);
        },
    });
    console.log(`Uploaded: ${result.successful.length}`);
    console.log(`Failed: ${result.failed.length}`);
}
// Example 3: Avatar upload with cropping
async function uploadAvatar(croppedImageData) {
    // Convert data URL to File
    const response = await fetch(croppedImageData);
    const blob = await response.blob();
    const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
    // Use avatar configuration
    index_1.uploadService.setConfig(index_1.UPLOAD_PRESETS['AVATAR'] || {});
    const result = await index_1.uploadService.uploadFile(file, {
        metadata: { type: 'avatar' },
    });
    return result.result?.url;
}
// Example 4: Resume interrupted upload
async function resumeInterruptedUploads() {
    const resumableUploads = index_1.uploadService.getResumableUploads();
    for (const upload of resumableUploads) {
        console.log(`Resuming upload: ${upload.fileName}`);
        try {
            await index_1.uploadService.resumeUpload(upload.uploadId);
        }
        catch (error) {
            console.error(`Failed to resume ${upload.fileName}:`, error);
        }
    }
}
// Example 5: Cancel specific upload
function cancelUpload(fileId) {
    index_1.uploadService.cancelUpload(fileId);
}
// Example 6: Monitor upload queue
function monitorUploads() {
    setInterval(() => {
        const queue = index_1.uploadService.getUploadQueue();
        console.log('Upload queue:', queue.map(f => ({
            name: f.name,
            status: f.status,
            progress: f.progress,
        })));
    }, 1000);
}
// Example 7: Custom upload strategy
const strategies_1 = require("./strategies");
class CustomUploadStrategy extends strategies_1.BaseUploadStrategy {
    constructor() {
        super(...arguments);
        this.name = 'custom';
    }
    canHandle(file) {
        return file.name.endsWith('.custom');
    }
    async upload(file, options) {
        // Custom upload logic
        console.log('Using custom upload strategy for', file.name);
        // Your custom implementation here
        const formData = this.createFormData(file, options);
        const response = await fetch('/api/custom-upload', {
            method: 'POST',
            body: formData,
        });
        return response.json();
    }
}
exports.CustomUploadStrategy = CustomUploadStrategy;
// Example 8: Validate files before upload
async function validateAndUpload(files) {
    const validFiles = [];
    for (const file of files) {
        const validation = await index_1.uploadService.validateFile(file);
        if (validation.valid) {
            validFiles.push(file);
            // Show warnings if any
            validation.warnings?.forEach(warning => {
                console.warn(`${file.name}: ${warning}`);
            });
        }
        else {
            console.error(`${file.name}: ${validation.error}`);
        }
    }
    if (validFiles.length > 0) {
        await index_1.uploadService.uploadFiles(validFiles);
    }
}
// Example 9: Progress tracking with UI updates
async function uploadWithProgressUI(file, progressElement) {
    const result = await index_1.uploadService.uploadFile(file, {
        onProgress: (progress) => {
            // Update progress bar
            progressElement.style.width = `${progress.progress}%`;
            progressElement.textContent = `${Math.round(progress.loaded / 1024)} KB / ${Math.round(progress.total / 1024)} KB`;
        },
    });
    return result;
}
// Example 10: Error handling and retry
async function uploadWithRetry(file, maxRetries = 3) {
    let attempts = 0;
    while (attempts < maxRetries) {
        try {
            const result = await index_1.uploadService.uploadFile(file);
            return result;
        }
        catch (error) {
            attempts++;
            if (attempts >= maxRetries) {
                throw error;
            }
            // Exponential backoff
            const delay = Math.pow(2, attempts) * 1000;
            console.log(`Retry attempt ${attempts} in ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}
//# sourceMappingURL=examples.js.map