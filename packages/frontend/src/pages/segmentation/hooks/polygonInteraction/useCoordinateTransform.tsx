console.log('[useCoordinateTransform] module loaded');
import { useCallback } from 'react';
import { Point } from '@/lib/segmentation';

/**
 * Hook for transforming coordinates between screen and image space.
 */
export const useCoordinateTransform = (zoom: number, offset: { x: number; y: number }) => {

  /**
   * Converts screen coordinates (e.g., mouse position) to image coordinates.
   * @param screenPoint The point in screen coordinates.
   * @returns The corresponding point in image coordinates.
   */
  const screenToImageCoordinates = useCallback((screenPoint: Point): Point => {
    return {
      x: (screenPoint.x - offset.x) / zoom,
      y: (screenPoint.y - offset.y) / zoom,
    };
  }, [zoom, offset]);

  /**
   * Converts image coordinates (e.g., polygon vertex) to screen coordinates.
   * @param imagePoint The point in image coordinates.
   * @returns The corresponding point in screen coordinates.
   */
  const imageToScreenCoordinates = useCallback((imagePoint: Point): Point => {
    return {
      x: imagePoint.x * zoom + offset.x,
      y: imagePoint.y * zoom + offset.y,
    };
  }, [zoom, offset]);

  return { screenToImageCoordinates, imageToScreenCoordinates };
};
