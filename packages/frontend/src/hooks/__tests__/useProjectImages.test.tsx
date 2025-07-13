import { renderHook, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useProjectImages } from '../useProjectImages';
import apiClient from '@/lib/apiClient';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock dependencies
vi.mock('@/lib/apiClient');
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe('useProjectImages', () => {
  let queryClient: QueryClient;

  const mockImages = [
    {
      id: '1',
      name: 'image1.jpg',
      url: '/images/1.jpg',
      thumbnailUrl: '/thumbnails/1.jpg',
      segmentationStatus: 'completed',
      uploadedAt: '2024-01-01T10:00:00Z',
      width: 1920,
      height: 1080,
      fileSize: 2048000,
    },
    {
      id: '2',
      name: 'image2.jpg',
      url: '/images/2.jpg',
      thumbnailUrl: '/thumbnails/2.jpg',
      segmentationStatus: 'processing',
      uploadedAt: '2024-01-02T10:00:00Z',
      width: 1280,
      height: 720,
      fileSize: 1024000,
    },
  ];

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch images successfully', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        images: mockImages,
        total: 2,
        hasMore: false,
      },
    });

    const { result } = renderHook(() => useProjectImages('project-123'), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.images).toEqual([]);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.images).toEqual(mockImages);
    expect(result.current.error).toBeNull();
    expect(result.current.hasMore).toBe(false);
    expect(apiClient.get).toHaveBeenCalledWith('/projects/project-123/images', {
      params: { limit: 20, offset: 0 },
    });
  });

  it('should handle error when fetching images', async () => {
    const mockError = new Error('Failed to fetch images');
    vi.mocked(apiClient.get).mockRejectedValueOnce(mockError);

    const { result } = renderHook(() => useProjectImages('project-123'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe(mockError);
    expect(result.current.images).toEqual([]);
  });

  it('should load more images when hasMore is true', async () => {
    // First page
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        images: mockImages.slice(0, 1),
        total: 2,
        hasMore: true,
      },
    });

    const { result } = renderHook(() => useProjectImages('project-123'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.images).toHaveLength(1);
    expect(result.current.hasMore).toBe(true);

    // Load more
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        images: mockImages.slice(1, 2),
        total: 2,
        hasMore: false,
      },
    });

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.images).toHaveLength(2);
    expect(result.current.hasMore).toBe(false);
    expect(apiClient.get).toHaveBeenCalledWith('/projects/project-123/images', {
      params: { limit: 20, offset: 1 },
    });
  });

  it('should not load more when already loading', async () => {
    vi.mocked(apiClient.get).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    const { result } = renderHook(() => useProjectImages('project-123'), { wrapper });

    // Try to load more while initial load is in progress
    await act(async () => {
      result.current.loadMore();
    });

    // Should only have made one call
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  });

  it('should refetch images', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        images: mockImages,
        total: 2,
        hasMore: false,
      },
    });

    const { result } = renderHook(() => useProjectImages('project-123'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Update mock for refetch
    const updatedImages = [...mockImages, {
      id: '3',
      name: 'image3.jpg',
      url: '/images/3.jpg',
      thumbnailUrl: '/thumbnails/3.jpg',
      segmentationStatus: 'queued',
      uploadedAt: '2024-01-03T10:00:00Z',
      width: 800,
      height: 600,
      fileSize: 512000,
    }];

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        images: updatedImages,
        total: 3,
        hasMore: false,
      },
    });

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.images).toHaveLength(3);
    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });

  it('should handle empty project ID', () => {
    const { result } = renderHook(() => useProjectImages(''), { wrapper });

    expect(result.current.images).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it('should update image in cache', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        images: mockImages,
        total: 2,
        hasMore: false,
      },
    });

    const { result } = renderHook(() => useProjectImages('project-123'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Update an image
    const updatedImage = {
      ...mockImages[0],
      segmentationStatus: 'completed',
    };

    act(() => {
      queryClient.setQueryData(['projectImages', 'project-123'], (oldData: any) => ({
        ...oldData,
        pages: oldData.pages.map((page: any) => ({
          ...page,
          images: page.images.map((img: any) =>
            img.id === updatedImage.id ? updatedImage : img
          ),
        })),
      }));
    });

    expect(result.current.images[0].segmentationStatus).toBe('completed');
  });

  it('should handle pagination correctly', async () => {
    const pageSize = 2;
    const totalImages = 5;
    const allImages = Array.from({ length: totalImages }, (_, i) => ({
      id: `${i + 1}`,
      name: `image${i + 1}.jpg`,
      url: `/images/${i + 1}.jpg`,
      thumbnailUrl: `/thumbnails/${i + 1}.jpg`,
      segmentationStatus: 'completed',
      uploadedAt: '2024-01-01T10:00:00Z',
      width: 1920,
      height: 1080,
      fileSize: 2048000,
    }));

    // Mock paginated responses
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({
        data: {
          images: allImages.slice(0, pageSize),
          total: totalImages,
          hasMore: true,
        },
      })
      .mockResolvedValueOnce({
        data: {
          images: allImages.slice(pageSize, pageSize * 2),
          total: totalImages,
          hasMore: true,
        },
      })
      .mockResolvedValueOnce({
        data: {
          images: allImages.slice(pageSize * 2),
          total: totalImages,
          hasMore: false,
        },
      });

    const { result } = renderHook(
      () => useProjectImages('project-123', { pageSize }),
      { wrapper }
    );

    // Initial load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.images).toHaveLength(pageSize);

    // Load second page
    await act(async () => {
      await result.current.loadMore();
    });
    expect(result.current.images).toHaveLength(pageSize * 2);

    // Load third page
    await act(async () => {
      await result.current.loadMore();
    });
    expect(result.current.images).toHaveLength(totalImages);
    expect(result.current.hasMore).toBe(false);
  });

  it('should handle concurrent updates', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        images: mockImages,
        total: 2,
        hasMore: false,
      },
    });

    const { result } = renderHook(() => useProjectImages('project-123'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Simulate concurrent updates
    const updates = [
      { id: '1', segmentationStatus: 'processing' },
      { id: '2', segmentationStatus: 'completed' },
    ];

    act(() => {
      updates.forEach((update) => {
        queryClient.setQueryData(['projectImages', 'project-123'], (oldData: any) => ({
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            images: page.images.map((img: any) =>
              img.id === update.id ? { ...img, ...update } : img
            ),
          })),
        }));
      });
    });

    expect(result.current.images[0].segmentationStatus).toBe('processing');
    expect(result.current.images[1].segmentationStatus).toBe('completed');
  });

  it('should reset when project ID changes', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({
        data: {
          images: mockImages,
          total: 2,
          hasMore: false,
        },
      })
      .mockResolvedValueOnce({
        data: {
          images: [mockImages[0]],
          total: 1,
          hasMore: false,
        },
      });

    const { result, rerender } = renderHook(
      ({ projectId }) => useProjectImages(projectId),
      {
        wrapper,
        initialProps: { projectId: 'project-123' },
      }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.images).toHaveLength(2);

    // Change project ID
    rerender({ projectId: 'project-456' });

    await waitFor(() => {
      expect(result.current.images).toHaveLength(1);
    });

    expect(apiClient.get).toHaveBeenCalledWith('/projects/project-456/images', {
      params: { limit: 20, offset: 0 },
    });
  });
});