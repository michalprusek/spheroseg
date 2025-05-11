import { useCallback } from 'react';
import { Point } from '@/types';

/**
 * Hook to provide functions for converting coordinates between screen/canvas space and image space.
 *
 * @param zoom The current zoom level of the canvas.
 * @param translateX The current horizontal translation (pan) of the canvas.
 * @param translateY The current vertical translation (pan) of the canvas.
 * @returns An object with screenToImage and imageToScreen conversion functions.
 */
export const useCoordinateTransform = (zoom: number, translateX: number, translateY: number) => {
  /**
   * Converts screen coordinates (e.g., from a mouse event relative to the canvas element)
   * to image coordinates.
   */
  const screenToImage = useCallback(
    (screenX: number, screenY: number): Point => {
      const imageX = (screenX - translateX) / zoom;
      const imageY = (screenY - translateY) / zoom;
      return { x: imageX, y: imageY };
    },
    [zoom, translateX, translateY],
  );

  /**
   * Converts image coordinates to screen coordinates (relative to the canvas element).
   */
  const imageToScreen = useCallback(
    (imageX: number, imageY: number): Point => {
      const screenX = imageX * zoom + translateX;
      const screenY = imageY * zoom + translateY;
      return { x: screenX, y: screenY };
    },
    [zoom, translateX, translateY],
  );

  return {
    screenToImage,
    imageToScreen,
  };
};
