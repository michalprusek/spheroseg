import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useSegmentationCore } from '../useSegmentationCore';
import '@testing-library/jest-dom';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('react-router-dom', () => ({
  useParams: vi.fn(() => ({
    projectId: 'project-123',
    imageId: 'image-123',
  })),
  useNavigate: vi.fn(() => vi.fn()),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: vi.fn(() => ({
    t: (key: string) => key, // Return the key as translation
  })),
}));

vi.mock('@/lib/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@/lib/urlUtils', () => ({
  constructUrl: vi.fn((path) => `https://example.com/${path}`),
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-123'),
}));

// Create test data
const mockProject = {
  id: 'project-123',
  title: 'Test Project',
  description: 'Test Description',
  created_at: '2023-01-01T00:00:00.000Z',
  updated_at: '2023-01-01T00:00:00.000Z',
  user_id: 'user-123',
};

const mockApiImage = {
  id: 'image-123',
  project_id: 'project-123',
  name: 'test-image.jpg',
  storage_path: 'uploads/test-image.jpg',
  thumbnail_path: 'thumbnails/test-image.jpg',
  created_at: '2023-01-01T00:00:00.000Z',
  updated_at: '2023-01-01T00:00:00.000Z',
  width: 800,
  height: 600,
  status: 'completed',
  segmentation_result: {
    path: 'results/test-image.json',
  },
};

// Mock segmentation response with contours (new format)
const mockSegmentationWithContours = {
  status: 'completed',
  result_data: {
    contours: [
      [
        [10, 10],
        [100, 10],
        [100, 100],
        [10, 100],
      ], // External contour
      [
        [30, 30],
        [70, 30],
        [70, 70],
        [30, 70],
      ], // Internal contour (hole)
    ],
    hierarchy: [
      [1, -1, -1, -1], // Next, Previous, First_Child, Parent
      [-1, 0, -1, 0], // Parent is the first contour
    ],
  },
};

// Mock segmentation response with polygons (old format)
const mockSegmentationWithPolygons = {
  status: 'completed',
  result_data: {
    polygons: [
      {
        id: 'poly-1',
        points: [
          { x: 10, y: 10 },
          { x: 100, y: 10 },
          { x: 100, y: 100 },
          { x: 10, y: 100 },
        ],
        color: 'red',
        type: 'external',
      },
      {
        id: 'poly-2',
        points: [
          { x: 30, y: 30 },
          { x: 70, y: 30 },
          { x: 70, y: 70 },
          { x: 30, y: 70 },
        ],
        color: 'blue',
        type: 'internal',
        parentId: 'poly-1',
      },
    ],
  },
};

// Mock failed segmentation response
const mockSegmentationFailed = {
  status: 'failed',
  error: 'Segmentation failed due to processing error',
};

// Mock pending segmentation response
const mockSegmentationPending = {
  status: 'pending',
};

describe('useSegmentationCore', () => {
  // Reset mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
    // Default successful responses
    const apiClient = require('@/lib/apiClient').default;
    apiClient.get.mockImplementation((url) => {
      if (url === `/projects/project-123`) {
        return Promise.resolve({ data: mockProject });
      } else if (url === `/projects/project-123/images`) {
        return Promise.resolve({ data: [mockApiImage] });
      } else if (url === `/images/image-123/segmentation`) {
        return Promise.resolve({ data: mockSegmentationWithContours });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should fetch project and image data on mount', async () => {
    const { result } = renderHook(() => useSegmentationCore('project-123', 'image-123', 'user-123'));

    // Initially loading
    expect(result.current.loading).toBe(true);

    // Wait for project and image data to load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Verify API calls
    const apiClient = require('@/lib/apiClient').default;
    expect(apiClient.get).toHaveBeenCalledWith('/projects/project-123');
    expect(apiClient.get).toHaveBeenCalledWith('/projects/project-123/images');
    expect(apiClient.get).toHaveBeenCalledWith('/images/image-123/segmentation');

    // Verify loaded data
    expect(result.current.project).toEqual(mockProject);
    expect(result.current.projectTitle).toBe('Test Project');
    expect(result.current.imageName).toBe('test-image.jpg');
    expect(result.current.imageSrc).toBe('https://example.com/uploads/test-image.jpg');
    expect(result.current.segmentationResultPath).toBe('https://example.com/results/test-image.json');

    // Verify segmentation data was processed
    expect(result.current.segmentation).not.toBeNull();
    expect(result.current.segmentation?.polygons.length).toBe(2);
    expect(result.current.segmentation?.imageWidth).toBe(800);
    expect(result.current.segmentation?.imageHeight).toBe(600);
  });

  it('should handle segmentation with contours format', async () => {
    const apiClient = require('@/lib/apiClient').default;
    apiClient.get.mockImplementation((url) => {
      if (url === `/projects/project-123`) {
        return Promise.resolve({ data: mockProject });
      } else if (url === `/projects/project-123/images`) {
        return Promise.resolve({ data: [mockApiImage] });
      } else if (url === `/images/image-123/segmentation`) {
        return Promise.resolve({ data: mockSegmentationWithContours });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const { result } = renderHook(() => useSegmentationCore('project-123', 'image-123', 'user-123'));

    // Wait for data to load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Verify contour processing
    expect(result.current.segmentation?.polygons.length).toBe(2);

    // First polygon (external)
    expect(result.current.segmentation?.polygons[0].type).toBe('external');
    expect(result.current.segmentation?.polygons[0].color).toBe('red');
    expect(result.current.segmentation?.polygons[0].points.length).toBe(4);

    // Second polygon (internal)
    expect(result.current.segmentation?.polygons[1].type).toBe('internal');
    expect(result.current.segmentation?.polygons[1].color).toBe('blue');
    expect(result.current.segmentation?.polygons[1].parentId).toBeDefined();
  });

  it('should handle segmentation with polygons format', async () => {
    const apiClient = require('@/lib/apiClient').default;
    apiClient.get.mockImplementation((url) => {
      if (url === `/projects/project-123`) {
        return Promise.resolve({ data: mockProject });
      } else if (url === `/projects/project-123/images`) {
        return Promise.resolve({ data: [mockApiImage] });
      } else if (url === `/images/image-123/segmentation`) {
        return Promise.resolve({ data: mockSegmentationWithPolygons });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const { result } = renderHook(() => useSegmentationCore('project-123', 'image-123', 'user-123'));

    // Wait for data to load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Verify polygon processing
    expect(result.current.segmentation?.polygons.length).toBe(2);
    expect(result.current.segmentation?.polygons[0].id).toBe('poly-1');
    expect(result.current.segmentation?.polygons[1].id).toBe('poly-2');
    expect(result.current.segmentation?.polygons[1].parentId).toBe('poly-1');
  });

  it('should handle failed segmentation', async () => {
    const apiClient = require('@/lib/apiClient').default;
    apiClient.get.mockImplementation((url) => {
      if (url === `/projects/project-123`) {
        return Promise.resolve({ data: mockProject });
      } else if (url === `/projects/project-123/images`) {
        return Promise.resolve({ data: [mockApiImage] });
      } else if (url === `/images/image-123/segmentation`) {
        return Promise.resolve({ data: mockSegmentationFailed });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const { result } = renderHook(() => useSegmentationCore('project-123', 'image-123', 'user-123'));

    // Wait for data to load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Verify empty segmentation data
    expect(result.current.segmentation?.polygons.length).toBe(0);

    // Verify warning toast
    expect(toast.warning).toHaveBeenCalled();
  });

  it('should handle pending segmentation', async () => {
    const apiClient = require('@/lib/apiClient').default;
    apiClient.get.mockImplementation((url) => {
      if (url === `/projects/project-123`) {
        return Promise.resolve({ data: mockProject });
      } else if (url === `/projects/project-123/images`) {
        return Promise.resolve({ data: [mockApiImage] });
      } else if (url === `/images/image-123/segmentation`) {
        return Promise.resolve({ data: mockSegmentationPending });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const { result } = renderHook(() => useSegmentationCore('project-123', 'image-123', 'user-123'));

    // Wait for data to load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Verify empty segmentation data
    expect(result.current.segmentation?.polygons.length).toBe(0);

    // Verify info toast
    expect(toast.info).toHaveBeenCalled();
  });

  it('should handle API errors gracefully', async () => {
    const navigate = vi.fn();
    require('react-router-dom').useNavigate.mockReturnValue(navigate);

    const apiClient = require('@/lib/apiClient').default;
    apiClient.get.mockImplementation((url) => {
      if (url === `/projects/project-123`) {
        return Promise.reject(new Error('Failed to fetch project'));
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const { result } = renderHook(() => useSegmentationCore('project-123', 'image-123', 'user-123'));

    // Wait for error to be handled
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Verify error handling
    expect(toast.error).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('should save segmentation data', async () => {
    const apiClient = require('@/lib/apiClient').default;
    apiClient.put.mockResolvedValue({ data: { success: true } });

    const { result } = renderHook(() => useSegmentationCore('project-123', 'image-123', 'user-123'));

    // Wait for data to load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Call save function
    await act(async () => {
      await result.current.handleSave();
    });

    // Verify API call
    expect(apiClient.put).toHaveBeenCalledWith('/projects/project-123/images/image-123/segmentation', {
      segmentation_data: result.current.segmentation,
    });

    // Verify success toast
    expect(toast.success).toHaveBeenCalled();
  });

  it('should handle save error', async () => {
    const apiClient = require('@/lib/apiClient').default;
    apiClient.put.mockRejectedValue(new Error('Failed to save'));

    const { result } = renderHook(() => useSegmentationCore('project-123', 'image-123', 'user-123'));

    // Wait for data to load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Call save function
    await act(async () => {
      await result.current.handleSave();
    });

    // Verify error toast
    expect(toast.error).toHaveBeenCalled();
  });

  it('should navigate between images', async () => {
    const navigate = vi.fn();
    require('react-router-dom').useNavigate.mockReturnValue(navigate);

    const apiClient = require('@/lib/apiClient').default;
    apiClient.get.mockImplementation((url) => {
      if (url === `/projects/project-123`) {
        return Promise.resolve({ data: mockProject });
      } else if (url === `/projects/project-123/images`) {
        return Promise.resolve({
          data: [mockApiImage, { ...mockApiImage, id: 'image-456', name: 'second-image.jpg' }],
        });
      } else if (url === `/images/image-123/segmentation`) {
        return Promise.resolve({ data: mockSegmentationWithContours });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const { result } = renderHook(() => useSegmentationCore('project-123', 'image-123', 'user-123'));

    // Wait for data to load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Navigate to next image
    act(() => {
      result.current.navigateToImage('next');
    });

    // Verify navigation
    expect(navigate).toHaveBeenCalledWith('/projects/project-123/segmentation/image-456');
  });

  it('should trigger resegmentation', async () => {
    const apiClient = require('@/lib/apiClient').default;
    apiClient.post.mockResolvedValue({ data: { success: true } });

    // Mock interval/timeout
    vi.useFakeTimers();

    const { result } = renderHook(() => useSegmentationCore('project-123', 'image-123', 'user-123'));

    // Wait for data to load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Trigger resegmentation
    await act(async () => {
      await result.current.handleResegmentCurrentImage();
    });

    // Verify API call
    expect(apiClient.post).toHaveBeenCalledWith('/segmentation/trigger-batch', {
      imageIds: ['image-123'],
      priority: 10,
      model_type: 'resunet',
    });

    // Verify success toast
    expect(toast.success).toHaveBeenCalled();

    // Advance timers to test polling
    apiClient.get.mockImplementation((url) => {
      if (url === `/images/image-123`) {
        return Promise.resolve({ data: { segmentationStatus: 'completed' } });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    await act(async () => {
      vi.advanceTimersByTime(5000); // Advance past first polling interval
    });

    // Verify status check
    expect(apiClient.get).toHaveBeenCalledWith('/images/image-123');

    // Clean up
    vi.useRealTimers();
  });
});
