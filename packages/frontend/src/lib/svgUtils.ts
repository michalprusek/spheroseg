/**
 * SVG path utilities for rendering complex polygons with holes
 */

import { Point } from './segmentation';

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
 * 
 * @param point The point to check
 * @param polygon Array of points defining the polygon
 * @returns True if the point is inside the polygon
 */
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  if (!polygon || polygon.length < 3) {
    return false;
  }
  
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    
    const intersect = ((yi > point.y) !== (yj > point.y)) &&
      (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    
    if (intersect) {
      inside = !inside;
    }
  }
  
  return inside;
}
