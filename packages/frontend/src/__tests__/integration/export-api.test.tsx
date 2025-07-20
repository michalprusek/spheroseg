import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExportApi } from '../../hooks/api/useExportApi';
import { ExportFormat, ExportOptions } from '@spheroseg/types';
import apiClient from '@/services/api/client';

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

// Mock saveAs from file-saver
vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

describe('Export API Integration Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('startExport', () => {
    it('should start an export job successfully', async () => {
      // Mock the API response
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: mockExportJob,
        status: 202,
      });

      const { result } = renderHook(() => useExportApi());

      let job;
      await act(async () => {
        job = await result.current.startExport('project-1', mockExportOptions);
      });

      expect(apiClient.post).toHaveBeenCalledWith('/projects/project-1/export/start', mockExportOptions);
      expect(job).toEqual(mockExportJob);
    });

    it('should handle validation errors', async () => {
      // Mock the API to reject with an error
      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Invalid export format'));

      const { result } = renderHook(() => useExportApi());

      await act(async () => {
        // @ts-expect-error - Intentionally passing invalid format
        await expect(
          result.current.startExport('project-1', {
            ...mockExportOptions,
            format: 'invalid_format',
          }),
        ).rejects.toThrow('Invalid export format');
      });

      expect(apiClient.post).toHaveBeenCalled();
    });

    it('should handle project not found error', async () => {
      // Mock the API to reject with an error
      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Project not found'));

      const { result } = renderHook(() => useExportApi());

      await act(async () => {
        await expect(result.current.startExport('non-existent', mockExportOptions)).rejects.toThrow(
          'Project not found',
        );
      });

      expect(apiClient.post).toHaveBeenCalledWith('/projects/non-existent/export/start', mockExportOptions);
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

      // Mock the API response
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: inProgressJob,
        status: 200,
      });

      const { result } = renderHook(() => useExportApi());

      let status;
      await act(async () => {
        status = await result.current.getExportStatus('project-1', 'export-job-1');
      });

      expect(apiClient.get).toHaveBeenCalledWith('/projects/project-1/export/export-job-1/status');
      expect(status).toEqual(inProgressJob);
    });

    it('should handle job not found error', async () => {
      // Mock the API to reject with an error
      vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('Export job not found'));

      const { result } = renderHook(() => useExportApi());

      await act(async () => {
        await expect(result.current.getExportStatus('project-1', 'non-existent')).rejects.toThrow(
          'Export job not found',
        );
      });

      expect(apiClient.get).toHaveBeenCalledWith('/projects/project-1/export/non-existent/status');
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

      // Mock the API responses
      vi.mocked(apiClient.get)
        .mockResolvedValueOnce({
          data: completedJob,
          status: 200,
        })
        .mockResolvedValueOnce({
          data: mockExportDownloadUrl,
          status: 200,
        });

      const { result } = renderHook(() => useExportApi());

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
      expect(apiClient.get).toHaveBeenNthCalledWith(2, '/projects/project-1/export/export-job-1/download-url');
      expect(downloadUrl).toEqual(mockExportDownloadUrl);
    });

    it('should handle job not complete error', async () => {
      const inProgressJob = {
        ...mockExportJob,
        status: 'processing',
        progress: 75,
        updatedAt: '2023-06-15T10:05:00Z',
      };

      // Mock the API responses
      vi.mocked(apiClient.get)
        .mockResolvedValueOnce({
          data: inProgressJob,
          status: 200,
        })
        .mockRejectedValueOnce(new Error('Export job is not yet complete'));

      const { result } = renderHook(() => useExportApi());

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

      // Mock the API response
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: cancelledJob,
        status: 200,
      });

      const { result } = renderHook(() => useExportApi());

      let job;
      await act(async () => {
        job = await result.current.cancelExport('project-1', 'export-job-1');
      });

      expect(apiClient.post).toHaveBeenCalledWith('/projects/project-1/export/export-job-1/cancel');
      expect(job).toEqual(cancelledJob);
    });

    it('should handle job already completed error', async () => {
      // Mock the API to reject with an error
      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Cannot cancel a completed export job'));

      const { result } = renderHook(() => useExportApi());

      await act(async () => {
        await expect(result.current.cancelExport('project-1', 'export-job-1')).rejects.toThrow(
          'Cannot cancel a completed export job',
        );
      });

      expect(apiClient.post).toHaveBeenCalledWith('/projects/project-1/export/export-job-1/cancel');
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

      // Mock the API response
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: mockFormats,
        status: 200,
      });

      const { result } = renderHook(() => useExportApi());

      let formats;
      await act(async () => {
        formats = await result.current.getExportFormats();
      });

      expect(apiClient.get).toHaveBeenCalledWith('/export/formats');
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

      // Mock the API response
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: mockHistory,
        status: 200,
      });

      const { result } = renderHook(() => useExportApi());

      let history;
      await act(async () => {
        history = await result.current.getProjectExportHistory('project-1');
      });

      expect(apiClient.get).toHaveBeenCalledWith('/projects/project-1/export/history');
      expect(history).toEqual(mockHistory);
    });

    it('should handle empty export history', async () => {
      // Mock the API response with empty array
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: [],
        status: 200,
      });

      const { result } = renderHook(() => useExportApi());

      let history;
      await act(async () => {
        history = await result.current.getProjectExportHistory('project-1');
      });

      expect(apiClient.get).toHaveBeenCalledWith('/projects/project-1/export/history');
      expect(history).toEqual([]);
    });
  });
});
