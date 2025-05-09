import { v4 as uuidv4 } from 'uuid';
import { Point, Polygon, Intersection, SegmentationData } from './types';
import usePolygonWorker from '../usePolygonWorker';
import { createLogger } from '@/lib/logger';
import {
  calculatePolygonAreaAsync,
  calculatePolygonPerimeterAsync,
  calculateBoundingBoxAsync,
  executePolygonWorkerOperation
} from '@/shared/utils/polygonWorkerUtils';
import {
  slicePolygon as slicePolygonShared,
  distanceToLineSegment,
  getPointSideOfLine,
  createPolygon
} from '@/shared/utils/polygonSlicingUtils';

const logger = createLogger('segmentation:geometry.worker');

/**
 * Check if a point is inside a polygon using WebWorker
 */
export const isPointInPolygonAsync = async (
  x: number,
  y: number,
  points: Point[],
  polygonWorker: ReturnType<typeof usePolygonWorker>
): Promise<boolean> => {
  try {
    if (!polygonWorker.isReady) {
      logger.warn('Polygon worker not ready, falling back to synchronous implementation');
      return isPointInPolygonSync(x, y, points);
    }

    return await polygonWorker.isPointInPolygon({ x, y }, points);
  } catch (error) {
    logger.error('Error in isPointInPolygonAsync:', error);
    return isPointInPolygonSync(x, y, points);
  }
};

/**
 * Synchronous fallback for point in polygon check
 */
export const isPointInPolygonSync = (x: number, y: number, points: Point[]): boolean => {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;

    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

/**
 * Calculate distance from a point to a line segment
 */
export const distanceToSegment = (p: Point, v: Point, w: Point): number => {
  return distanceToLineSegment(p, v, w);
};

/**
 * Slice a polygon with a line using WebWorker
 */
export const slicePolygonAsync = async (
  polygon: Polygon,
  sliceStart: Point,
  sliceEnd: Point,
  polygonWorker: ReturnType<typeof usePolygonWorker>
): Promise<{ success: boolean; polygons: Polygon[] }> => {
  try {
    if (!polygonWorker.isReady) {
      logger.warn('Polygon worker not ready, falling back to synchronous implementation');
      return slicePolygonSync(polygon, sliceStart, sliceEnd);
    }

    const result = await polygonWorker.slicePolygon(polygon.points, sliceStart, sliceEnd);

    if (!result || result.length < 2) {
      return { success: false, polygons: [] };
    }

    // Create new polygon objects from the result
    const newPolygons = result.map(points => ({
      id: uuidv4(),
      points,
      type: polygon.type || 'external'
    }));

    return { success: true, polygons: newPolygons };
  } catch (error) {
    logger.error('Error in slicePolygonAsync:', error);
    return slicePolygonSync(polygon, sliceStart, sliceEnd);
  }
};

/**
 * Synchronous fallback for slicing a polygon
 */
export const slicePolygonSync = (
  polygon: Polygon,
  sliceStart: Point,
  sliceEnd: Point
): { success: boolean; polygons: Polygon[] } => {
  const result = slicePolygonShared(polygon, sliceStart, sliceEnd);

  if (!result) {
    return { success: false, polygons: [] };
  }

  return { success: true, polygons: result };
};

/**
 * Create a new polygon
 */
export const createPolygonFn = (points: Point[], type: 'external' | 'internal' = 'external'): Polygon => {
  return createPolygon(points, type);
};

/**
 * Update segmentation data with a new set of polygons
 */
export const updateSegmentationWithPolygons = (
  segmentationData: SegmentationData,
  polygons: Polygon[]
): SegmentationData => {
  return {
    ...segmentationData,
    polygons
  };
};

/**
 * Simplify a polygon using the Ramer-Douglas-Peucker algorithm with WebWorker
 */
export const simplifyPolygonAsync = async (
  points: Point[],
  epsilon: number,
  polygonWorker: ReturnType<typeof usePolygonWorker>
): Promise<Point[]> => {
  return executePolygonWorkerOperation(
    points,
    polygonWorker,
    (pts) => polygonWorker.simplifyPolygon(pts, epsilon),
    'simplifyPolygonAsync',
    points
  );
};

// Export shared utility functions
export {
  calculatePolygonAreaAsync,
  calculatePolygonPerimeterAsync,
  calculateBoundingBoxAsync
};