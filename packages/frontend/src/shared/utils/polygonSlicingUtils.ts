import { Point } from '@spheroseg/types';
import { v4 as uuidv4 } from 'uuid';
import { slicePolygon as slicePolygonPoints } from './polygonOperationsUtils';

/**
 * Interface representing a polygon with an ID and points
 */
export interface Polygon {
  id: string;
  points: Point[];
  type?: 'external' | 'internal';
}

/**
 * Determine which side of a line a point is on
 * Returns positive value if point is on one side, negative if on the other
 */
export const getPointSideOfLine = (point: Point, lineStart: Point, lineEnd: Point): number => {
  return (lineEnd.x - lineStart.x) * (point.y - lineStart.y) - (lineEnd.y - lineStart.y) * (point.x - lineStart.x);
};

/**
 * Calculate the intersection point of two lines
 */
export const calculateLineIntersection = (
  line1Start: Point,
  line1End: Point,
  line2Start: Point,
  line2End: Point,
): Point | null => {
  // Line 1 represented as a1x + b1y = c1
  const a1 = line1End.y - line1Start.y;
  const b1 = line1Start.x - line1End.x;
  const c1 = a1 * line1Start.x + b1 * line1Start.y;

  // Line 2 represented as a2x + b2y = c2
  const a2 = line2End.y - line2Start.y;
  const b2 = line2Start.x - line2End.x;
  const c2 = a2 * line2Start.x + b2 * line2Start.y;

  const determinant = a1 * b2 - a2 * b1;

  if (determinant === 0) {
    // Lines are parallel
    return null;
  }

  const x = (b2 * c1 - b1 * c2) / determinant;
  const y = (a1 * c2 - a2 * c1) / determinant;

  // Check if the intersection point is on both line segments
  const onSegment1 =
    Math.min(line1Start.x, line1End.x) <= x &&
    x <= Math.max(line1Start.x, line1End.x) &&
    Math.min(line1Start.y, line1End.y) <= y &&
    y <= Math.max(line1Start.y, line1End.y);

  const onSegment2 =
    Math.min(line2Start.x, line2End.x) <= x &&
    x <= Math.max(line2Start.x, line2End.x) &&
    Math.min(line2Start.y, line2End.y) <= y &&
    y <= Math.max(line2Start.y, line2End.y);

  if (onSegment1 && onSegment2) {
    return { x, y };
  }

  return null;
};

/**
 * Calculate the distance from a point to a line segment
 */
export const distanceToLineSegment = (point: Point, lineStart: Point, lineEnd: Point): number => {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  // Line length squared
  const lineLengthSquared = dx * dx + dy * dy;

  if (lineLengthSquared === 0) {
    // Line is actually a point
    return Math.sqrt(Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2));
  }

  // Calculate the projection of the point onto the line
  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lineLengthSquared;

  if (t < 0) {
    // Point is beyond the lineStart end of the line segment
    return Math.sqrt(Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2));
  }

  if (t > 1) {
    // Point is beyond the lineEnd end of the line segment
    return Math.sqrt(Math.pow(point.x - lineEnd.x, 2) + Math.pow(point.y - lineEnd.y, 2));
  }

  // Projection falls on the line segment
  const projectionX = lineStart.x + t * dx;
  const projectionY = lineStart.y + t * dy;

  return Math.sqrt(Math.pow(point.x - projectionX, 2) + Math.pow(point.y - projectionY, 2));
};

/**
 * Create a new polygon with the given points and type
 */
export const createPolygon = (points: Point[], type: 'external' | 'internal' = 'external'): Polygon => {
  return {
    id: uuidv4(),
    points,
    type,
  };
};

/**
 * Slice a polygon with a line
 */
export const slicePolygon = (polygon: Polygon, sliceStart: Point, sliceEnd: Point): Polygon[] | null => {
  try {
    const result = slicePolygonPoints(polygon.points, sliceStart, sliceEnd);

    if (!result || result.length < 2) {
      return null;
    }

    // Create new polygon objects from the result
    return result.map((points) => ({
      id: uuidv4(),
      points,
      type: polygon.type || 'external',
    }));
  } catch (error) {
    console.error('Error in slicePolygon:', error);
    return null;
  }
};
