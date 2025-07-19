/**
 * Export-related types for the Spheroseg application
 */

// Export formats
export enum ExportFormat {
  EXCEL = 'EXCEL',
  CSV = 'CSV',
  COCO = 'COCO',
  YOLO = 'YOLO',
  ZIP = 'ZIP',
  GEOJSON = 'GEOJSON',
  SHAPEFILE = 'SHAPEFILE',
  KML = 'KML',
}

// Export options
export interface ExportOptions {
  format?: ExportFormat;
  includeMetadata?: boolean;
  includeObjectMetrics?: boolean;
  includeSegmentation?: boolean;
  includeImages?: boolean;
  includeOriginalImages?: boolean;
  includeSegmentationMasks?: boolean;
  annotationFormat?: 'COCO' | 'YOLO' | 'POLYGONS';
  metricsFormat?: 'EXCEL' | 'CSV';
  generateVisualizations?: boolean;
  includeRawData?: boolean;
  simplifyPolygons?: boolean;
  simplificationTolerance?: number;
}

// Export job status
export type ExportJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

// Export job interface
export interface ExportJob {
  id: string;
  projectId: string;
  status: ExportJobStatus;
  options: ExportOptions;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  progress?: number;
  fileSize?: number;
  error?: string;
}

// Export download URL
export interface ExportDownloadUrl {
  url: string;
  expiresAt: string;
}

// Export format info
export interface ExportFormatInfo {
  id: ExportFormat;
  name: string;
  description: string;
  supportedOptions?: string[];
}
