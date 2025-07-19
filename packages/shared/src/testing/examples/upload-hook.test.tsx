/**
 * Example test for Upload Hooks
 * 
 * Demonstrates how to test React hooks with the upload service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '../test-utils';
import { useImageUpload } from '../../services/upload';
import { setupAPIMocks, resetAPIMocks, mockUploadEndpoints } from '../mocks/api';
import { testFiles } from '../mocks/files';

describe('useImageUpload', () => {
  beforeEach(() => {
    setupAPIMocks();
    mockUploadEndpoints();
  });

  afterEach(() => {
    resetAPIMocks();
  });

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useImageUpload());

    expect(result.current.files).toHaveLength(0);
    expect(result.current.isUploading).toBe(false);
    expect(result.current.uploadProgress).toBe(0);
  });

  it('should handle file selection', async () => {
    const onFilesSelected = vi.fn();
    const { result } = renderHook(() => 
      useImageUpload({ onFilesSelected })
    );

    const files = [testFiles.smallJpeg(), testFiles.png()];

    await act(async () => {
      // Manually trigger handleFilesSelected
      await result.current.uploadFiles(files);
    });

    await waitFor(() => {
      expect(result.current.files).toHaveLength(2);
      expect(onFilesSelected).toHaveBeenCalledWith(files);
    });
  });

  it('should validate files on selection', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => 
      useImageUpload({ 
        onError,
        config: {
          maxFileSize: 1 * 1024 * 1024, // 1MB
        }
      })
    );

    const files = [
      testFiles.smallJpeg(), // Valid
      testFiles.oversized(), // Too large
    ];

    await act(async () => {
      // Manually trigger handleFilesSelected
      await result.current.uploadFiles(files);
    });

    await waitFor(() => {
      expect(result.current.files).toHaveLength(1);
      expect(onError).toHaveBeenCalled();
    });
  });

  it('should upload files', async () => {
    const onUploadComplete = vi.fn();
    const { result } = renderHook(() => 
      useImageUpload({ onUploadComplete })
    );

    // Select files
    const files = [testFiles.smallJpeg()];
    await act(async () => {
      // Manually trigger handleFilesSelected
      await result.current.uploadFiles(files);
    });

    // Upload
    await act(async () => {
      await result.current.uploadFiles();
    });

    await waitFor(() => {
      expect(result.current.isUploading).toBe(false);
      expect(onUploadComplete).toHaveBeenCalled();
      expect(result.current.files[0]?.status).toBe('complete');
    });
  });

  it('should track upload progress', async () => {
    const progressValues: number[] = [];
    const { result } = renderHook(() => 
      useImageUpload({
        onUploadProgress: (progress) => {
          progressValues.push(progress.progress);
        }
      })
    );

    const files = [testFiles.smallJpeg()];
    
    await act(async () => {
      // Manually trigger handleFilesSelected
      await result.current.uploadFiles(files);
      await result.current.uploadFiles();
    });

    await waitFor(() => {
      expect(progressValues.length).toBeGreaterThan(0);
      expect(result.current.uploadProgress).toBe(100);
    });
  });

  it('should handle upload cancellation', async () => {
    const { result } = renderHook(() => useImageUpload());

    const files = [testFiles.largeJpeg()];
    
    await act(async () => {
      // Manually trigger handleFilesSelected
      await result.current.uploadFiles(files);
    });

    // Start upload
    act(() => {
      result.current.uploadFiles();
    });

    // Cancel immediately
    act(() => {
      result.current.cancelAllUploads();
    });

    await waitFor(() => {
      expect(result.current.isUploading).toBe(false);
      expect(result.current.files[0]?.status).toBe('cancelled');
    });
  });

  it('should remove individual files', async () => {
    const { result } = renderHook(() => useImageUpload());

    const files = [testFiles.smallJpeg(), testFiles.png()];
    
    await act(async () => {
      // Manually trigger handleFilesSelected
      await result.current.uploadFiles(files);
    });

    expect(result.current.files).toHaveLength(2);

    const fileToRemove = result.current.files[0];
    
    if (fileToRemove) {
      act(() => {
        result.current.removeFile(fileToRemove.id);
      });

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0]?.id).not.toBe(fileToRemove.id);
    }
  });

  it('should clear all files', async () => {
    const { result } = renderHook(() => useImageUpload());

    const files = [testFiles.smallJpeg(), testFiles.png()];
    
    await act(async () => {
      // Manually trigger handleFilesSelected
      await result.current.uploadFiles(files);
    });

    expect(result.current.files).toHaveLength(2);

    act(() => {
      result.current.clearFiles();
    });

    expect(result.current.files).toHaveLength(0);
    expect(result.current.uploadProgress).toBe(0);
  });

  it('should retry failed uploads', async () => {
    let attemptCount = 0;
    
    // Mock fetch to fail first time
    global.fetch = vi.fn().mockImplementation(() => {
      attemptCount++;
      if (attemptCount === 1) {
        return Promise.reject(new Error('Network error'));
      }
      return mockUploadEndpoints();
    });

    const { result } = renderHook(() => useImageUpload());

    const files = [testFiles.smallJpeg()];
    
    await act(async () => {
      // Manually trigger handleFilesSelected
      await result.current.uploadFiles(files);
    });

    // First upload fails
    await act(async () => {
      try {
        await result.current.uploadFiles();
      } catch {
        // Expected to fail
      }
    });

    expect(result.current.files[0]?.status).toBe('error');

    // Retry
    await act(async () => {
      await result.current.retryFailed();
    });

    await waitFor(() => {
      expect(result.current.files[0]?.status).toBe('complete');
      expect(attemptCount).toBe(2);
    });
  });

  it('should handle auto upload', async () => {
    const { result } = renderHook(() => 
      useImageUpload({ autoUpload: true })
    );

    const files = [testFiles.smallJpeg()];

    await act(async () => {
      // Manually trigger handleFilesSelected
      await result.current.uploadFiles(files);
    });

    // Should start uploading automatically
    await waitFor(() => {
      expect(result.current.files[0]?.status).toBe('complete');
    });
  });

  it('should generate previews', async () => {
    const { result } = renderHook(() => 
      useImageUpload({ generatePreviews: true })
    );

    const files = [testFiles.smallJpeg()];

    await act(async () => {
      // Manually trigger handleFilesSelected
      await result.current.uploadFiles(files);
    });

    await waitFor(() => {
      expect(result.current.files[0]?.preview).toBeDefined();
      expect(result.current.files[0]?.preview).toContain('data:');
    });
  });

  describe('dropzone integration', () => {
    it('should handle drag and drop', async () => {
      const { result } = renderHook(() => useImageUpload());

      const { getRootProps } = result.current;
      
      // Simulate drop
      const files = [testFiles.smallJpeg()];
      const dropEvent = new Event('drop') as any;
      dropEvent.dataTransfer = {
        files: files,
      };

      const rootProps = getRootProps();
      
      await act(async () => {
        rootProps.onDrop(files, [], dropEvent);
      });

      await waitFor(() => {
        expect(result.current.files).toHaveLength(1);
      });
    });

    it('should indicate drag active state', () => {
      const { result } = renderHook(() => useImageUpload());

      expect(result.current.isDragActive).toBe(false);

      const rootProps = result.current.getRootProps();
      
      act(() => {
        rootProps.onDragEnter(new Event('dragenter'));
      });

      expect(result.current.isDragActive).toBe(true);

      act(() => {
        rootProps.onDragLeave(new Event('dragleave'));
      });

      expect(result.current.isDragActive).toBe(false);
    });
  });
});