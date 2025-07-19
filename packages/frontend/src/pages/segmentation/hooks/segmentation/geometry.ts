import { Point, Polygon, SegmentationData } from './types';
import { polygonUtils } from '@spheroseg/shared';

/**
 * Check if a point is inside a polygon
 * @deprecated Use polygonUtils.isPointInPolygon instead
 */
export const isPointInPolygon = polygonUtils.isPointInPolygon;

/**
 * Calculate distance from a point to a line segment
 * @deprecated Use polygonUtils.perpendicularDistance instead
 */
export const distanceToSegment = (p: Point, v: Point, w: Point): number => {
  return polygonUtils.perpendicularDistance(p, v, w);
};

/**
 * Slice a polygon with a line
 * @deprecated Use polygonUtils.slicePolygon instead
 */
export const slicePolygon = (
  polygon: Polygon,
  sliceStart: Point,
  sliceEnd: Point,
): { success: boolean; polygons: Polygon[] } => {
  return polygonUtils.slicePolygon(polygon, sliceStart, sliceEnd);
};

/**
 * Create a new polygon
 * @deprecated Use polygonUtils.createPolygon instead
 */
export const createPolygon = (points: Point[], type: 'external' | 'internal' = 'external'): Polygon => {
  return polygonUtils.createPolygon(points, type);
};

/**
 * Update segmentation data with a new set of polygons
 */
export const updateSegmentationWithPolygons = (
  segmentationData: SegmentationData,
  polygons: Polygon[],
): SegmentationData => {
  return {
    ...segmentationData,
    polygons,
  };
};
