/**
 * Examples of using the Unified Upload Service
 */

import { uploadService, UPLOAD_PRESETS } from './index';

// Example 1: Simple single file upload
async function uploadSingleFile(file: File) {
  try {
    const result = await uploadService.uploadFile(file, {
      projectId: 'project-123',
      onProgress: (progress) => {
        console.log(`Upload progress: ${progress.progress}%`);
      },
    });

    console.log('Upload complete:', result);
  } catch (error) {
    console.error('Upload failed:', error);
  }
}

// Example 2: Batch upload with custom configuration
async function uploadBatch(files: File[]) {
  // Configure for large files with chunking
  uploadService.setConfig({
    ...UPLOAD_PRESETS.IMAGE,
    maxFileSize: 100 * 1024 * 1024, // 100MB
    enableChunking: true,
    chunkSize: 10 * 1024 * 1024, // 10MB chunks
  });

  const result = await uploadService.uploadFiles(files, {
    onProgress: (progress, fileId) => {
      console.log(`File ${fileId}: ${progress.loaded}/${progress.total} bytes`);
    },
  });

  console.log(`Uploaded: ${result.successful.length}`);
  console.log(`Failed: ${result.failed.length}`);
}

// Example 3: Avatar upload with cropping
async function uploadAvatar(croppedImageData: string) {
  // Convert data URL to File
  const response = await fetch(croppedImageData);
  const blob = await response.blob();
  const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });

  // Use avatar configuration
  uploadService.setConfig(UPLOAD_PRESETS.AVATAR);

  const result = await uploadService.uploadFile(file, {
    metadata: { type: 'avatar' },
  });

  return result.result?.url;
}

// Example 4: Resume interrupted upload
async function resumeInterruptedUploads() {
  const resumableUploads = uploadService.getResumableUploads();
  
  for (const upload of resumableUploads) {
    console.log(`Resuming upload: ${upload.fileName}`);
    try {
      await uploadService.resumeUpload(upload.uploadId);
    } catch (error) {
      console.error(`Failed to resume ${upload.fileName}:`, error);
    }
  }
}

// Example 5: Cancel specific upload
function cancelUpload(fileId: string) {
  uploadService.cancelUpload(fileId);
}

// Example 6: Monitor upload queue
function monitorUploads() {
  setInterval(() => {
    const queue = uploadService.getUploadQueue();
    console.log('Upload queue:', queue.map(f => ({
      name: f.name,
      status: f.status,
      progress: f.progress,
    })));
  }, 1000);
}

// Example 7: Custom upload strategy
import { BaseUploadStrategy } from './strategies';

class CustomUploadStrategy extends BaseUploadStrategy {
  name = 'custom';

  canHandle(file: File): boolean {
    return file.name.endsWith('.custom');
  }

  async upload(file: File, options: any): Promise<any> {
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

// Example 8: Validate files before upload
async function validateAndUpload(files: File[]) {
  const validFiles: File[] = [];
  
  for (const file of files) {
    const validation = await uploadService.validateFile(file);
    
    if (validation.valid) {
      validFiles.push(file);
      
      // Show warnings if any
      validation.warnings?.forEach(warning => {
        console.warn(`${file.name}: ${warning}`);
      });
    } else {
      console.error(`${file.name}: ${validation.error}`);
    }
  }

  if (validFiles.length > 0) {
    return uploadService.uploadFiles(validFiles);
  }
}

// Example 9: Progress tracking with UI updates
async function uploadWithProgressUI(file: File, progressElement: HTMLElement) {
  const result = await uploadService.uploadFile(file, {
    onProgress: (progress) => {
      // Update progress bar
      progressElement.style.width = `${progress.progress}%`;
      progressElement.textContent = `${Math.round(progress.loaded / 1024)} KB / ${Math.round(progress.total / 1024)} KB`;
    },
  });

  return result;
}

// Example 10: Error handling and retry
async function uploadWithRetry(file: File, maxRetries = 3) {
  let attempts = 0;
  
  while (attempts < maxRetries) {
    try {
      const result = await uploadService.uploadFile(file);
      return result;
    } catch (error) {
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

export {
  uploadSingleFile,
  uploadBatch,
  uploadAvatar,
  resumeInterruptedUploads,
  cancelUpload,
  monitorUploads,
  CustomUploadStrategy,
  validateAndUpload,
  uploadWithProgressUI,
  uploadWithRetry,
};