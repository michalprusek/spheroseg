import { RefObject } from 'react';
import { Point, TransformState } from './types';

/**
 * Convert image coordinates to screen coordinates
 */
export const getScreenCoordinates = (
  imageX: number,
  imageY: number,
  transform: TransformState
): Point => {
  return {
    x: imageX * transform.zoom + transform.translateX,
    y: imageY * transform.zoom + transform.translateY,
  };
};

/**
 * Convert mouse coordinates to canvas and image coordinates
 */
export const getCanvasCoordinates = (
  mouseX: number,
  mouseY: number,
  transform: TransformState,
  canvasRef: RefObject<HTMLDivElement>
): { canvasX: number; canvasY: number; imageX: number; imageY: number } => {
  const canvasEl = canvasRef.current;
  if (!canvasEl) {
    console.error("Canvas ref not available for coordinate calculation");
    return { canvasX: 0, canvasY: 0, imageX: 0, imageY: 0 }; // Should not happen ideally
  }

  // Apply cursor offset for arrow cursor (adjust these values based on testing)
  // For a standard arrow cursor, we need to adjust the offset to match the tip of the arrow
  // Negative values move the effective click point up and left
  const cursorOffsetX = -2; // Move the effective click point 2px to the left
  const cursorOffsetY = -2; // Move the effective click point 2px up

  const rect = canvasEl.getBoundingClientRect();
  const canvasX = mouseX + cursorOffsetX - rect.left;
  const canvasY = mouseY + cursorOffsetY - rect.top;
  const imageX = (canvasX - transform.translateX) / transform.zoom;
  const imageY = (canvasY - transform.translateY) / transform.zoom;
  return { canvasX, canvasY, imageX, imageY };
};

/**
 * Calculate initial centering transform for an image
 */
export const calculateCenteringTransform = (
  imageWidth: number,
  imageHeight: number,
  canvasWidth: number,
  canvasHeight: number
): TransformState => {
  const initialZoom = Math.min(
    canvasWidth / imageWidth,
    canvasHeight / imageHeight
  );

  const tx = canvasWidth / 2 - (imageWidth / 2) * initialZoom;
  const ty = canvasHeight / 2 - (imageHeight / 2) * initialZoom;

  return {
    zoom: initialZoom,
    translateX: tx,
    translateY: ty
  };
};
