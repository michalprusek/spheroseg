import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MockApiClientProvider } from '../../lib/__mocks__/enhanced/apiClient';
import { useExportApi } from '../../hooks/api/useExportApi';
import { ExportFormat, ExportOptions } from '@spheroseg/types';

// Mock export data
const mockExportOptions: ExportOptions = {
  format: ExportFormat.GEOJSON,
  includeOriginalImages: true,
  includeSegmentationMasks: true,
  includeMetadata: true,
  simplifyPolygons: false,
  simplificationTolerance: 0,
};

const mockExportJob = {
  id: 'export-job-1',
  projectId: 'project-1',
  status: 'pending',
  options: mockExportOptions,
  createdAt: '2023-06-15T10:00:00Z',
  updatedAt: '2023-06-15T10:00:00Z',
  progress: 0,
};

const mockExportDownloadUrl = {
  url: 'https://example.com/download/project-1-export.zip',
  expiresAt: '2023-06-15T11:00:00Z',
};

describe('Export API Integration Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('startExport', () => {
    it('should start an export job successfully', async () => {
      const { result } = renderHook(() => useExportApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              startExport: {
                data: mockExportJob,
                status: 202,
              },
            }}
          >
            {children}
          </MockApiClientProvider>
        ),
      });

      let job;
      await act(async () => {
        job = await result.current.startExport('project-1', mockExportOptions);
      });

      expect(job).toEqual(mockExportJob);
    });

    it('should handle validation errors', async () => {
      const { result } = renderHook(() => useExportApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              startExport: {
                error: new Error('Invalid export format'),
                status: 400,
              },
            }}
          >
            {children}
          </MockApiClientProvider>
        ),
      });

      await act(async () => {
        // @ts-ignore - Intentionally passing invalid format
        await expect(
          result.current.startExport('project-1', {
            ...mockExportOptions,
            format: 'invalid_format',
          }),
        ).rejects.toThrow('Invalid export format');
      });
    });

    it('should handle project not found error', async () => {
      const { result } = renderHook(() => useExportApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              startExport: {
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
        await expect(result.current.startExport('non-existent', mockExportOptions)).rejects.toThrow(
          'Project not found',
        );
      });
    });
  });

  describe('getExportStatus', () => {
    it('should get export job status successfully', async () => {
      const inProgressJob = {
        ...mockExportJob,
        status: 'processing',
        progress: 45,
        updatedAt: '2023-06-15T10:05:00Z',
      };

      const { result } = renderHook(() => useExportApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              getExportStatus: {
                data: inProgressJob,
                status: 200,
              },
            }}
          >
            {children}
          </MockApiClientProvider>
        ),
      });

      let status;
      await act(async () => {
        status = await result.current.getExportStatus('project-1', 'export-job-1');
      });

      expect(status).toEqual(inProgressJob);
    });

    it('should handle job not found error', async () => {
      const { result } = renderHook(() => useExportApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              getExportStatus: {
                error: new Error('Export job not found'),
                status: 404,
              },
            }}
          >
            {children}
          </MockApiClientProvider>
        ),
      });

      await act(async () => {
        await expect(result.current.getExportStatus('project-1', 'non-existent')).rejects.toThrow(
          'Export job not found',
        );
      });
    });
  });

  describe('getExportDownloadUrl', () => {
    it('should get export download URL when job is complete', async () => {
      const completedJob = {
        ...mockExportJob,
        status: 'completed',
        progress: 100,
        updatedAt: '2023-06-15T10:10:00Z',
      };

      const { result } = renderHook(() => useExportApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              getExportStatus: {
                data: completedJob,
                status: 200,
              },
              getExportDownloadUrl: {
                data: mockExportDownloadUrl,
                status: 200,
              },
            }}
          >
            {children}
          </MockApiClientProvider>
        ),
      });

      // First check status
      let status;
      await act(async () => {
        status = await result.current.getExportStatus('project-1', 'export-job-1');
      });
      expect(status).toEqual(completedJob);

      // Then get download URL
      let downloadUrl;
      await act(async () => {
        downloadUrl = await result.current.getExportDownloadUrl('project-1', 'export-job-1');
      });
      expect(downloadUrl).toEqual(mockExportDownloadUrl);
    });

    it('should handle job not complete error', async () => {
      const inProgressJob = {
        ...mockExportJob,
        status: 'processing',
        progress: 75,
        updatedAt: '2023-06-15T10:05:00Z',
      };

      const { result } = renderHook(() => useExportApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              getExportStatus: {
                data: inProgressJob,
                status: 200,
              },
              getExportDownloadUrl: {
                error: new Error('Export job is not yet complete'),
                status: 400,
              },
            }}
          >
            {children}
          </MockApiClientProvider>
        ),
      });

      // First check status
      let status;
      await act(async () => {
        status = await result.current.getExportStatus('project-1', 'export-job-1');
      });
      expect(status).toEqual(inProgressJob);

      // Then try to get download URL, which should fail
      await act(async () => {
        await expect(result.current.getExportDownloadUrl('project-1', 'export-job-1')).rejects.toThrow(
          'Export job is not yet complete',
        );
      });
    });
  });

  describe('cancelExport', () => {
    it('should cancel an export job successfully', async () => {
      const cancelledJob = {
        ...mockExportJob,
        status: 'cancelled',
        updatedAt: '2023-06-15T10:07:00Z',
      };

      const { result } = renderHook(() => useExportApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              cancelExport: {
                data: cancelledJob,
                status: 200,
              },
            }}
          >
            {children}
          </MockApiClientProvider>
        ),
      });

      let job;
      await act(async () => {
        job = await result.current.cancelExport('project-1', 'export-job-1');
      });

      expect(job).toEqual(cancelledJob);
    });

    it('should handle job already completed error', async () => {
      const { result } = renderHook(() => useExportApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              cancelExport: {
                error: new Error('Cannot cancel a completed export job'),
                status: 400,
              },
            }}
          >
            {children}
          </MockApiClientProvider>
        ),
      });

      await act(async () => {
        await expect(result.current.cancelExport('project-1', 'export-job-1')).rejects.toThrow(
          'Cannot cancel a completed export job',
        );
      });
    });
  });

  describe('getExportFormats', () => {
    it('should get available export formats successfully', async () => {
      const mockFormats = [
        {
          id: ExportFormat.GEOJSON,
          name: 'GeoJSON',
          description: 'Standard GIS format',
        },
        {
          id: ExportFormat.SHAPEFILE,
          name: 'Shapefile',
          description: 'ESRI Shapefile format',
        },
        {
          id: ExportFormat.KML,
          name: 'KML',
          description: 'Google Earth KML format',
        },
        {
          id: ExportFormat.CSV,
          name: 'CSV',
          description: 'Comma-separated values',
        },
      ];

      const { result } = renderHook(() => useExportApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              getExportFormats: {
                data: mockFormats,
                status: 200,
              },
            }}
          >
            {children}
          </MockApiClientProvider>
        ),
      });

      let formats;
      await act(async () => {
        formats = await result.current.getExportFormats();
      });

      expect(formats).toEqual(mockFormats);
    });
  });

  describe('getProjectExportHistory', () => {
    it('should get project export history successfully', async () => {
      const mockHistory = [
        {
          id: 'export-job-1',
          projectId: 'project-1',
          status: 'completed',
          options: mockExportOptions,
          createdAt: '2023-06-15T10:00:00Z',
          completedAt: '2023-06-15T10:10:00Z',
          fileSize: 2500000,
        },
        {
          id: 'export-job-2',
          projectId: 'project-1',
          status: 'completed',
          options: { ...mockExportOptions, format: ExportFormat.SHAPEFILE },
          createdAt: '2023-06-16T15:00:00Z',
          completedAt: '2023-06-16T15:12:00Z',
          fileSize: 3000000,
        },
      ];

      const { result } = renderHook(() => useExportApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              getProjectExportHistory: {
                data: mockHistory,
                status: 200,
              },
            }}
          >
            {children}
          </MockApiClientProvider>
        ),
      });

      let history;
      await act(async () => {
        history = await result.current.getProjectExportHistory('project-1');
      });

      expect(history).toEqual(mockHistory);
    });

    it('should handle empty export history', async () => {
      const { result } = renderHook(() => useExportApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              getProjectExportHistory: {
                data: [],
                status: 200,
              },
            }}
          >
            {children}
          </MockApiClientProvider>
        ),
      });

      let history;
      await act(async () => {
        history = await result.current.getProjectExportHistory('project-1');
      });

      expect(history).toEqual([]);
    });
  });
});
