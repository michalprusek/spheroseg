/**
 * Export API Hook
 */

import { useState, useCallback } from 'react';
import apiClient from '@/lib/apiClient';
import { saveAs } from 'file-saver';

export interface ExportOptions {
  includeImages: boolean;
  includeMetadata: boolean;
  includeSegmentation: boolean;
  includeObjectMetrics: boolean;
  annotationFormat: 'COCO' | 'YOLO' | 'JSON';
  metricsFormat: 'EXCEL' | 'CSV' | 'JSON';
  selectedImages: Record<string, boolean>;
}

export const useExportApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);

  const exportProject = useCallback(async (projectId: string, options: ExportOptions) => {
    setLoading(true);
    setError(null);
    setProgress(0);
    
    try {
      const response = await apiClient.post(
        `/projects/${projectId}/export`,
        options,
        {
          responseType: 'blob',
          onDownloadProgress: (progressEvent) => {
            const total = progressEvent.total || 1;
            const current = progressEvent.loaded;
            setProgress(Math.round((current / total) * 100));
          },
        }
      );
      
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
      const response = await apiClient.get(
        `/projects/${projectId}/export/metrics`,
        {
          params: { format },
          responseType: format === 'JSON' ? 'json' : 'blob',
        }
      );
      
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

  return {
    exportProject,
    exportMetrics,
    loading,
    error,
    progress,
  };
};