/**
 * Geometry utilities re-exported from the unified polygon utilities
 * This file maintains backward compatibility with existing imports
 */

export {
  isPointInPolygon,
  calculatePolygonArea,
  isClockwise,
  ensureClockwise,
} from '@spheroseg/shared/utils/polygonUtils';

/**
 * Calculates the distance from a point to a line segment
 * Note: This is a specialized function not in the unified utilities
 */
export const distanceToSegment = (
  p: { x: number; y: number },
  v: { x: number; y: number },
  w: { x: number; y: number },
): number => {
  const lengthSquared = Math.pow(w.x - v.x, 2) + Math.pow(w.y - v.y, 2);
  if (lengthSquared === 0) return Math.sqrt(Math.pow(p.x - v.x, 2) + Math.pow(p.y - v.y, 2));

  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / lengthSquared;
  t = Math.max(0, Math.min(1, t));

  return Math.sqrt(Math.pow(p.x - (v.x + t * (w.x - v.x)), 2) + Math.pow(p.y - (v.y + t * (w.y - v.y)), 2));
};
