import { Point } from '@/lib/segmentation';

export function screenToImageCoordinates(screenPoint: Point, zoom: number, offset: { x: number; y: number }): Point {
  return {
    x: (screenPoint.x - offset.x) / zoom,
    y: (screenPoint.y - offset.y) / zoom,
  };
}

export function imageToScreenCoordinates(imagePoint: Point, zoom: number, offset: { x: number; y: number }): Point {
  return {
    x: imagePoint.x * zoom + offset.x,
    y: imagePoint.y * zoom + offset.y,
  };
}

export function getCanvasCoordinates(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number },
  zoom: number,
  offset: { x: number; y: number },
) {
  const canvasX = clientX - rect.left;
  const canvasY = clientY - rect.top;
  const { x, y } = screenToImageCoordinates({ x: canvasX, y: canvasY }, zoom, offset);

  // Logging removed for better performance

  return { x, y, canvasX, canvasY };
}
