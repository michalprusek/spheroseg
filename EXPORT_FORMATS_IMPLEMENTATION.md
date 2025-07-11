# Export Formats Implementation Summary

## Overview
I have successfully implemented the requested export formats for segmentation data in the SpherosegV4 application. The following formats are now available:

### Implemented Export Formats

1. **COCO (Common Objects in Context)** - Already existed
   - JSON format for object detection and segmentation
   - Includes categories for "cell" (external polygons) and "hole" (internal polygons)
   - Properly calculates area by subtracting internal polygon areas from external ones

2. **YOLO (You Only Look Once)** - Already existed
   - Text format for object detection
   - Exports bounding boxes in normalized coordinates

3. **Mask (Binary Masks)** - Already existed
   - Creates PNG mask images for each segmented image
   - External polygons are rendered in white on black background

4. **Polygons (Raw JSON)** - Already existed
   - Exports raw polygon data in JSON format

5. **Datumaro** - NEW
   - Unified dataset representation format
   - Exports as `annotations.json` and `categories.json`
   - Supports both external polygons (label_id: 0) and internal polygons/holes (label_id: 1)

6. **CVAT Masks (XML)** - NEW
   - CVAT XML format with polygon annotations
   - Exports as `annotations.xml`
   - Labels: "cell" for external polygons (red), "hole" for internal polygons (blue)
   - Includes proper metadata and task information

7. **CVAT YAML** - NEW
   - CVAT YAML format for annotation interchange
   - Exports as `annotations.yaml`
   - Human-readable format with structured polygon data
   - Labels: "cell" for external polygons, "hole" for internal polygons

## Technical Implementation

### File Changes

1. **ExportOptionsCard.tsx**
   - Updated `AnnotationFormat` type to include new formats
   - Added UI options for selecting new formats
   - Added format descriptions

2. **useExportFunctions.ts**
   - Implemented `convertToDatumaro()` function
   - Implemented `convertToCVATMasks()` function
   - Implemented `convertToCVATYAML()` function
   - Added export logic for each new format in `createExportZip()`

3. **en.ts (translations)**
   - Added translation keys for new formats
   - Added format descriptions

### Key Features

1. **Polygon Type Handling**
   - External polygons (red) are exported as "cell" or label_id 0
   - Internal polygons (blue) are exported as "hole" or label_id 1
   - Area calculations properly subtract internal polygon areas from external ones

2. **Format Structure**
   - All formats are exported in appropriate folder structure within the ZIP file
   - Each format follows its standard specification
   - Proper metadata is included (image dimensions, labels, etc.)

3. **Error Handling**
   - Graceful handling of missing segmentation data
   - Proper error messages in Czech (to be updated to use i18n)
   - Console logging for debugging

## Usage

1. Navigate to the Export page (`/project/{projectId}/export`)
2. Select images to export
3. Enable "Include segmentation" option
4. Choose desired export format from dropdown:
   - COCO JSON
   - YOLO TXT
   - Mask (TIFF)
   - Polygons (JSON)
   - Datumaro
   - CVAT Masks (XML)
   - CVAT YAML
5. Click "Export Images" button
6. ZIP file will be generated with selected data

## Next Steps

### Metrics Export Issue
The user reported an issue with Excel metrics export:
- "Error generating metrics" message appears
- Excel format selection returns CSV file

This appears to be a separate issue from the export formats implementation and needs investigation.

### Visualization Feature
The user also requested a visualization feature:
- Create images with drawn segmentation polygons
- Add numbered labels to polygons
- Map numbers to metrics in the Excel/CSV file

This feature has not been implemented yet and would require:
1. Canvas-based rendering of original images with polygons
2. Text rendering for polygon numbers
3. Correlation table between polygon IDs and metrics

## Notes

- The implementation properly handles all polygon types
- Area calculations correctly subtract internal (hole) areas from external polygons
- All formats follow their respective specifications
- The code maintains the existing architecture and patterns