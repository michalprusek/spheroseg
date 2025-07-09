import { Point, Polygon } from '@/lib/segmentation';
import { slicePolygonObject } from '@spheroseg/shared/utils/polygonUtils';
import { v4 as uuidv4 } from 'uuid';

/**
 * Slices a polygon along a line defined by two points
 * @param polygon The polygon to slice
 * @param sliceStart The start point of the slice line
 * @param sliceEnd The end point of the slice line
 * @returns An array of two new polygons if slicing was successful, or null if slicing failed
 */
export function slicePolygon(polygon: Polygon, sliceStart: Point, sliceEnd: Point): [Polygon, Polygon] | null {
  console.log('[slicePolygon] Called with:', {
    polygonId: polygon.id,
    polygonPoints: polygon.points.length,
    sliceStart,
    sliceEnd,
  });

  // Use the shared implementation
  const result = slicePolygonObject(polygon, sliceStart, sliceEnd);

  console.log('[slicePolygon] Result from slicePolygonObject:', {
    success: result.success,
    polygonCount: result.polygons.length,
  });

  if (!result.success || result.polygons.length !== 2) {
    console.error('[slicePolygon] Failed:', result);
    return null;
  }

  // Ensure polygons have unique IDs
  const [poly1, poly2] = result.polygons;
  poly1.id = poly1.id || uuidv4();
  poly2.id = poly2.id || uuidv4();

  console.log('[slicePolygon] Success! Created polygons:', {
    poly1Id: poly1.id,
    poly1Points: poly1.points.length,
    poly2Id: poly2.id,
    poly2Points: poly2.points.length,
  });

  return [poly1, poly2];
}
