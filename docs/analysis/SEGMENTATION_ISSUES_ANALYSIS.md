# Segmentation Issues Analysis and Solutions

## Issues Identified

### 1. Segmentation Thumbnails Not Showing in Grid View

**Problem**: The `DebugSegmentationThumbnail` component is commented out in `ImageDisplay.tsx` (lines 454-463), preventing segmentation overlays from appearing in the grid view of image cards.

**Root Cause**: The component was disabled, likely due to performance concerns from excessive API calls mentioned in the comment.

**Solution**: Re-enable the component with proper caching and performance optimizations:
- Use the existing `SegmentationThumbnail` component which already has caching implemented
- Apply it to both grid and list views consistently

### 2. Images Stuck in "Queued" Status

**Problem**: Images show "queued" status persistently even when segmentation is complete in the backend.

**Root Causes**:
1. WebSocket updates might not be properly delivered or processed
2. The polling mechanism (30-second interval) is too infrequent
3. Status updates from the backend might use inconsistent event names or data formats

**Solutions**:
1. Ensure WebSocket events are properly emitted from backend with correct status values
2. Add more aggressive polling for images in processing state (reduce from 30s to 5s)
3. Implement a force-refresh mechanism when navigating to an image

### 3. Queue Updates Not Image-Specific

**Problem**: The `SegmentationQueueIndicator` fetches entire queue status rather than updating specific images when they complete.

**Root Cause**: The queue indicator is designed for global queue status, not individual image updates.

**Solution**: 
1. When receiving a `segmentation_update` event for a completed image, trigger a targeted status refresh for that specific image
2. Dispatch custom events to update only the affected image cards without refreshing the entire queue

### 4. Resegment Button Missing Loading State

**Problem**: When an image is being resegmented, the button doesn't show a loading indicator.

**Root Cause**: The `isResegmenting` state is tracked in `EditorContainer` but not passed to the actual toolbar component (`ToolbarV2`).

**Solution**: Pass the `isResegmenting` state through the component hierarchy to `ToolbarV2`.

## Implementation Plan

### Phase 1: Fix Segmentation Thumbnails
1. Re-enable segmentation overlay in grid view using `SegmentationThumbnail`
2. Ensure consistent behavior between grid and list views

### Phase 2: Fix Status Updates
1. Implement targeted image status updates
2. Reduce polling interval for processing images
3. Add force-refresh on image navigation

### Phase 3: Fix Resegment Button
1. Pass `isResegmenting` state to toolbar
2. Show loading spinner when resegmenting

### Phase 4: Improve Queue Updates
1. Make queue updates more granular
2. Update only affected images instead of entire queue