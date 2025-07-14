import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MockApiClientProvider } from '../../lib/__mocks__/enhanced/apiClient';
import { useImageApi } from '../../hooks/api/useImageApi';
import { ImageStatus } from '@spheroseg/types';

// Mock image data
const mockImages = [
  {
    id: 'image-1',
    projectId: 'project-1',
    filename: 'test1.jpg',
    originalFilename: 'original1.jpg',
    status: ImageStatus.PROCESSED,
    width: 800,
    height: 600,
    fileSize: 250000,
    mimeType: 'image/jpeg',
    createdAt: '2023-06-01T12:00:00Z',
    updatedAt: '2023-06-01T12:10:00Z',
  },
  {
    id: 'image-2',
    projectId: 'project-1',
    filename: 'test2.jpg',
    originalFilename: 'original2.jpg',
    status: ImageStatus.PENDING,
    width: 1024,
    height: 768,
    fileSize: 400000,
    mimeType: 'image/jpeg',
    createdAt: '2023-06-02T12:00:00Z',
    updatedAt: '2023-06-02T12:00:00Z',
  },
];

// Mock file for upload tests
const createMockFile = () => {
  const blob = new Blob(['mock file content'], { type: 'image/jpeg' });
  return new File([blob], 'test-upload.jpg', { type: 'image/jpeg' });
};

describe.skip('Image API Integration Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mock FormData since it's not available in the test environment
    global.FormData = class FormData {
      private data = new Map();
      append(key: string, value: any) {
        this.data.set(key, value);
      }
      get(key: string) {
        return this.data.get(key);
      }
      // Add other methods as needed
    } as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('fetchProjectImages', () => {
    it('should fetch project images successfully', async () => {
      const { result } = renderHook(() => useImageApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              getProjectImages: {
                data: mockImages,
                status: 200,
              },
            }}
          >
            {children}
          </MockApiClientProvider>
        ),
      });

      let images;
      await act(async () => {
        images = await result.current.fetchProjectImages('project-1');
      });

      expect(images).toEqual(mockImages);
    });

    it('should handle project not found error', async () => {
      const { result } = renderHook(() => useImageApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              getProjectImages: {
                error: new Error('Project not found'),
                status: 404,
              },
            }}
          >
            {children}
          </MockApiClientProvider>
        ),
      });

      await act(async () => {
        await expect(result.current.fetchProjectImages('non-existent')).rejects.toThrow('Project not found');
      });
    });

    it('should handle unauthorized access', async () => {
      const { result } = renderHook(() => useImageApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              getProjectImages: {
                error: new Error('Unauthorized access'),
                status: 403,
              },
            }}
          >
            {children}
          </MockApiClientProvider>
        ),
      });

      await act(async () => {
        await expect(result.current.fetchProjectImages('project-1')).rejects.toThrow('Unauthorized access');
      });
    });
  });

  describe('uploadImage', () => {
    it('should upload an image successfully', async () => {
      const mockFile = createMockFile();
      const uploadedImage = {
        id: 'new-image-id',
        projectId: 'project-1',
        filename: 'new-image.jpg',
        originalFilename: 'test-upload.jpg',
        status: ImageStatus.PENDING,
        width: 1280,
        height: 720,
        fileSize: 350000,
        mimeType: 'image/jpeg',
        createdAt: '2023-06-10T12:00:00Z',
        updatedAt: '2023-06-10T12:00:00Z',
      };

      const { result } = renderHook(() => useImageApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              uploadImage: {
                data: uploadedImage,
                status: 201,
              },
            }}
          >
            {children}
          </MockApiClientProvider>
        ),
      });

      let response;
      await act(async () => {
        response = await result.current.uploadImage('project-1', mockFile);
      });

      expect(response).toEqual(uploadedImage);
    });

    it('should handle invalid file type error', async () => {
      // Create a text file instead of an image
      const blob = new Blob(['text content'], { type: 'text/plain' });
      const invalidFile = new File([blob], 'not-an-image.txt', {
        type: 'text/plain',
      });

      const { result } = renderHook(() => useImageApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              uploadImage: {
                error: new Error('Invalid file type. Only images are allowed.'),
                status: 400,
              },
            }}
          >
            {children}
          </MockApiClientProvider>
        ),
      });

      await act(async () => {
        await expect(result.current.uploadImage('project-1', invalidFile)).rejects.toThrow('Invalid file type');
      });
    });

    it('should handle file size limit exceeded', async () => {
      const mockFile = createMockFile();

      const { result } = renderHook(() => useImageApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              uploadImage: {
                error: new Error('File size exceeds the limit of 10MB'),
                status: 400,
              },
            }}
          >
            {children}
          </MockApiClientProvider>
        ),
      });

      await act(async () => {
        await expect(result.current.uploadImage('project-1', mockFile)).rejects.toThrow('File size exceeds the limit');
      });
    });

    it('should handle upload progress events', async () => {
      const mockFile = createMockFile();
      const uploadedImage = {
        id: 'new-image-id',
        projectId: 'project-1',
        filename: 'new-image.jpg',
        originalFilename: 'test-upload.jpg',
        status: ImageStatus.PENDING,
        width: 1280,
        height: 720,
        fileSize: 350000,
        mimeType: 'image/jpeg',
        createdAt: '2023-06-10T12:00:00Z',
        updatedAt: '2023-06-10T12:00:00Z',
      };

      const progressCallback = vi.fn();

      const { result } = renderHook(() => useImageApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              uploadImage: {
                data: uploadedImage,
                status: 201,
                // Simulate progress events
                progressEvents: [
                  { loaded: 100000, total: 350000 }, // ~28%
                  { loaded: 200000, total: 350000 }, // ~57%
                  { loaded: 350000, total: 350000 }, // 100%
                ],
              },
            }}
          >
            {children}
          </MockApiClientProvider>
        ),
      });

      let response;
      await act(async () => {
        response = await result.current.uploadImage('project-1', mockFile, progressCallback);
      });

      expect(response).toEqual(uploadedImage);
      expect(progressCallback).toHaveBeenCalledTimes(3);
      expect(progressCallback).toHaveBeenCalledWith(expect.objectContaining({ progress: expect.any(Number) }));
      // Check last call was with 100%
      expect(progressCallback).toHaveBeenLastCalledWith(expect.objectContaining({ progress: 100 }));
    });
  });

  describe('deleteImage', () => {
    it('should delete an image successfully', async () => {
      const { result } = renderHook(() => useImageApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              deleteImage: {
                data: { success: true },
                status: 200,
              },
            }}
          >
            {children}
          </MockApiClientProvider>
        ),
      });

      let response;
      await act(async () => {
        response = await result.current.deleteImage('project-1', 'image-1');
      });

      expect(response.success).toBe(true);
    });

    it('should handle image not found error', async () => {
      const { result } = renderHook(() => useImageApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              deleteImage: {
                error: new Error('Image not found'),
                status: 404,
              },
            }}
          >
            {children}
          </MockApiClientProvider>
        ),
      });

      await act(async () => {
        await expect(result.current.deleteImage('project-1', 'non-existent')).rejects.toThrow('Image not found');
      });
    });

    it('should handle unauthorized deletion', async () => {
      const { result } = renderHook(() => useImageApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              deleteImage: {
                error: new Error('Unauthorized to delete this image'),
                status: 403,
              },
            }}
          >
            {children}
          </MockApiClientProvider>
        ),
      });

      await act(async () => {
        await expect(result.current.deleteImage('project-1', 'image-1')).rejects.toThrow(
          'Unauthorized to delete this image',
        );
      });
    });
  });

  describe('getImageDetails', () => {
    it('should fetch image details successfully', async () => {
      const imageDetails = {
        ...mockImages[0],
        metadata: {
          location: { lat: 40.7128, lng: -74.006 },
          captureDate: '2023-05-30T10:15:00Z',
          camera: 'iPhone 13 Pro',
        },
      };

      const { result } = renderHook(() => useImageApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              getImageDetails: {
                data: imageDetails,
                status: 200,
              },
            }}
          >
            {children}
          </MockApiClientProvider>
        ),
      });

      let details;
      await act(async () => {
        details = await result.current.getImageDetails('project-1', 'image-1');
      });

      expect(details).toEqual(imageDetails);
    });

    it('should handle image not found error', async () => {
      const { result } = renderHook(() => useImageApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              getImageDetails: {
                error: new Error('Image not found'),
                status: 404,
              },
            }}
          >
            {children}
          </MockApiClientProvider>
        ),
      });

      await act(async () => {
        await expect(result.current.getImageDetails('project-1', 'non-existent')).rejects.toThrow('Image not found');
      });
    });
  });

  describe('updateImageStatus', () => {
    it('should update image status successfully', async () => {
      const updatedImage = {
        ...mockImages[1],
        status: ImageStatus.PROCESSED,
        updatedAt: '2023-06-10T15:30:00Z',
      };

      const { result } = renderHook(() => useImageApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              updateImageStatus: {
                data: updatedImage,
                status: 200,
              },
            }}
          >
            {children}
          </MockApiClientProvider>
        ),
      });

      let image;
      await act(async () => {
        image = await result.current.updateImageStatus('project-1', 'image-2', ImageStatus.PROCESSED);
      });

      expect(image).toEqual(updatedImage);
    });

    it('should handle invalid status value', async () => {
      const { result } = renderHook(() => useImageApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              updateImageStatus: {
                error: new Error('Invalid status value'),
                status: 400,
              },
            }}
          >
            {children}
          </MockApiClientProvider>
        ),
      });

      await act(async () => {
        // @ts-ignore - Intentionally passing invalid status
        await expect(result.current.updateImageStatus('project-1', 'image-1', 'invalid_status')).rejects.toThrow(
          'Invalid status value',
        );
      });
    });
  });
});
