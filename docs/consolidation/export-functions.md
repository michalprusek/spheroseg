# Export Functions Consolidation

## Overview

This document details the consolidation of export functionality across the application into a unified export service.

## Problem Statement

The application had multiple duplicate export implementations:
1. **exportService.ts** - Primary export service with partial functionality
2. **useExportFunctions.ts** - Hook with duplicate export logic and UI state
3. **ExcelExporter.tsx** - Standalone Excel export component
4. **cocoConverter.ts** - Simple COCO conversion utility
5. Various inline export implementations

Issues identified:
- Code duplication across 4+ files
- Inconsistent metric names and calculations
- Different Excel column structures
- Missing export formats in some places
- Multiple ways to calculate the same metrics
- No progress tracking for large exports
- Limited error handling

## Solution

Created a comprehensive unified export service that:
1. **Consolidates all export logic** in one place
2. **Supports all formats** consistently
3. **Provides progress tracking** for long operations
4. **Standardizes data structures** across formats
5. **Includes comprehensive error handling**
6. **Offers flexible configuration options**

## Architecture

### Service Structure

```
unifiedExportService.ts
├── Core Export Function (exportData)
├── Format-Specific Exporters
│   ├── exportAsExcel
│   ├── exportAsCSV
│   ├── exportAsJSON
│   ├── exportAsCOCO
│   ├── exportAsYOLO
│   ├── exportAsZIP
│   └── exportAsHTML
├── Data Preparation Functions
│   ├── prepareMetricsData
│   ├── prepareMetadata
│   ├── prepareSegmentations
│   └── fetchSegmentationData
└── Helper Functions
    ├── convertToCSV
    ├── calculateStatistics
    ├── generateHTMLReport
    └── configureExcelSheet
```

### Hook Structure

```
useUnifiedExport.ts
├── State Management
│   ├── isExporting
│   ├── progress
│   └── lastResult
├── Export Function
├── Cancel Support
├── Export Presets
└── Convenience Functions
```

## Usage Examples

### Basic Export

```typescript
import { useUnifiedExport, ExportFormat } from '@/hooks/useUnifiedExport';

function ExportButton({ images }) {
  const { exportData, isExporting, progress } = useUnifiedExport({
    onComplete: (result) => {
      console.log('Export completed:', result.filename);
    },
    onError: (error) => {
      console.error('Export failed:', error);
    },
  });

  const handleExport = () => {
    exportData(images, ExportFormat.EXCEL, 'MyProject');
  };

  return (
    <button onClick={handleExport} disabled={isExporting}>
      {isExporting ? `Exporting... ${progress?.percentage.toFixed(0)}%` : 'Export'}
    </button>
  );
}
```

### Advanced Export with Options

```typescript
import { EXPORT_PRESETS } from '@/hooks/useUnifiedExport';

// Full export with all data
await exportData(
  images,
  ExportFormat.ZIP,
  projectTitle,
  EXPORT_PRESETS.FULL_EXPORT
);

// Custom options
await exportData(
  images,
  ExportFormat.ZIP,
  projectTitle,
  {
    includeMetadata: true,
    includeObjectMetrics: true,
    includeSegmentation: true,
    includeImages: false, // Skip images to reduce size
    annotationFormat: 'YOLO',
    metricsFormat: 'CSV',
    includeStatistics: true,
  }
);
```

### Using Convenience Functions

```typescript
import { 
  exportMetricsAsExcel,
  exportSegmentationsAsCOCO,
  exportAllAsZIP 
} from '@/hooks/useUnifiedExport';

// Quick metrics export
await exportMetricsAsExcel(selectedImages, projectTitle);

// Export annotations for ML
await exportSegmentationsAsCOCO(selectedImages, projectTitle);

// Full backup
await exportAllAsZIP(selectedImages, projectTitle);
```

## Export Formats

### Supported Formats

1. **Excel (.xlsx)**
   - Multiple sheets (metrics, metadata, statistics)
   - Formatted columns with proper widths
   - Type-safe data conversion

2. **CSV (.csv)**
   - Standard CSV with proper escaping
   - Compatible with Excel, R, Python

3. **JSON (.json)**
   - Structured data export
   - Includes all metadata
   - Pretty-printed for readability

4. **COCO (.json)**
   - Standard COCO format for ML
   - Includes proper categories
   - Bounding box calculations

5. **YOLO (.txt + .yaml)**
   - YOLO format with normalized coordinates
   - Includes dataset.yaml configuration
   - Organized folder structure

6. **HTML (.html)**
   - Interactive report with search
   - Statistics overview
   - Responsive design

7. **ZIP (.zip)**
   - Comprehensive archive
   - Multiple format options
   - Organized folder structure
   - README included

### Export Options

```typescript
interface ExportOptions {
  // Data selection
  includeMetadata?: boolean;
  includeObjectMetrics?: boolean;
  includeSegmentation?: boolean;
  includeImages?: boolean;
  includeVisualizations?: boolean;
  includeRawData?: boolean;
  
  // Format options
  annotationFormat?: 'COCO' | 'YOLO' | 'POLYGONS' | 'MASK';
  metricsFormat?: 'EXCEL' | 'CSV' | 'JSON' | 'HTML';
  
  // Advanced options
  generateThumbnails?: boolean;
  compressImages?: boolean;
  imageQuality?: number;
  includeStatistics?: boolean;
  groupByImage?: boolean;
}
```

## Migration Guide

### From exportService.ts

```typescript
// Old
import { exportMetricsAsXlsx } from '@/services/exportService';
await exportMetricsAsXlsx(images, projectTitle);

// New
import { exportMetricsAsExcel } from '@/hooks/useUnifiedExport';
await exportMetricsAsExcel(images, projectTitle);
```

### From useExportFunctions hook

```typescript
// Old
const { handleExport, isExporting } = useExportFunctions(images);

// New
const { exportData, isExporting } = useUnifiedExport();
const handleExport = () => exportData(images, ExportFormat.ZIP, projectTitle);
```

### From ExcelExporter component

```typescript
// Old
<ExcelExporter 
  segmentationData={data}
  imageName={image.name}
/>

// New
import { exportMetricsAsExcel } from '@/hooks/useUnifiedExport';
await exportMetricsAsExcel([image], image.name);
```

## Benefits Achieved

1. **Code Reduction**: Eliminated ~1000+ lines of duplicate code
2. **Consistency**: All exports use same data structures
3. **Features**: Added progress tracking and cancellation
4. **Formats**: All formats available everywhere
5. **Error Handling**: Comprehensive error messages
6. **Performance**: Optimized data processing
7. **Maintainability**: Single source of truth

## Implementation Details

### Progress Tracking

```typescript
const progress: ExportProgress = {
  current: 45,
  total: 100,
  message: 'Processing image 45 of 100',
  percentage: 45,
};
```

### Error Handling

- All errors are caught and returned in result
- Warnings collected for non-critical issues
- Toast notifications for user feedback
- Detailed logging for debugging

### Memory Management

- Streaming for large files
- Chunked processing for images
- Garbage collection hints
- Progress callbacks prevent UI freezing

## Future Improvements

1. **Streaming Exports**
   - Stream large files directly to disk
   - Reduce memory usage for huge datasets

2. **Background Processing**
   - Web Workers for heavy computation
   - Non-blocking UI during export

3. **Export Templates**
   - Save export configurations
   - Quick re-export with same settings

4. **Cloud Integration**
   - Direct upload to cloud storage
   - Shareable export links

5. **Visualization Generation**
   - Canvas-based overlay rendering
   - Customizable visualization styles

6. **Format Plugins**
   - Extensible format system
   - Custom format support

## Testing Recommendations

1. **Unit Tests**
   - Test each export format
   - Verify data transformation
   - Check error scenarios

2. **Integration Tests**
   - Full export workflows
   - Progress tracking
   - Cancellation handling

3. **Performance Tests**
   - Large dataset exports
   - Memory usage monitoring
   - Export time benchmarks

4. **E2E Tests**
   - User export workflows
   - File download verification
   - UI state management