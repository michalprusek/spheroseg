import { renderHook, act } from '@testing-library/react';
import { useExportFunctions } from '../hooks/useExportFunctions';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { toast } from 'sonner';
import apiClient from '@/lib/apiClient';
import { saveAs } from 'file-saver';
import React from 'react';
import { AllProvidersWrapper } from '@/test-utils/test-wrapper';

// Mock dependencies
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

vi.mock('@/lib/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Mock sample data
const mockImages = [
  {
    id: 'img1',
    name: 'test-image-1.jpg',
    width: 800,
    height: 600,
    createdAt: new Date('2023-01-01'),
    segmentationStatus: 'completed',
    segmentationResult: {
      polygons: [
        {
          id: 'poly1',
          type: 'external',
          points: [
            { x: 10, y: 10 },
            { x: 100, y: 10 },
            { x: 100, y: 100 },
            { x: 10, y: 100 },
          ],
        },
      ],
    },
  },
  {
    id: 'img2',
    name: 'test-image-2.jpg',
    width: 800,
    height: 600,
    createdAt: new Date('2023-01-02'),
    segmentationStatus: 'pending',
    segmentationResult: null,
  },
];

// Mock context providers
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    token: 'mock-token',
    user: { id: 'user1', name: 'Test User' },
  }),
  AuthProvider: ({ children }) => <>{children}</>,
}));

vi.mock('@/contexts/ProfileContext', () => ({
  useProfile: () => ({
    profile: { id: 'profile1', user_id: 'user1', preferred_language: 'en' },
    loading: false,
    error: null,
  }),
  ProfileProvider: ({ children }) => <>{children}</>,
}));

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: vi.fn(),
  }),
  ThemeProvider: ({ children }) => <>{children}</>,
}));

describe('useExportFunctions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useExportFunctions(mockImages, 'Test Project'), {
      wrapper: AllProvidersWrapper,
    });

    expect(result.current.includeMetadata).toBe(true);
    expect(result.current.includeObjectMetrics).toBe(true);
    expect(result.current.includeSegmentation).toBe(true);
    expect(result.current.includeImages).toBe(true);
    expect(result.current.annotationFormat).toBe('COCO');
    expect(result.current.metricsFormat).toBe('EXCEL');
    expect(result.current.isExporting).toBe(false);
  });

  it('should select all images by default', () => {
    const { result } = renderHook(() => useExportFunctions(mockImages, 'Test Project'), {
      wrapper: AllProvidersWrapper,
    });

    // Check that all images are selected
    expect(result.current.selectedImages['img1']).toBe(true);
    expect(result.current.selectedImages['img2']).toBe(true);
  });

  it('should toggle image selection', () => {
    const { result } = renderHook(() => useExportFunctions(mockImages, 'Test Project'), {
      wrapper: AllProvidersWrapper,
    });

    // Initially all images are selected
    expect(result.current.selectedImages['img1']).toBe(true);

    // Toggle selection for img1
    act(() => {
      result.current.handleSelectImage('img1');
    });

    // img1 should now be deselected
    expect(result.current.selectedImages['img1']).toBe(false);
    // img2 should still be selected
    expect(result.current.selectedImages['img2']).toBe(true);
  });

  it('should toggle all image selections', () => {
    const { result } = renderHook(() => useExportFunctions(mockImages, 'Test Project'), {
      wrapper: AllProvidersWrapper,
    });

    // Initially all images are selected
    expect(result.current.selectedImages['img1']).toBe(true);
    expect(result.current.selectedImages['img2']).toBe(true);

    // Toggle all selections (should deselect all)
    act(() => {
      result.current.handleSelectAll();
    });

    // All images should now be deselected
    expect(result.current.selectedImages['img1']).toBe(false);
    expect(result.current.selectedImages['img2']).toBe(false);

    // Toggle all selections again (should select all)
    act(() => {
      result.current.handleSelectAll();
    });

    // All images should now be selected again
    expect(result.current.selectedImages['img1']).toBe(true);
    expect(result.current.selectedImages['img2']).toBe(true);
  });

  it('should count selected images correctly', () => {
    const { result } = renderHook(() => useExportFunctions(mockImages, 'Test Project'), {
      wrapper: AllProvidersWrapper,
    });

    // Initially all images are selected
    expect(result.current.getSelectedCount()).toBe(2);

    // Deselect one image
    act(() => {
      result.current.handleSelectImage('img1');
    });

    // Count should now be 1
    expect(result.current.getSelectedCount()).toBe(1);

    // Deselect the other image
    act(() => {
      result.current.handleSelectImage('img2');
    });

    // Count should now be 0
    expect(result.current.getSelectedCount()).toBe(0);
  });

  it('should export metrics as XLSX', async () => {
    const { result } = renderHook(() => useExportFunctions(mockImages, 'Test Project'), {
      wrapper: AllProvidersWrapper,
    });

    // Call the export function
    await act(async () => {
      await result.current.handleExportMetricsAsXlsx();
    });

    // Check that saveAs was called
    expect(saveAs).toHaveBeenCalled();
    // Check that toast.success was called
    expect(toast.success).toHaveBeenCalled();
  });

  it('should handle export with API call', async () => {
    // Mock API response
    const mockBlob = new Blob(['test'], { type: 'application/zip' });
    (apiClient.get as any).mockResolvedValue({
      data: mockBlob,
      headers: { 'content-disposition': 'attachment; filename="export.zip"' },
    });

    const { result } = renderHook(() => useExportFunctions(mockImages, 'Test Project'), {
      wrapper: AllProvidersWrapper,
    });

    // Call the export function with selected images
    await act(async () => {
      await result.current.handleExport([mockImages[0]]);
    });

    // Check that API was called
    expect(apiClient.get).toHaveBeenCalled();
    // Check that saveAs was called
    expect(saveAs).toHaveBeenCalled();
    // Check that toast.success was called
    expect(toast.success).toHaveBeenCalled();
  });

  it('should handle export error', async () => {
    // Mock API error
    (apiClient.get as any).mockRejectedValue(new Error('API error'));

    const { result } = renderHook(() => useExportFunctions(mockImages, 'Test Project'), {
      wrapper: AllProvidersWrapper,
    });

    // Call the export function with selected images
    await act(async () => {
      await result.current.handleExport([mockImages[0]]);
    });

    // Check that toast.error was called
    expect(toast.error).toHaveBeenCalled();
  });
});
