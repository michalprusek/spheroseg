import { Point } from '../types';

/**
 * Determines if a point is inside a polygon using the ray casting algorithm
 */
export const isPointInPolygon = (point: Point, polygon: Point[]): boolean => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }
  return inside;
};

/**
 * Calculates the distance from a point to a line segment
 */
export const distanceToSegment = (p: Point, v: Point, w: Point): number => {
  const lengthSquared = Math.pow(w.x - v.x, 2) + Math.pow(w.y - v.y, 2);
  if (lengthSquared === 0) return Math.sqrt(Math.pow(p.x - v.x, 2) + Math.pow(p.y - v.y, 2));

  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / lengthSquared;
  t = Math.max(0, Math.min(1, t));

  return Math.sqrt(Math.pow(p.x - (v.x + t * (w.x - v.x)), 2) + Math.pow(p.y - (v.y + t * (w.y - v.y)), 2));
};

/**
 * Calculates the area of a polygon
 */
export const calculatePolygonArea = (points: Point[]): number => {
  let area = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    area += (points[j].x + points[i].x) * (points[j].y - points[i].y);
  }
  return Math.abs(area / 2);
};

/**
 * Determines if a polygon is oriented clockwise
 */
export const isClockwise = (points: Point[]): boolean => {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    sum += (points[j].x - points[i].x) * (points[j].y + points[i].y);
  }
  return sum > 0;
};

/**
 * Ensures a polygon's points are in clockwise order
 */
export const ensureClockwise = (points: Point[]): Point[] => {
  if (!isClockwise(points)) {
    return [...points].reverse();
  }
  return points;
};
