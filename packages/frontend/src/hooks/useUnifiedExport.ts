/**
 * Unified Export Hook
 * 
 * This hook provides a simple interface for the unified export service,
 * managing UI state and delegating all export logic to the service.
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import unifiedExportService, { 
  ExportFormat, 
  ExportOptions, 
  ExportProgress,
  ExportResult 
} from '@/services/unifiedExportService';
import type { ProjectImage } from '@/pages/segmentation/types';

interface UseUnifiedExportOptions {
  onProgress?: (progress: ExportProgress) => void;
  onComplete?: (result: ExportResult) => void;
  onError?: (error: Error) => void;
}

interface UseUnifiedExportReturn {
  // Export function
  exportData: (
    images: ProjectImage[],
    format: ExportFormat,
    projectTitle?: string,
    options?: ExportOptions
  ) => Promise<void>;
  
  // State
  isExporting: boolean;
  progress: ExportProgress | null;
  lastResult: ExportResult | null;
  
  // Utilities
  cancelExport: () => void;
  resetState: () => void;
}

export function useUnifiedExport(options: UseUnifiedExportOptions = {}): UseUnifiedExportReturn {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [lastResult, setLastResult] = useState<ExportResult | null>(null);
  const [isCancelled, setIsCancelled] = useState(false);
  
  // Handle progress updates
  const handleProgress = useCallback((progressData: ExportProgress) => {
    if (isCancelled) return;
    
    setProgress(progressData);
    options.onProgress?.(progressData);
  }, [isCancelled, options]);
  
  // Export data function
  const exportData = useCallback(async (
    images: ProjectImage[],
    format: ExportFormat,
    projectTitle: string = 'project',
    exportOptions: ExportOptions = {}
  ) => {
    // Reset state
    setIsExporting(true);
    setProgress(null);
    setLastResult(null);
    setIsCancelled(false);
    
    try {
      // Validate input
      if (!images || images.length === 0) {
        throw new Error('No images selected for export');
      }
      
      // Show initial toast
      toast.info(`Starting ${format} export for ${images.length} images...`);
      
      // Call export service
      const result = await unifiedExportService.exportData(
        images,
        format,
        projectTitle,
        exportOptions,
        handleProgress
      );
      
      // Check if cancelled
      if (isCancelled) {
        toast.info('Export cancelled');
        return;
      }
      
      // Update state
      setLastResult(result);
      
      // Handle result
      if (result.success) {
        // Show warnings if any
        if (result.warnings && result.warnings.length > 0) {
          result.warnings.forEach(warning => toast.warning(warning));
        }
        
        // Call success callback
        options.onComplete?.(result);
      } else {
        throw new Error(result.error || 'Export failed');
      }
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error('Unknown error');
      
      // Update state
      setLastResult({
        success: false,
        error: errorObj.message,
      });
      
      // Show error toast
      toast.error(`Export failed: ${errorObj.message}`);
      
      // Call error callback
      options.onError?.(errorObj);
    } finally {
      setIsExporting(false);
      setProgress(null);
    }
  }, [handleProgress, isCancelled, options]);
  
  // Cancel export
  const cancelExport = useCallback(() => {
    setIsCancelled(true);
    setIsExporting(false);
    setProgress(null);
  }, []);
  
  // Reset state
  const resetState = useCallback(() => {
    setIsExporting(false);
    setProgress(null);
    setLastResult(null);
    setIsCancelled(false);
  }, []);
  
  return {
    exportData,
    isExporting,
    progress,
    lastResult,
    cancelExport,
    resetState,
  };
}

// ===========================
// Preset Export Configurations
// ===========================

export const EXPORT_PRESETS = {
  // Quick metrics export
  METRICS_ONLY: {
    includeMetadata: false,
    includeObjectMetrics: true,
    includeSegmentation: false,
    includeImages: false,
    metricsFormat: 'EXCEL' as const,
  },
  
  // Full data export
  FULL_EXPORT: {
    includeMetadata: true,
    includeObjectMetrics: true,
    includeSegmentation: true,
    includeImages: true,
    includeVisualizations: true,
    annotationFormat: 'COCO' as const,
    metricsFormat: 'EXCEL' as const,
  },
  
  // Machine learning export
  ML_EXPORT: {
    includeMetadata: false,
    includeObjectMetrics: false,
    includeSegmentation: true,
    includeImages: true,
    annotationFormat: 'COCO' as const,
  },
  
  // Analysis export
  ANALYSIS_EXPORT: {
    includeMetadata: true,
    includeObjectMetrics: true,
    includeSegmentation: false,
    includeImages: false,
    includeStatistics: true,
    metricsFormat: 'HTML' as const,
  },
} as const;

// ===========================
// Convenience Functions
// ===========================

/**
 * Export metrics as Excel
 */
export async function exportMetricsAsExcel(
  images: ProjectImage[],
  projectTitle?: string
): Promise<void> {
  return unifiedExportService.exportData(
    images,
    ExportFormat.EXCEL,
    projectTitle,
    EXPORT_PRESETS.METRICS_ONLY
  ).then(result => {
    if (!result.success) {
      throw new Error(result.error || 'Export failed');
    }
  });
}

/**
 * Export metrics as CSV
 */
export async function exportMetricsAsCSV(
  images: ProjectImage[],
  projectTitle?: string
): Promise<void> {
  return unifiedExportService.exportData(
    images,
    ExportFormat.CSV,
    projectTitle,
    EXPORT_PRESETS.METRICS_ONLY
  ).then(result => {
    if (!result.success) {
      throw new Error(result.error || 'Export failed');
    }
  });
}

/**
 * Export segmentations as COCO
 */
export async function exportSegmentationsAsCOCO(
  images: ProjectImage[],
  projectTitle?: string
): Promise<void> {
  return unifiedExportService.exportData(
    images,
    ExportFormat.COCO,
    projectTitle,
    { includeSegmentation: true }
  ).then(result => {
    if (!result.success) {
      throw new Error(result.error || 'Export failed');
    }
  });
}

/**
 * Export all data as ZIP
 */
export async function exportAllAsZIP(
  images: ProjectImage[],
  projectTitle?: string,
  options?: ExportOptions
): Promise<void> {
  return unifiedExportService.exportData(
    images,
    ExportFormat.ZIP,
    projectTitle,
    options || EXPORT_PRESETS.FULL_EXPORT
  ).then(result => {
    if (!result.success) {
      throw new Error(result.error || 'Export failed');
    }
  });
}