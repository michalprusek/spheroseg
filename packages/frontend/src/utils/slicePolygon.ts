/**
 * Polygon Slicing Utilities
 * 
 * Functions for slicing polygons along lines or between vertices
 */

import { Point } from '@spheroseg/types';

export interface Polygon {
  points: Point[];
  closed: boolean;
  color?: string;
  id?: string;
  label?: string;
  [key: string]: any;
}

/**
 * Find the intersection point between two line segments
 */
export function findIntersectionPoint(
  line1Start: Point,
  line1End: Point,
  line2Start: Point,
  line2End: Point
): Point | null {
  const x1 = line1Start.x, y1 = line1Start.y;
  const x2 = line1End.x, y2 = line1End.y;
  const x3 = line2Start.x, y3 = line2Start.y;
  const x4 = line2End.x, y4 = line2End.y;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  
  // Lines are parallel
  if (Math.abs(denom) < 1e-10) {
    // Check if lines are collinear and overlapping
    const crossProduct1 = (x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1);
    const crossProduct2 = (x2 - x1) * (y4 - y1) - (y2 - y1) * (x4 - x1);
    
    if (Math.abs(crossProduct1) < 1e-10 && Math.abs(crossProduct2) < 1e-10) {
      // Lines are collinear, check for overlap
      const t1 = ((x3 - x1) * (x2 - x1) + (y3 - y1) * (y2 - y1)) / ((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
      const t2 = ((x4 - x1) * (x2 - x1) + (y4 - y1) * (y2 - y1)) / ((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
      
      // Check if line2Start is on line1
      if (t1 >= 0 && t1 <= 1) {
        return { x: x3, y: y3 };
      }
      // Check if line2End is on line1
      if (t2 >= 0 && t2 <= 1) {
        return { x: x4, y: y4 };
      }
      
      // Check if line1Start is on line2
      const s1 = ((x1 - x3) * (x4 - x3) + (y1 - y3) * (y4 - y3)) / ((x4 - x3) * (x4 - x3) + (y4 - y3) * (y4 - y3));
      if (s1 >= 0 && s1 <= 1) {
        return { x: x1, y: y1 };
      }
    }
    
    return null;
  }

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

  // Check if intersection point is within both line segments
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1)
    };
  }

  return null;
}

/**
 * Slice a polygon between two vertices
 * @param polygon The polygon to slice
 * @param vertex1 Index of the first vertex
 * @param vertex2 Index of the second vertex
 * @returns Array of resulting polygons, or empty array if invalid
 */
export function slicePolygon(
  polygon: Polygon,
  vertex1: number,
  vertex2: number
): Polygon[] {
  const points = polygon.points;
  const n = points.length;
  
  // Validate inputs
  if (!points || n < 3) {
    return [];
  }
  
  if (vertex1 < 0 || vertex1 >= n || vertex2 < 0 || vertex2 >= n) {
    return [];
  }
  
  if (vertex1 === vertex2) {
    return [];
  }
  
  // Ensure vertex1 < vertex2 for consistency
  let v1 = Math.min(vertex1, vertex2);
  let v2 = Math.max(vertex1, vertex2);
  
  // If vertices are adjacent, no slice is possible
  if (v2 - v1 === 1 || (v1 === 0 && v2 === n - 1)) {
    return [{ ...polygon }];
  }
  
  // Create two polygons
  const polygon1Points: Point[] = [];
  const polygon2Points: Point[] = [];
  
  // First polygon: from v1 to v2 (inclusive)
  for (let i = v1; i <= v2; i++) {
    polygon1Points.push(points[i]);
  }
  
  // Second polygon: from v2 to v1 (wrapping around)
  for (let i = v2; i !== v1; i = (i + 1) % n) {
    polygon2Points.push(points[i]);
  }
  polygon2Points.push(points[v1]); // Add the starting vertex
  
  // Create the resulting polygons, preserving properties
  const baseProps = { ...polygon };
  delete baseProps.points;
  delete baseProps.id; // Remove ID to avoid duplicates
  
  return [
    {
      ...baseProps,
      points: polygon1Points,
    },
    {
      ...baseProps,
      points: polygon2Points,
    }
  ];
}

/**
 * Slice a polygon with a line
 * @param polygon The polygon to slice
 * @param lineStart Start point of the slicing line
 * @param lineEnd End point of the slicing line
 * @returns Array of resulting polygons, or original polygon if no valid slice
 */
export function slicePolygonByLine(
  polygon: Polygon,
  lineStart: Point,
  lineEnd: Point
): Polygon[] {
  const points = polygon.points;
  const n = points.length;
  
  if (!points || n < 3) {
    return [polygon];
  }
  
  const intersections: Array<{
    point: Point;
    edgeIndex: number;
    t: number; // Parameter along the edge
  }> = [];
  
  // Find all intersections with polygon edges
  for (let i = 0; i < n; i++) {
    const edgeStart = points[i];
    const edgeEnd = points[(i + 1) % n];
    
    const intersection = findIntersectionPoint(
      edgeStart,
      edgeEnd,
      lineStart,
      lineEnd
    );
    
    if (intersection) {
      // Calculate parameter along the edge for sorting
      const edgeDx = edgeEnd.x - edgeStart.x;
      const edgeDy = edgeEnd.y - edgeStart.y;
      let t = 0;
      
      if (Math.abs(edgeDx) > Math.abs(edgeDy)) {
        t = (intersection.x - edgeStart.x) / edgeDx;
      } else if (Math.abs(edgeDy) > 0) {
        t = (intersection.y - edgeStart.y) / edgeDy;
      }
      
      intersections.push({
        point: intersection,
        edgeIndex: i,
        t
      });
    }
  }
  
  // Need exactly 2 intersections for a valid slice
  if (intersections.length !== 2) {
    return [polygon];
  }
  
  // Sort intersections by edge index and t
  intersections.sort((a, b) => {
    if (a.edgeIndex !== b.edgeIndex) {
      return a.edgeIndex - b.edgeIndex;
    }
    return a.t - b.t;
  });
  
  // Build the two polygons
  const polygon1Points: Point[] = [];
  const polygon2Points: Point[] = [];
  
  // Add points from start to first intersection
  for (let i = 0; i <= intersections[0].edgeIndex; i++) {
    polygon1Points.push(points[i]);
  }
  
  // Add first intersection point
  polygon1Points.push(intersections[0].point);
  
  // Add second intersection point to first polygon
  polygon1Points.push(intersections[1].point);
  
  // Add points after second intersection to complete first polygon
  for (let i = intersections[1].edgeIndex + 1; i < n; i++) {
    polygon1Points.push(points[i]);
  }
  
  // Build second polygon
  polygon2Points.push(intersections[0].point);
  
  // Add points between intersections
  for (let i = intersections[0].edgeIndex + 1; i <= intersections[1].edgeIndex; i++) {
    polygon2Points.push(points[i]);
  }
  
  polygon2Points.push(intersections[1].point);
  
  // Create the resulting polygons
  const baseProps = { ...polygon };
  delete baseProps.points;
  delete baseProps.id;
  
  return [
    {
      ...baseProps,
      points: polygon1Points,
    },
    {
      ...baseProps,
      points: polygon2Points,
    }
  ];
}