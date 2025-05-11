import { Point, Polygon } from '@/lib/segmentation';
import { slicePolygon as slicePolygonShared } from '../../../../../shared/utils/polygonSlicingUtils';

/**
 * Slices a polygon along a line defined by two points
 * @param polygon The polygon to slice
 * @param sliceStart The start point of the slice line
 * @param sliceEnd The end point of the slice line
 * @returns An array of two new polygons if slicing was successful, or null if slicing failed
 */
export function slicePolygon(polygon: Polygon, sliceStart: Point, sliceEnd: Point): [Polygon, Polygon] | null {
  // Use the shared implementation
  return slicePolygonShared(polygon, sliceStart, sliceEnd);
}
