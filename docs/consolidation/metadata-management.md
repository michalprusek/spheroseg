# Metadata Management Consolidation

## Overview

The metadata management consolidation provides a unified system for handling metadata across all data types in the SpherosegV4 application. This system supports extraction, validation, enrichment, and management of metadata for images, documents, projects, and segmentation results.

## Problem Statement

Previously, metadata handling was fragmented across the application:
- EXIF data extraction was handled separately for images
- Project metadata was stored without validation
- No unified metadata search or filtering
- Limited metadata export/import capabilities
- No metadata quality scoring or suggestions
- Inconsistent metadata schemas across different data types

## Solution Architecture

### Core Components

1. **MetadataService** (`/packages/frontend/src/services/metadataService.ts`)
   - Centralized metadata extraction and management
   - Support for multiple metadata types (image, document, project, segmentation)
   - EXIF/IPTC/XMP metadata extraction for images
   - Export/import functionality (JSON, CSV, XML)
   - SEO metadata generation
   - Quality scoring system
   - AI-powered enrichment capabilities

2. **React Hooks** (`/packages/frontend/src/hooks/useMetadata.ts`)
   - `useMetadataExtraction` - Extract metadata from files
   - `useMetadataUpdate` - Update existing metadata
   - `useMetadataSearch` - Search and filter metadata
   - `useMetadataBatch` - Batch operations
   - `useMetadataPortability` - Export/import metadata
   - `useSEOMetadata` - Generate and apply SEO metadata
   - `useMetadataQuality` - Calculate quality scores
   - `useMetadataStatistics` - Get metadata statistics
   - `useMetadataEnrichment` - AI-powered enrichment

3. **UI Components**
   - **MetadataViewer** (`/packages/frontend/src/components/metadata/MetadataViewer.tsx`)
     - Comprehensive metadata display with tabs
     - Quality score visualization
     - Type-specific detail rendering
     - Export/import actions
   
   - **MetadataEditor** (`/packages/frontend/src/components/metadata/MetadataEditor.tsx`)
     - Form-based metadata editing
     - Tag and keyword management
     - Custom field support
     - Type-specific field validation

## Key Features

### 1. Unified Metadata Types

```typescript
// Base metadata interface for all types
interface BaseMetadata {
  id?: string;
  type: string;
  version: string;
  created: Date;
  modified: Date;
  createdBy?: string;
  modifiedBy?: string;
  tags?: string[];
  keywords?: string[];
  description?: string;
  custom?: Record<string, any>;
}

// Specialized metadata types extend base
interface ImageMetadata extends BaseMetadata {
  type: 'image';
  width: number;
  height: number;
  format: string;
  exif?: ExifData;
  iptc?: IptcData;
  xmp?: XmpData;
  scientific?: ScientificMetadata;
}
```

### 2. Metadata Extraction

```typescript
// Extract metadata from any file
const { extract, isExtracting } = useMetadataExtraction();

// Extract image metadata with EXIF data
const handleFileUpload = async (file: File) => {
  const metadata = await extract(file, 'image');
  console.log('EXIF data:', metadata.exif);
  console.log('Scientific data:', metadata.scientific);
};
```

### 3. Quality Scoring

```typescript
// Get metadata quality score and suggestions
const { score, qualityLevel, suggestions } = useMetadataQuality(metadata);

// Quality levels: poor (0-39), fair (40-59), good (60-79), excellent (80-100)
if (qualityLevel === 'poor') {
  suggestions.forEach(suggestion => {
    console.log('Improvement needed:', suggestion);
  });
}
```

### 4. SEO Metadata Generation

```typescript
// Generate SEO metadata
const { generateSEO, applyToDocument } = useSEOMetadata();

const seoMetadata = generateSEO({
  title: 'Cell Segmentation Results',
  description: 'Analysis of cancer cell morphology',
  image: '/results/preview.jpg',
  url: '/projects/123/results',
  type: 'article'
});

// Apply to document head
applyToDocument(seoMetadata);
```

### 5. Batch Operations

```typescript
// Batch update metadata
const { batchUpdate } = useMetadataBatch();

await batchUpdate([
  { id: 'img1', updates: { tags: ['cancer', 'cells'] } },
  { id: 'img2', updates: { tags: ['control', 'cells'] } },
  { id: 'img3', updates: { tags: ['treated', 'cells'] } }
]);
```

### 6. Export/Import

```typescript
// Export metadata
const { exportMetadata, importMetadata } = useMetadataPortability();

// Export to different formats
exportMetadata(metadataArray, 'json');  // Download as JSON
exportMetadata(metadataArray, 'csv');   // Download as CSV
exportMetadata(metadataArray, 'xml');   // Download as XML

// Import from file
const handleImport = async (file: File) => {
  const imported = await importMetadata(file);
  console.log(`Imported ${imported.length} metadata items`);
};
```

## Usage Examples

### Basic Metadata Viewer

```tsx
import { MetadataViewer } from '@/components/metadata/MetadataViewer';

function ImageDetails({ image }) {
  return (
    <MetadataViewer
      metadata={image.metadata}
      onEdit={() => setEditMode(true)}
      onExport={() => handleExport(image.metadata)}
      showQualityScore={true}
    />
  );
}
```

### Metadata Editor

```tsx
import { MetadataEditor } from '@/components/metadata/MetadataEditor';

function EditMetadata({ metadata, onSave }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Edit Metadata</Button>
      <MetadataEditor
        metadata={metadata}
        open={open}
        onOpenChange={setOpen}
        onSave={onSave}
      />
    </>
  );
}
```

### Scientific Image Metadata

```tsx
// Extract and enrich scientific metadata
const { extract } = useMetadataExtraction();
const { enrich } = useMetadataEnrichment();

const processScientificImage = async (file: File) => {
  // Extract basic metadata
  let metadata = await extract(file, 'image');
  
  // Add scientific metadata
  metadata.scientific = {
    magnification: 40,
    pixelSize: 0.65,
    pixelUnit: 'μm',
    modality: 'Brightfield',
    staining: 'H&E'
  };
  
  // Enrich with AI
  metadata = await enrich(metadata);
  
  return metadata;
};
```

### Metadata Search

```tsx
// Search metadata with filters
const { results, isSearching } = useMetadataSearch({
  type: 'image',
  tags: ['cancer', 'cells'],
  dateRange: {
    start: new Date('2024-01-01'),
    end: new Date()
  }
});

// Display results
results.map(metadata => (
  <MetadataCard key={metadata.id} metadata={metadata} />
));
```

## Migration Guide

### 1. Replace Direct EXIF Reading

Before:
```typescript
// Old approach
import EXIF from 'exif-js';

EXIF.getData(file, function() {
  const make = EXIF.getTag(this, "Make");
  const model = EXIF.getTag(this, "Model");
});
```

After:
```typescript
// New approach
import { useMetadataExtraction } from '@/hooks/useMetadata';

const { extract } = useMetadataExtraction();
const metadata = await extract(file, 'image');
console.log(metadata.exif?.make, metadata.exif?.model);
```

### 2. Update Metadata Display

Before:
```tsx
// Old approach - custom metadata display
<div>
  <p>Title: {data.title}</p>
  <p>Description: {data.description}</p>
  <p>Tags: {data.tags?.join(', ')}</p>
</div>
```

After:
```tsx
// New approach - unified viewer
import { MetadataViewer } from '@/components/metadata/MetadataViewer';

<MetadataViewer 
  metadata={data}
  showQualityScore={true}
/>
```

### 3. Implement Quality Scoring

```tsx
// Add quality indicators to existing metadata displays
import { useMetadataQuality } from '@/hooks/useMetadata';

function MetadataQualityBadge({ metadata }) {
  const { score, qualityLevel } = useMetadataQuality(metadata);
  
  return (
    <Badge variant={qualityLevel === 'excellent' ? 'success' : 'warning'}>
      Quality: {score}%
    </Badge>
  );
}
```

## Backend Integration

The metadata service is designed to work with backend endpoints:

```typescript
// Expected backend endpoints
GET    /api/metadata/search     // Search metadata
GET    /api/metadata/statistics // Get statistics
PATCH  /api/metadata/:id       // Update single metadata
PATCH  /api/metadata/batch     // Batch update
POST   /api/metadata/enrich    // AI enrichment
```

## Performance Considerations

1. **Caching**: Metadata extraction results are cached to avoid redundant processing
2. **Debouncing**: Search operations are debounced by default (300ms)
3. **Lazy Loading**: Large metadata sets should use pagination
4. **Batch Operations**: Use batch updates for multiple items instead of individual calls

## Best Practices

1. **Always validate metadata** before saving using Zod schemas
2. **Use quality scoring** to encourage complete metadata
3. **Export metadata** regularly for backup and portability
4. **Implement SEO metadata** for public-facing content
5. **Tag consistently** using a controlled vocabulary
6. **Enrich with AI** when metadata is incomplete

## Future Enhancements

1. **Metadata Templates**: Pre-defined templates for common scenarios
2. **Bulk Import**: CSV/Excel import with mapping interface
3. **Version History**: Track metadata changes over time
4. **Collaborative Editing**: Real-time collaborative metadata editing
5. **Advanced Search**: Full-text search with elasticsearch integration
6. **Metadata Inheritance**: Inherit metadata from parent objects
7. **Automated Extraction**: Extract metadata from document content
8. **Schema Registry**: Centralized schema management for custom metadata