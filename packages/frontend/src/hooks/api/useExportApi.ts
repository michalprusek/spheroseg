/**
 * Export API Hook
 */

import { useState, useCallback } from 'react';
import apiClient from '@/services/api/client';
import { saveAs } from 'file-saver';
import { ExportOptions } from '@spheroseg/types';

export const useExportApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);

  const exportProject = useCallback(async (projectId: string, options: ExportOptions) => {
    setLoading(true);
    setError(null);
    setProgress(0);

    try {
      const response = await apiClient.post(`/projects/${projectId}/export`, options, {
        responseType: 'blob',
        onDownloadProgress: (progressEvent) => {
          const total = progressEvent.total || 1;
          const current = progressEvent.loaded;
          setProgress(Math.round((current / total) * 100));
        },
      });

      // Save the file
      const filename = `project-${projectId}-export.zip`;
      saveAs(response.data, filename);

      return { success: true, filename };
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
      setProgress(0);
    }
  }, []);

  const exportMetrics = useCallback(async (projectId: string, format: 'EXCEL' | 'CSV' | 'JSON' = 'EXCEL') => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get(`/projects/${projectId}/export/metrics`, {
        params: { format },
        responseType: format === 'JSON' ? 'json' : 'blob',
      });

      if (format === 'JSON') {
        return response.data;
      }

      // Save the file
      const extension = format.toLowerCase();
      const filename = `project-${projectId}-metrics.${extension}`;
      saveAs(response.data, filename);

      return { success: true, filename };
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const startExport = useCallback(async (projectId: string, options: ExportOptions) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.post(`/projects/${projectId}/export/start`, options);
      return response.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getExportStatus = useCallback(async (projectId: string, jobId: string) => {
    try {
      const response = await apiClient.get(`/projects/${projectId}/export/${jobId}/status`);
      return response.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const cancelExport = useCallback(async (projectId: string, jobId: string) => {
    try {
      const response = await apiClient.post(`/projects/${projectId}/export/${jobId}/cancel`);
      return response.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const getExportDownloadUrl = useCallback(async (projectId: string, jobId: string) => {
    try {
      const response = await apiClient.get(`/projects/${projectId}/export/${jobId}/download-url`);
      return response.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const getProjectExportHistory = useCallback(async (projectId: string) => {
    try {
      const response = await apiClient.get(`/projects/${projectId}/export/history`);
      return response.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const getExportFormats = useCallback(async () => {
    try {
      const response = await apiClient.get('/export/formats');
      return response.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  return {
    exportProject,
    exportMetrics,
    startExport,
    getExportStatus,
    cancelExport,
    getExportDownloadUrl,
    getProjectExportHistory,
    getExportFormats,
    loading,
    error,
    progress,
  };
};
