import React from 'react';
import { render, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useExportFunctions } from '../useExportFunctions';
import { saveAs } from 'file-saver';
import { utils, writeFile } from 'xlsx';
import '@testing-library/jest-dom';
import { toast } from 'sonner';
import JSZip from 'jszip';
import apiClient from '@/services/api/client';

// Mock logger
vi.mock('@/utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock calculateMetrics
vi.mock('@/pages/segmentation/utils/metricCalculations', () => ({
  calculateMetrics: vi.fn(() => ({
    area: 100,
    perimeter: 40,
    centroid: { x: 50, y: 50 },
    boundingBox: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
  })),
}));

// Mock file-saver
vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

// Mock xlsx
vi.mock('xlsx', () => ({
  utils: {
    json_to_sheet: vi.fn(() => ({})),
    book_new: vi.fn(() => ({ SheetNames: [], Sheets: {} })),
    book_append_sheet: vi.fn(),
    sheet_to_csv: vi.fn(() => 'csv data'),
  },
  writeFile: vi.fn(),
  write: vi.fn(() => 'binary data'),
}));

// Mock JSZip
vi.mock('jszip', () => ({
  default: vi.fn(() => ({
    file: vi.fn(),
    generateAsync: vi.fn(() => Promise.resolve(new Blob(['zip content']))),
  })),
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock apiClient
vi.mock('@/services/api/client', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ 
      data: { 
        segmentationResult: {
          polygons: []
        }
      } 
    })),
    post: vi.fn(() => Promise.resolve({ 
      data: { 
        exportId: 'export-123',
        status: 'completed',
        downloadUrl: 'https://example.com/download'
      } 
    })),
  },
}));


// Mock LanguageContext which is used in the hook
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    language: 'en',
  }),
}));

// Simple wrapper without DOM dependencies
const wrapper: React.FC<React.PropsWithChildren<unknown>> = ({ children }) => {
  return <>{children}</>;
};

// Mock fetch globally
global.fetch = vi.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    blob: () => Promise.resolve(new Blob(['mock-image-data'], { type: 'image/jpeg' })),
  }),
);

// Mock canvas
const mockCanvas = {
  getContext: vi.fn(() => ({
    fillStyle: '',
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
  })),
  toBlob: vi.fn((callback) => callback(new Blob(['mock-mask-data'], { type: 'image/png' }))),
  width: 0,
  height: 0,
};

// Helper component to test the hook
const TestComponent: React.FC<{ images: any[]; projectName: string; onResult: (result: any) => void }> = ({ 
  images, 
  projectName, 
  onResult 
}) => {
  const hookResult = useExportFunctions(images, projectName);
  React.useEffect(() => {
    onResult(hookResult);
  }, [hookResult, onResult]);
  return null;
};

describe('useExportFunctions', () => {
  const mockImages = [
    {
      id: 'image-1',
      name: 'test-image-1.jpg',
      url: 'https://example.com/image1.jpg',
      thumbnail_url: 'https://example.com/thumbnail1.jpg',
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-02'),
      segmentationStatus: 'completed' as const,
      width: 800,
      height: 600,
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
      id: 'image-2',
      name: 'test-image-2.jpg',
      url: 'https://example.com/image2.jpg',
      thumbnail_url: 'https://example.com/thumbnail2.jpg',
      createdAt: new Date('2023-01-03'),
      updatedAt: new Date('2023-01-04'),
      segmentationStatus: 'failed' as const,
      width: 800,
      height: 600,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock DOM methods for CSV export
    const mockLink = {
      href: '',
      download: '',
      click: vi.fn(),
      remove: vi.fn(),
    };
    
    vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
    vi.spyOn(document.body, 'appendChild').mockReturnValue(mockLink as any);
    vi.spyOn(document.body, 'removeChild').mockReturnValue(mockLink as any);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should initialize with default values', () => {
    let hookResult: any = null;
    
    const TestWrapper = () => {
      const result = useExportFunctions(mockImages, 'Test Project');
      hookResult = result;
      return null;
    };
    
    // Render the test component
    const { unmount } = render(<TestWrapper />);
    
    // Verify the hook result
    expect(hookResult).toBeTruthy();
    expect(hookResult.includeMetadata).toBe(true);
    expect(hookResult.includeObjectMetrics).toBe(true);
    expect(hookResult.includeSegmentation).toBe(true);
    expect(hookResult.includeImages).toBe(true);
    expect(hookResult.annotationFormat).toBe('COCO');
    expect(hookResult.metricsFormat).toBe('EXCEL');
    expect(hookResult.isExporting).toBe(false);
    // The hook automatically selects all images on initialization
    expect(Object.keys(hookResult.selectedImages).length).toBe(2);
    
    unmount();
  });

  it('should handle selecting all images', () => {
    let hookResult: any = null;
    
    const TestWrapper = () => {
      const result = useExportFunctions(mockImages, 'Test Project');
      hookResult = result;
      return null;
    };
    
    const { rerender, unmount } = render(<TestWrapper />);
    
    // First call to handleSelectAll should deselect all (since they're selected by default)
    act(() => {
      hookResult.handleSelectAll();
    });
    
    rerender(<TestWrapper />);
    
    expect(hookResult.selectedImages).toEqual({
      'image-1': false,
      'image-2': false,
    });

    // Second call should select all
    act(() => {
      hookResult.handleSelectAll();
    });
    
    rerender(<TestWrapper />);

    expect(hookResult.selectedImages).toEqual({
      'image-1': true,
      'image-2': true,
    });
    
    unmount();
  });

  it('should handle selecting individual images', () => {
    let hookResult: any = null;
    
    const TestWrapper = () => {
      const result = useExportFunctions(mockImages, 'Test Project');
      hookResult = result;
      return null;
    };
    
    const { rerender, unmount } = render(<TestWrapper />);

    // First deselect all images
    act(() => {
      hookResult.handleSelectAll();
    });
    
    rerender(<TestWrapper />);

    // Then select one image
    act(() => {
      hookResult.handleSelectImage('image-1');
    });
    
    rerender(<TestWrapper />);

    expect(hookResult.selectedImages).toEqual({
      'image-1': true,
      'image-2': false,
    });

    // Toggle selection
    act(() => {
      hookResult.handleSelectImage('image-1');
    });
    
    rerender(<TestWrapper />);

    expect(hookResult.selectedImages).toEqual({
      'image-1': false,
      'image-2': false,
    });
    
    unmount();
  });

  it('should get the correct selected count', () => {
    let hookResult: any = null;
    
    const TestWrapper = () => {
      const result = useExportFunctions(mockImages, 'Test Project');
      hookResult = result;
      return null;
    };
    
    const { rerender, unmount } = render(<TestWrapper />);

    // Initially all images are selected
    expect(hookResult.getSelectedCount()).toBe(2);

    // Deselect all
    act(() => {
      hookResult.handleSelectAll();
    });
    
    rerender(<TestWrapper />);

    expect(hookResult.getSelectedCount()).toBe(0);

    // Select one image
    act(() => {
      hookResult.handleSelectImage('image-1');
    });
    
    rerender(<TestWrapper />);

    expect(hookResult.getSelectedCount()).toBe(1);

    // Select another image
    act(() => {
      hookResult.handleSelectImage('image-2');
    });
    
    rerender(<TestWrapper />);

    expect(hookResult.getSelectedCount()).toBe(2);
    
    unmount();
  });

  it('should export metrics as XLSX', async () => {
    const { result } = renderHook(() => useExportFunctions(mockImages, 'Test Project'), { wrapper });

    // Mock the return values for XLSX utilities
    const mockWorksheet = { '!ref': 'A1:M10' };
    const mockWorkbook = { SheetNames: [], Sheets: {} };
    vi.mocked(utils.json_to_sheet).mockReturnValue(mockWorksheet);
    vi.mocked(utils.book_new).mockReturnValue(mockWorkbook);

    // Export metrics
    await act(async () => {
      await result.current.handleExportMetricsAsXlsx();
    });

    // Check if XLSX functions were called
    expect(utils.json_to_sheet).toHaveBeenCalled();
    expect(utils.book_new).toHaveBeenCalled();
    expect(utils.book_append_sheet).toHaveBeenCalledWith(mockWorkbook, mockWorksheet, 'Metrics');
    expect(writeFile).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('export.metricsExported');
  });

  it('should handle export metrics with different formats', async () => {
    const { result } = renderHook(() => useExportFunctions(mockImages, 'Test Project'), { wrapper });

    // Set format to CSV
    act(() => {
      result.current.setMetricsFormat('CSV');
    });

    // Export metrics with CSV format
    await act(async () => {
      await result.current.handleExportMetricsAsXlsx();
    });

    // Verify a link element was created for CSV download
    expect(document.createElement).toHaveBeenCalledWith('a');
    expect(document.body.appendChild).toHaveBeenCalled();
    expect(document.body.removeChild).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('export.metricsExported');
  });

  it('should handle error during metrics export', async () => {
    const { result } = renderHook(() => useExportFunctions(mockImages, 'Test Project'), { wrapper });

    // Mock XLSX utils to throw an error
    vi.mocked(utils.json_to_sheet).mockImplementationOnce(() => {
      throw new Error('XLSX export error');
    });

    // Export metrics
    await act(async () => {
      await result.current.handleExportMetricsAsXlsx();
    });

    // Check if error toast was shown
    expect(toast.error).toHaveBeenCalled();
  });

  it('should handle full export with ZIP', async () => {
    const { result } = renderHook(() => useExportFunctions(mockImages, 'Test Project'), { wrapper });

    // Export all data
    await act(async () => {
      await result.current.handleExport();
    });

    // Check if saveAs was called with a Blob
    expect(saveAs).toHaveBeenCalled();
    const saveAsArgs = vi.mocked(saveAs).mock.calls[0];
    expect(saveAsArgs[0]).toBeInstanceOf(Blob);
    expect(typeof saveAsArgs[1]).toBe('string');
    expect(saveAsArgs[1]).toContain('Test Project');
    expect(toast.success).toHaveBeenCalledWith('export.exportCompleted');
  });

  it('should handle errors during full export', async () => {
    const { result } = renderHook(() => useExportFunctions(mockImages, 'Test Project'), { wrapper });

    // Mock JSZip to throw an error
    vi.mocked(JSZip).mockImplementationOnce(() => {
      throw new Error('ZIP creation error');
    });

    // Export all data
    await act(async () => {
      await result.current.handleExport();
    });

    // Check if error toast was shown
    expect(toast.error).toHaveBeenCalled();
  });

  it('should handle changing export options', () => {
    const { result } = renderHook(() => useExportFunctions(mockImages, 'Test Project'), { wrapper });

    // Change export options
    act(() => {
      result.current.setIncludeMetadata(false);
      result.current.setIncludeObjectMetrics(false);
      result.current.setIncludeSegmentation(false);
      result.current.setIncludeImages(false);
      result.current.setAnnotationFormat('YOLO');
      result.current.setMetricsFormat('CSV');
    });

    // Verify options were changed
    expect(result.current.includeMetadata).toBe(false);
    expect(result.current.includeObjectMetrics).toBe(false);
    expect(result.current.includeSegmentation).toBe(false);
    expect(result.current.includeImages).toBe(false);
    expect(result.current.annotationFormat).toBe('YOLO');
    expect(result.current.metricsFormat).toBe('CSV');
  });

  it('should handle export with different annotation formats', async () => {
    const { result } = renderHook(() => useExportFunctions(mockImages, 'Test Project'), { wrapper });

    // Test YOLO format
    act(() => {
      result.current.setAnnotationFormat('YOLO');
    });

    await act(async () => {
      await result.current.handleExport();
    });

    expect(saveAs).toHaveBeenCalled();

    // Test MASK format
    vi.clearAllMocks();
    act(() => {
      result.current.setAnnotationFormat('MASK');
    });

    await act(async () => {
      await result.current.handleExport();
    });

    expect(saveAs).toHaveBeenCalled();

    // Test POLYGONS format
    vi.clearAllMocks();
    act(() => {
      result.current.setAnnotationFormat('POLYGONS');
    });

    await act(async () => {
      await result.current.handleExport();
    });

    expect(saveAs).toHaveBeenCalled();
  });

  it('should handle export with specific images', async () => {
    const { result } = renderHook(() => useExportFunctions(mockImages, 'Test Project'), { wrapper });

    // Deselect all images
    act(() => {
      result.current.handleSelectAll();
    });

    // Call export with specific images parameter
    await act(async () => {
      await result.current.handleExport([mockImages[0]]);
    });

    // Check if saveAs was called with a Blob
    expect(saveAs).toHaveBeenCalled();
  });

  it('should initialize selected images only once', () => {
    const { result, rerender } = renderHook(() => useExportFunctions(mockImages, 'Test Project'), { wrapper });

    // Initially all images are selected
    expect(result.current.getSelectedCount()).toBe(2);

    // Deselect one image
    act(() => {
      result.current.handleSelectImage('image-1');
    });

    expect(result.current.selectedImages).toEqual({
      'image-1': false,
      'image-2': true,
    });

    // Rerender the hook
    rerender();

    // Selected state should be preserved
    expect(result.current.selectedImages).toEqual({
      'image-1': false,
      'image-2': true,
    });
  });

  it('should handle images without segmentation data', async () => {
    const imagesWithoutSegmentation = [
      {
        id: 'image-3',
        name: 'test-image-3.jpg',
        url: 'https://example.com/image3.jpg',
        thumbnail_url: 'https://example.com/thumbnail3.jpg',
        createdAt: new Date('2023-01-05'),
        updatedAt: new Date('2023-01-06'),
        segmentationStatus: 'pending' as const,
        width: 800,
        height: 600,
      },
    ];

    const { result } = renderHook(() => useExportFunctions(imagesWithoutSegmentation, 'Test Project'), { wrapper });

    // Export metrics
    await act(async () => {
      await result.current.handleExportMetricsAsXlsx();
    });

    // Should create dummy metrics if no segmentation data is available
    expect(utils.json_to_sheet).toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalled();

    // Export all data
    await act(async () => {
      await result.current.handleExport();
    });

    // Should still complete export
    expect(saveAs).toHaveBeenCalled();
  });

  it('should attempt to fetch segmentation data if missing', async () => {
    const { result } = renderHook(() => useExportFunctions(mockImages, 'Test Project'), { wrapper });

    // Export all data
    await act(async () => {
      await result.current.handleExport();
    });

    // Should fetch segmentation data for images
    expect(apiClient.get).toHaveBeenCalled();
    expect(saveAs).toHaveBeenCalled();
  });

  it('should handle parsing string segmentation data', async () => {
    const imagesWithStringData = [
      {
        ...mockImages[0],
        segmentationResult: JSON.stringify({
          polygons: [
            {
              id: 'poly-string',
              type: 'external',
              points: [
                { x: 10, y: 10 },
                { x: 100, y: 10 },
                { x: 100, y: 100 },
                { x: 10, y: 100 },
              ],
            },
          ],
        }),
      },
    ];

    const { result } = renderHook(() => useExportFunctions(imagesWithStringData, 'Test Project'), { wrapper });

    // Export metrics
    await act(async () => {
      await result.current.handleExportMetricsAsXlsx();
    });

    // Should parse string segmentation data
    expect(utils.json_to_sheet).toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalled();
  });

  it('should normalize polygon points from different formats', async () => {
    const imagesWithDifferentFormats = [
      {
        ...mockImages[0],
        segmentationResult: {
          polygons: [
            {
              id: 'poly1',
              type: 'external',
              // Array format points
              points: [
                [10, 10],
                [100, 10],
                [100, 100],
                [10, 100],
              ],
            },
            {
              id: 'poly2',
              type: 'external',
              // Object format points
              points: [
                { x: 200, y: 200 },
                { x: 300, y: 200 },
                { x: 300, y: 300 },
                { x: 200, y: 300 },
              ],
            },
            {
              id: 'poly3',
              type: 'internal',
              // Using vertices instead of points
              vertices: [
                { x: 50, y: 50 },
                { x: 80, y: 50 },
                { x: 80, y: 80 },
                { x: 50, y: 80 },
              ],
            },
          ],
        },
      },
    ];

    const { result } = renderHook(() => useExportFunctions(imagesWithDifferentFormats, 'Test Project'), { wrapper });

    // Export metrics
    await act(async () => {
      await result.current.handleExportMetricsAsXlsx();
    });

    // Should normalize polygon points from different formats
    expect(utils.json_to_sheet).toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalled();

    // Export all data with different annotation formats
    for (const format of ['COCO', 'YOLO', 'MASK', 'POLYGONS'] as const) {
      vi.clearAllMocks();
      act(() => {
        result.current.setAnnotationFormat(format);
      });

      await act(async () => {
        await result.current.handleExport();
      });

      expect(saveAs).toHaveBeenCalled();
    }
  });
});
