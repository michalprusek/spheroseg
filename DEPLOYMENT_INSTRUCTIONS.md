# Deployment Instructions

This document provides instructions for deploying the updated segmentation system with task queue, device detection, and fixes for polygon deletion and re-trigger segmentation.

## Overview of Changes

1. **Task Queue Implementation**:
   - Added a queue system for segmentation tasks
   - Implemented priority-based processing
   - Limited concurrent segmentation tasks to avoid overloading the system

2. **Device Detection**:
   - Added automatic detection of available hardware (CUDA, MPS, CPU)
   - Optimized performance based on available hardware

3. **API Enhancements**:
   - Added endpoint to check queue status
   - Added priority parameter to segmentation requests
   - Enhanced batch processing capabilities

4. **Bug Fixes**:
   - Fixed polygon deletion with right-click
   - Fixed re-trigger segmentation to show actual polygons instead of a rectangle
   - Improved polygon extraction from segmentation masks

## Deployment Steps

### 1. Update Backend Files

Copy the updated backend files to the Docker container:

```bash
# Copy the updated segmentation script
docker cp /Users/michalprusek/PycharmProjects/spheroseg_v4/server/ML/resunet_segmentation.py cellseg-backend:/ML/

# Copy the updated segmentation service
docker cp /Users/michalprusek/PycharmProjects/spheroseg_v4/server/src/services/segmentationService.ts cellseg-backend:/app/src/services/

# Copy the updated segmentation routes
docker cp /Users/michalprusek/PycharmProjects/spheroseg_v4/server/src/routes/segmentation.ts cellseg-backend:/app/src/routes/

# Set proper permissions
docker exec -it cellseg-backend sh -c "chmod +x /ML/resunet_segmentation.py"
```

### 2. Update Frontend Files

Copy the updated frontend files to the Docker container:

```bash
# Copy the updated PolygonContextMenu
docker cp /Users/michalprusek/PycharmProjects/spheroseg_v4/frontend/src/pages/segmentation/components/context-menu/PolygonContextMenu.tsx cellseg-frontend-dev:/app/src/pages/segmentation/components/context-menu/

# Copy the updated maskToPolygons
docker cp /Users/michalprusek/PycharmProjects/spheroseg_v4/frontend/src/lib/segmentation/maskToPolygons.ts cellseg-frontend-dev:/app/src/lib/segmentation/

# Copy the updated ProjectImageActions
docker cp /Users/michalprusek/PycharmProjects/spheroseg_v4/frontend/src/components/project/ProjectImageActions.tsx cellseg-frontend-dev:/app/src/components/project/

# Copy the updated useSegmentationCore
docker cp /Users/michalprusek/PycharmProjects/spheroseg_v4/frontend/src/pages/segmentation/hooks/useSegmentationCore.tsx cellseg-frontend-dev:/app/src/pages/segmentation/hooks/
```

### 3. Restart Services

Restart the services to apply the changes:

```bash
# Restart backend service
docker-compose restart cellseg-backend

# Restart frontend development service
docker-compose restart cellseg-frontend-dev
```

### 4. Verify Deployment

Test the new functionality:

1. **Check Queue Status**:
   ```bash
   curl -X GET http://localhost:5001/api/segmentation/queue -H "Authorization: Bearer YOUR_TOKEN"
   ```

2. **Trigger Segmentation with Priority**:
   ```bash
   curl -X POST http://localhost:5001/api/images/YOUR_IMAGE_ID/segmentation \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"priority": 5, "model_type": "resunet"}'
   ```

3. **Trigger Batch Segmentation**:
   ```bash
   curl -X POST http://localhost:5001/api/images/segmentation/trigger-batch \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"imageIds": ["ID1", "ID2", "ID3"], "priority": 3, "model_type": "resunet"}'
   ```

4. **Test Polygon Deletion with Right-Click**:
   - Otevřete segmentační editor
   - Klikněte pravým tlačítkem myši na polygon
   - Měl by se zobrazit dialog pro potvrzení smazání
   - Po potvrzení by měl být polygon smazán

5. **Test Re-trigger Segmentace**:
   - Otevřete detail projektu
   - Klikněte na tlačítko "Opětovná segmentace" u obrázku
   - Měla by se spustit segmentace a po jejím dokončení by se měly zobrazit skutečné polygony místo obdélníku přes celý obrázek

## Configuration Options

You can configure the segmentation queue by setting environment variables:

- `MAX_CONCURRENT_SEGMENTATIONS`: Maximum number of concurrent segmentation tasks (default: 2)

Add these to your `.env` file or set them directly in the Docker Compose file:

```yaml
services:
  backend:
    environment:
      - MAX_CONCURRENT_SEGMENTATIONS=4
```

## Troubleshooting

If you encounter issues:

1. Check the logs:
   ```bash
   docker-compose logs cellseg-backend
   ```

2. Verify the Python script is using the correct device:
   ```bash
   docker exec -it cellseg-backend python3 -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}'); print(f'MPS available: {hasattr(torch.backends, \"mps\") and torch.backends.mps.is_available()}'); print(f'Device: {torch.device(\"cuda\" if torch.cuda.is_available() else \"mps\" if hasattr(torch.backends, \"mps\") and torch.backends.mps.is_available() else \"cpu\")}')"
   ```

3. Reset the queue if needed:
   ```bash
   docker-compose restart cellseg-backend
   ```
