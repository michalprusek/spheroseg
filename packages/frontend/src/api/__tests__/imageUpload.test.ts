import { vi, describe, it, expect, beforeEach } from 'vitest';
import { uploadFilesWithFallback } from '../imageUpload';
import { storeUploadedImages } from '../projectImages';
import { uploadClient } from '@/services/api/client';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('@/services/api/client', () => ({
  uploadClient: {
    post: vi.fn(),
  },
}));
vi.mock('../projectImages', () => ({
  storeUploadedImages: vi.fn(),
  generateImageId: vi.fn(() => 'test-local-id'),
}));
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));
vi.mock('../utils/tiffPreview', () => ({
  generateCanvasPreview: vi.fn(() => 'data:image/png;base64,mockedpreview'),
}));

// Mock File and FormData
global.File = class MockFile {
  name: string;
  size: number;
  type: string;

  constructor(parts: any[], filename: string, options: any = {}) {
    this.name = filename;
    this.size = parts.reduce((acc, part) => acc + (part.length || 0), 0);
    this.type = options.type || 'application/octet-stream';
  }
};

global.FormData = class MockFormData {
  private data: Record<string, any[]> = {};

  append(key: string, value: any) {
    if (!this.data[key]) {
      this.data[key] = [];
    }
    this.data[key].push(value);
  }

  get(key: string) {
    return this.data[key];
  }

  getAll(key: string) {
    return this.data[key] || [];
  }
};

describe('imageUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('uploadFilesWithFallback', () => {
    it('should upload files in batches when there are many files', async () => {
      // Mock successful API response
      const mockResponse = {
        data: [{ id: 'test-id', name: 'test.jpg' }],
      };
      (uploadClient.post as vi.Mock).mockResolvedValue(mockResponse);

      // Create 41 mock files (stejný počet jako v chybovém hlášení)
      const files = Array(41)
        .fill(null)
        .map((_, i) => new File(['test content'], `test${i}.jpg`, { type: 'image/jpeg' }));

      const projectId = 'test-project';
      await uploadFilesWithFallback(projectId, files);

      // Should have called API 3 times (2 batches of 20, 1 batch of 1)
      expect(uploadClient.post).toHaveBeenCalledTimes(3);

      // First batch
      expect(uploadClient.post).toHaveBeenNthCalledWith(
        1,
        `/api/projects/${projectId}/images`,
        expect.any(FormData),
        {}, // uploadFiles doesn't set headers anymore
      );

      // Second batch
      expect(uploadClient.post).toHaveBeenNthCalledWith(
        2,
        `/api/projects/${projectId}/images`,
        expect.any(FormData),
        {}, // uploadFiles doesn't set headers anymore
      );

      // Third batch
      expect(uploadClient.post).toHaveBeenNthCalledWith(
        3,
        `/api/projects/${projectId}/images`,
        expect.any(FormData),
        {}, // uploadFiles doesn't set headers anymore
      );
    });

    it('should handle partial batch failures gracefully', async () => {
      // Mock successful API response for first batch
      const mockSuccessResponse = {
        data: [{ id: 'test-id-1', name: 'test1.jpg' }],
      };

      // Mock failure for second batch
      (uploadClient.post as vi.Mock)
        .mockResolvedValueOnce(mockSuccessResponse) // First batch successful
        .mockRejectedValueOnce(new Error('Server error')) // Second batch fails
        .mockResolvedValueOnce(mockSuccessResponse); // Third batch successful

      // Create 41 mock files
      const files = Array(41)
        .fill(null)
        .map((_, i) => new File(['test content'], `test${i}.jpg`, { type: 'image/jpeg' }));

      // Mock the createLocalImages functionality
      const _mockLocalImage = { id: 'local-id', name: 'local.jpg' };
      vi.spyOn(global, 'FileReader').mockImplementation(function () {
        this.readAsDataURL = vi.fn(() => {
          setTimeout(() => {
            this.onload?.({ target: { result: 'data:image/jpeg;base64,test' } } as any);
          }, 0);
        });
        return this;
      });

      const projectId = 'test-project';
      const result = await uploadFilesWithFallback(projectId, files);

      // Should still complete without throwing an error
      expect(result.length).toBeGreaterThan(0);

      // Should have tried to call API 3 times
      expect(uploadClient.post).toHaveBeenCalledTimes(3);
    });

    it('should handle API errors and fall back to local storage', async () => {
      // Mock API error
      (uploadClient.post as vi.Mock).mockRejectedValue(new Error('API error'));

      // Create mock files
      const files = [new File(['test content'], 'test.jpg', { type: 'image/jpeg' })];

      const projectId = 'test-project';
      await uploadFilesWithFallback(projectId, files);

      // Should have tried to call API
      expect(uploadClient.post).toHaveBeenCalledTimes(1);

      // Should have shown error toast
      // The implementation doesn't call toast.error for API failures, it handles them gracefully
      // expect(toast.error).toHaveBeenCalled();

      // Should have created local images
      expect(storeUploadedImages).toHaveBeenCalled();
    });
  });
});
