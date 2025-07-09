/**
 * SVG path utilities for rendering complex polygons with holes
 */

import { Point, Polygon } from './segmentation/index';
import { createNamespacedLogger } from '@/utils/logger';
import { isPointInPolygon as isPointInPolygonUtil } from '@spheroseg/shared/utils/polygonUtils';

const CLogger = createNamespacedLogger('svgUtils');

/**
 * Creates an SVG path string for a polygon with optional holes
 *
 * @param points The points of the main polygon
 * @param holes Array of arrays of points representing holes in the polygon
 * @returns SVG path string
 */
export function createSvgPath(points: Point[], holes: Point[][] = []): string {
  if (!points || points.length < 3) {
    return '';
  }

  // Start with the main polygon path
  let path = `M ${points[0].x},${points[0].y} `;

  // Add the rest of the points
  for (let i = 1; i < points.length; i++) {
    path += `L ${points[i].x},${points[i].y} `;
  }

  // Close the main path
  path += 'Z ';

  // Add each hole (using the non-zero fill rule, holes must go in opposite direction)
  for (const hole of holes) {
    if (hole && hole.length >= 3) {
      // Start the hole path
      path += `M ${hole[0].x},${hole[0].y} `;

      // Add the rest of the points in reverse order for proper hole rendering
      for (let i = hole.length - 1; i > 0; i--) {
        path += `L ${hole[i].x},${hole[i].y} `;
      }

      // Close the hole path
      path += 'Z ';
    }
  }

  return path;
}

/**
 * Determines if a point is inside a polygon
 * Re-exported from unified polygon utilities
 *
 * @param point The point to check
 * @param polygon Array of points defining the polygon
 * @returns True if the point is inside the polygon
 */
export const isPointInPolygon = isPointInPolygonUtil;

/**
 * Scales polygon points to fit within a target size while maintaining aspect ratio
 *
 * @param polygons Array of polygons to scale
 * @param originalWidth Original width of the image
 * @param originalHeight Original height of the image
 * @param targetWidth Target width to scale to
 * @param targetHeight Target height to scale to
 * @returns Array of scaled polygons
 */
export function scalePolygons(
  polygons: Polygon[],
  originalWidth: number,
  originalHeight: number,
  targetWidth: number,
  targetHeight: number,
): Polygon[] {
  // Handle empty/null polygons array more gracefully
  if (!polygons || !Array.isArray(polygons) || polygons.length === 0) {
    CLogger.warn('[scalePolygons] No polygons to scale or invalid polygons array');
    return [];
  }

  // Ensure all dimensions are valid positive numbers
  if (
    !originalWidth ||
    !originalHeight ||
    !targetWidth ||
    !targetHeight ||
    originalWidth <= 0 ||
    originalHeight <= 0 ||
    targetWidth <= 0 ||
    targetHeight <= 0
  ) {
    CLogger.warn('[scalePolygons] Invalid dimensions:', {
      originalWidth,
      originalHeight,
      targetWidth,
      targetHeight,
    });
    return []; // Return empty array instead of potentially invalid polygons
  }

  CLogger.debug('[scalePolygons] Scaling polygons:', {
    polygonsCount: polygons.length,
    originalWidth,
    originalHeight,
    targetWidth,
    targetHeight,
  });

  // For debugging, log the first polygon's points
  if (polygons[0] && polygons[0].points && polygons[0].points.length > 0) {
    CLogger.debug('[scalePolygons] First polygon before scaling:', {
      id: polygons[0].id,
      type: polygons[0].type,
      pointsCount: polygons[0].points.length,
      firstPoints: polygons[0].points.slice(0, 3),
    });
  }

  // Calculate scale factors
  const scaleX = targetWidth / originalWidth;
  const scaleY = targetHeight / originalHeight;

  // Use uniform scaling with proper centering to maintain aspect ratio
  // This ensures polygons are displayed correctly regardless of image dimensions
  const useUniform = true;
  const scale = Math.min(scaleX, scaleY);

  CLogger.debug('[scalePolygons] Scale factors:', { scaleX, scaleY, uniformScale: scale });

  // Calculate offsets to center the image
  const offsetX = useUniform ? (targetWidth - originalWidth * scale) / 2 : 0;
  const offsetY = useUniform ? (targetHeight - originalHeight * scale) / 2 : 0;

  const result = polygons.map((polygon) => {
    if (!polygon.points || polygon.points.length === 0) {
      return polygon;
    }

    // Calculate scaled points - always use uniform scaling with offset
    // This ensures polygons maintain correct aspect ratio and are centered
    const scaledPoints = polygon.points.map((point) => ({
      x: point.x * scale + offsetX,
      y: point.y * scale + offsetY,
    }));

    // Include holes if they exist
    let scaledHoles = undefined;
    if (polygon.holes && Array.isArray(polygon.holes) && polygon.holes.length > 0) {
      scaledHoles = polygon.holes.map((holePoints: Point[]) =>
        holePoints.map((point: Point) => ({
          x: point.x * scale + offsetX,
          y: point.y * scale + offsetY,
        })),
      );
    }

    return {
      ...polygon,
      points: scaledPoints,
      holes: scaledHoles,
    };
  });

  // For debugging, log the first scaled polygon's points
  if (result[0] && result[0].points && result[0].points.length > 0) {
    CLogger.debug('[scalePolygons] First polygon after scaling:', {
      id: result[0].id,
      type: result[0].type,
      pointsCount: result[0].points.length,
      firstPoints: result[0].points.slice(0, 3),
    });
  }

  return result;
}

/**
 * Darkens a HEX color by a specified percentage.
 *
 * @param color The HEX color string (e.g., "#RRGGBB" or "#RGB")
 * @param percent The percentage to darken by (0-100). 100 means black, 0 means no change.
 * @returns The darkened HEX color string.
 */
export function darkenColor(color: string, percent: number): string {
  let r = parseInt(color.substring(1, 3), 16);
  let g = parseInt(color.substring(3, 5), 16);
  let b = parseInt(color.substring(5, 7), 16);

  if (color.length === 4) {
    // Handle shorthand #RGB
    r = parseInt(color.substring(1, 2) + color.substring(1, 2), 16);
    g = parseInt(color.substring(2, 3) + color.substring(2, 3), 16);
    b = parseInt(color.substring(3, 4) + color.substring(3, 4), 16);
  }

  const factor = 1 - percent / 100;

  r = Math.max(0, Math.min(255, Math.floor(r * factor)));
  g = Math.max(0, Math.min(255, Math.floor(g * factor)));
  b = Math.max(0, Math.min(255, Math.floor(b * factor)));

  const rr = r.toString(16).padStart(2, '0');
  const gg = g.toString(16).padStart(2, '0');
  const bb = b.toString(16).padStart(2, '0');

  return `#${rr}${gg}${bb}`;
}
