import { Point } from '@spheroseg/types';
import { TransformState } from '../hooks/segmentation/types';
import { createLogger } from '@/lib/logger';
import {
  calculateBoundingBox,
  isBoxVisible,
  PolygonBoundingBoxCache,
  polygonBoundingBoxCache,
  BoundingBox,
} from '@/shared/utils/polygonOperationsUtils';

const logger = createLogger('segmentation:polygonVisibility');

/**
 * Calculate the viewport bounds based on the canvas dimensions and transform
 */
export const calculateViewportBounds = (
  canvasWidth: number,
  canvasHeight: number,
  transform: TransformState,
): BoundingBox => {
  // Convert viewport corners to canvas coordinates
  const topLeft = {
    x: -transform.translateX / transform.zoom,
    y: -transform.translateY / transform.zoom,
  };

  const bottomRight = {
    x: (canvasWidth - transform.translateX) / transform.zoom,
    y: (canvasHeight - transform.translateY) / transform.zoom,
  };

  return {
    minX: topLeft.x,
    minY: topLeft.y,
    maxX: bottomRight.x,
    maxY: bottomRight.y,
  };
};

/**
 * Filter polygons to only include those visible in the viewport
 */
export const filterVisiblePolygons = <T extends { points: Point[]; id: string }>(
  polygons: T[],
  canvasWidth: number,
  canvasHeight: number,
  transform: TransformState,
): T[] => {
  // If there are few polygons, don't bother filtering
  if (polygons.length < 50) {
    return polygons;
  }

  const viewport = calculateViewportBounds(canvasWidth, canvasHeight, transform);
  const startTime = performance.now();

  // Calculate bounding boxes for all polygons (could be cached)
  const visiblePolygons = polygons.filter((polygon) => {
    const box = calculateBoundingBox(polygon.points);
    return isBoxVisible(box, viewport);
  });

  const endTime = performance.now();
  logger.debug(
    `Filtered ${polygons.length} polygons to ${visiblePolygons.length} visible (${(endTime - startTime).toFixed(2)}ms)`,
  );

  return visiblePolygons;
};

// Export other utility functions from our shared module
export { calculateBoundingBox, isBoxVisible, PolygonBoundingBoxCache, polygonBoundingBoxCache };

export default filterVisiblePolygons;
