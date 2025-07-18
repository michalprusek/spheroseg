/**
 * Unified Polygon Utilities
 * 
 * This file provides a comprehensive set of polygon-related utilities,
 * consolidating all functions from across the codebase into a single module.
 * 
 * Includes:
 * - Basic geometric calculations (area, perimeter, bounding box, centroid)
 * - Point-in-polygon tests
 * - Distance calculations
 * - Line-polygon intersections
 * - Polygon slicing and splitting
 * - Convex hull calculation
 * - Polygon orientation (clockwise/counter-clockwise)
 * - Polygon simplification algorithms
 * - Polygon intersection tests
 * - Feret diameter calculations
 * - Comprehensive polygon metrics
 * - WebWorker operations for performance
 * - Caching and optimization utilities
 */

import { Point } from '@spheroseg/types';
import { v4 as uuidv4 } from 'uuid';

// Re-export Point type for convenience
export type { Point } from '@spheroseg/types';

// =============================================================================
// INTERFACES AND TYPES
// =============================================================================

/**
 * Interface representing a bounding box
 */
export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Alternative bounding box format (for compatibility)
 */
export interface BoundingBoxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Generic Polygon interface
 */
export interface Polygon {
  id: string;
  points: Point[];
  type?: 'external' | 'internal';
  [key: string]: unknown; // Allow for additional properties
}

/**
 * Intersection interface used for polygon slicing
 */
export interface Intersection extends Point {
  edgeIndex: number;
  distance?: number;
}

/**
 * Metrics interface for polygon measurements
 */
export interface PolygonMetrics {
  area: number;
  perimeter: number;
  circularity: number;
  equivalentDiameter: number;
  aspectRatio: number;
  solidity: number;
  convexity: number;
  compactness: number;
  sphericity: number;
  feretDiameter: {
    max: number;
    min: number;
    angle: number;
  };
  centroid: Point;
}

/**
 * Worker message types for WebWorker operations
 */
export interface WorkerRequest {
  id: string;
  operation: string;
  data: Record<string, unknown>;
}

export interface WorkerResponse {
  id: string;
  operation: string;
  result: unknown;
  error?: string;
}

/**
 * Interface for the polygon worker
 */
export interface PolygonWorker {
  isReady: boolean;
  calculatePolygonArea: (points: Point[]) => Promise<number>;
  calculatePolygonPerimeter: (points: Point[]) => Promise<number>;
  calculateBoundingBox: (points: Point[]) => Promise<BoundingBox | null>;
}

// =============================================================================
// BASIC GEOMETRIC CALCULATIONS
// =============================================================================

/**
 * Calculate the distance between two points
 * @param p1 First point
 * @param p2 Second point
 * @returns Distance between the points
 */
export const distance = (p1: Point, p2: Point): number => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Calculate the bounding box of a polygon
 * @param points Array of points defining the polygon
 * @returns Bounding box of the polygon
 */
export const calculateBoundingBox = (points: Point[]): BoundingBox => {
  if (!points.length) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return { minX, minY, maxX, maxY };
};

/**
 * Calculate the bounding box in rect format (x, y, width, height)
 * @param points Array of points defining the polygon
 * @returns Bounding box in rect format
 */
export const calculateBoundingBoxRect = (points: Point[]): BoundingBoxRect => {
  const box = calculateBoundingBox(points);
  return {
    x: box.minX,
    y: box.minY,
    width: box.maxX - box.minX,
    height: box.maxY - box.minY
  };
};

/**
 * Calculate polygon area using the Shoelace formula
 * @param points Array of points defining the polygon
 * @returns Area of the polygon
 */
export const calculatePolygonArea = (points: Point[]): number => {
  if (points.length < 3) return 0;
  
  let area = 0;
  const n = points.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const pi = points[i];
    const pj = points[j];
    if (pi && pj) {
      area += pi.x * pj.y;
      area -= pj.x * pi.y;
    }
  }
  
  return Math.abs(area / 2);
};

/**
 * Calculate polygon perimeter
 * @param points Array of points defining the polygon
 * @returns Perimeter of the polygon
 */
export const calculatePolygonPerimeter = (points: Point[]): number => {
  if (points.length < 2) return 0;
  
  let perimeter = 0;
  const n = points.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const p1 = points[i];
    const p2 = points[j];
    if (p1 && p2) {
      perimeter += distance(p1, p2);
    }
  }
  
  return perimeter;
};

/**
 * Calculate the centroid of a polygon
 * @param points Array of points defining the polygon
 * @returns Centroid of the polygon
 */
export const calculateCentroid = (points: Point[]): Point => {
  let area = 0;
  let cx = 0;
  let cy = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const p1 = points[i];
    const p2 = points[j];
    if (p1 && p2) {
      const cross = p1.x * p2.y - p2.x * p1.y;
      area += cross;
      cx += (p1.x + p2.x) * cross;
      cy += (p1.y + p2.y) * cross;
    }
  }

  area /= 2;
  cx /= 6 * area;
  cy /= 6 * area;

  return { x: Math.abs(cx), y: Math.abs(cy) };
};

// =============================================================================
// POINT-IN-POLYGON AND LINE OPERATIONS
// =============================================================================

/**
 * Check if a point is inside a polygon using ray casting algorithm
 * @param point Point to check
 * @param polygon Array of points defining the polygon
 * @returns True if the point is inside the polygon, false otherwise
 */
export const isPointInPolygon = (point: Point, polygon: Point[]): boolean => {
  if (polygon.length < 3) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i];
    const pj = polygon[j];
    if (!pi || !pj) continue;
    const xi = pi.x;
    const yi = pi.y;
    const xj = pj.x;
    const yj = pj.y;

    const intersect = ((yi > point.y) !== (yj > point.y)) &&
      (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);

    if (intersect) inside = !inside;
  }

  return inside;
};

/**
 * Check if a point is inside a polygon (alternative signature for compatibility)
 * @param x X coordinate of the point
 * @param y Y coordinate of the point
 * @param points Array of points defining the polygon
 * @returns True if the point is inside the polygon, false otherwise
 */
export const isPointInPolygonXY = (x: number, y: number, points: Point[]): boolean => {
  return isPointInPolygon({ x, y }, points);
};

/**
 * Determines which side of a line a point falls on
 * @param point Point to check
 * @param lineStart Start point of the line
 * @param lineEnd End point of the line
 * @returns Positive value if point is on one side, negative if on the other, 0 if on the line
 */
export const getPointSideOfLine = (
  point: Point, 
  lineStart: Point, 
  lineEnd: Point
): number => {
  const value = (lineEnd.x - lineStart.x) * (point.y - lineStart.y) -
                (lineEnd.y - lineStart.y) * (point.x - lineStart.x);
  return value > 0 ? 1 : (value < 0 ? -1 : 0);
};

/**
 * Calculate perpendicular distance from a point to a line segment
 * @param point Point to calculate distance from
 * @param lineStart Start point of the line segment
 * @param lineEnd End point of the line segment
 * @returns Perpendicular distance from the point to the line segment
 */
export const perpendicularDistance = (
  point: Point, 
  lineStart: Point, 
  lineEnd: Point
): number => {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  
  const lineLengthSquared = dx * dx + dy * dy;
  
  if (lineLengthSquared === 0) {
    return distance(point, lineStart);
  }
  
  const t = Math.max(0, Math.min(1, 
    ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lineLengthSquared
  ));
  
  const projectionX = lineStart.x + t * dx;
  const projectionY = lineStart.y + t * dy;
  
  return distance(point, { x: projectionX, y: projectionY });
};

// =============================================================================
// LINE INTERSECTION CALCULATIONS
// =============================================================================

/**
 * Calculate the intersection point of two line segments
 * @param p1 Start point of the first line segment
 * @param p2 End point of the first line segment
 * @param p3 Start point of the second line segment
 * @param p4 End point of the second line segment
 * @returns Intersection point or null if the lines don't intersect
 */
export const calculateIntersection = (
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point
): Point | null => {
  const x1 = p1.x, y1 = p1.y;
  const x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y;
  const x4 = p4.x, y4 = p4.y;

  const denominator = ((y4 - y3) * (x2 - x1)) - ((x4 - x3) * (y2 - y1));

  if (denominator === 0) {
    return null; // Lines are parallel
  }

  const ua = (((x4 - x3) * (y1 - y3)) - ((y4 - y3) * (x1 - x3))) / denominator;
  const ub = (((x2 - x1) * (y1 - y3)) - ((y2 - y1) * (x1 - x3))) / denominator;

  // Check if intersection is within both line segments
  if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
    return {
      x: x1 + ua * (x2 - x1),
      y: y1 + ua * (y2 - y1)
    };
  }

  return null;
};

/**
 * Calculate the intersection point of an infinite line with a line segment
 * Used for polygon slicing where the slice line extends infinitely
 * @param lineStart Start point of the infinite line
 * @param lineEnd End point of the infinite line (defines direction)
 * @param segStart Start point of the line segment
 * @param segEnd End point of the line segment
 * @returns Intersection point or null if the lines don't intersect
 */
export const calculateLineSegmentIntersection = (
  lineStart: Point,
  lineEnd: Point,
  segStart: Point,
  segEnd: Point
): Point | null => {
  const x1 = lineStart.x, y1 = lineStart.y;
  const x2 = lineEnd.x, y2 = lineEnd.y;
  const x3 = segStart.x, y3 = segStart.y;
  const x4 = segEnd.x, y4 = segEnd.y;

  const denominator = ((y4 - y3) * (x2 - x1)) - ((x4 - x3) * (y2 - y1));

  if (denominator === 0) {
    return null; // Lines are parallel
  }

  const ua = (((x4 - x3) * (y1 - y3)) - ((y4 - y3) * (x1 - x3))) / denominator;
  const ub = (((x2 - x1) * (y1 - y3)) - ((y2 - y1) * (x1 - x3))) / denominator;

  // Only check if intersection is within the polygon edge segment (ub)
  // We treat the slice line as infinite, so we don't check ua bounds
  // The slice line extends infinitely in both directions
  if (ub >= 0 && ub <= 1) {
    const intersection = {
      x: x1 + ua * (x2 - x1),
      y: y1 + ua * (y2 - y1)
    };
    // Only log detailed info if explicitly enabled
    // Debug logging (disabled in production)
    // if (false) { // Set to true for debugging
    //   console.log('[calculateLineSegmentIntersection] Intersection found:', {
    //     ua,
    //     ub,
    //     intersection,
    //     lineStart,
    //     lineEnd,
    //     segStart,
    //     segEnd
    //   });
    // }
    return intersection;
  }
  
  // Debug logging (disabled in production)  
  // if (false) { // Set to true for debugging
  //   console.log('[calculateLineSegmentIntersection] No intersection:', {
  //     ua,
  //     ub,
  //     lineStart,
  //     lineEnd,
  //     segStart,
  //     segEnd
  //   });
  // }

  return null;
};

/**
 * Calculate all intersection points between a line and a polygon
 * @param lineStart Start point of the line
 * @param lineEnd End point of the line
 * @param polygon Array of points defining the polygon
 * @returns Array of intersection points with edge indices and distances
 */
export const calculateLinePolygonIntersections = (
  lineStart: Point, 
  lineEnd: Point, 
  polygon: Point[]
): Intersection[] => {
  // Debug logging (disabled in production)
  // console.log('[calculateLinePolygonIntersections] Called with:', {
  //   lineStart,
  //   lineEnd,
  //   polygonPoints: polygon.length,
  //   polygonBounds: polygon.length > 0 ? {
  //     minX: Math.min(...polygon.map(p => p.x)),
  //     maxX: Math.max(...polygon.map(p => p.x)),
  //     minY: Math.min(...polygon.map(p => p.y)),
  //     maxY: Math.max(...polygon.map(p => p.y))
  //   } : null
  // });
  
  // Extend the line far beyond the polygon bounds to ensure intersections
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lineLength = Math.sqrt(dx * dx + dy * dy);
  
  if (lineLength === 0) {
    // Debug logging (disabled in production)
    // console.log('[calculateLinePolygonIntersections] Line has zero length, returning empty');
    return [];
  }
  
  // Normalize direction
  const dirX = dx / lineLength;
  const dirY = dy / lineLength;
  
  // Extend the line by a large factor (10000 units in each direction)
  const extendFactor = 10000;
  const extendedStart = {
    x: lineStart.x - dirX * extendFactor,
    y: lineStart.y - dirY * extendFactor
  };
  const extendedEnd = {
    x: lineEnd.x + dirX * extendFactor,
    y: lineEnd.y + dirY * extendFactor
  };
  
  // Debug logging (disabled in production)
  // console.log('[calculateLinePolygonIntersections] Extended line:', {
  //   original: { lineStart, lineEnd },
  //   extended: { extendedStart, extendedEnd }
  // });
  
  const intersections: Intersection[] = [];

  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    const p1 = polygon[i];
    const p2 = polygon[j];
    if (!p1 || !p2) continue;
    // Use the extended line for intersection calculation
    const intersection = calculateLineSegmentIntersection(
      extendedStart, extendedEnd, p1, p2
    );

    if (intersection) {
      // Debug logging (disabled in production)
      // console.log(`[calculateLinePolygonIntersections] Found intersection at edge ${i}->>${j}:`, {
      //   intersection,
      //   edge: `(${polygon[i].x}, ${polygon[i].y}) -> (${polygon[j].x}, ${polygon[j].y})`
      // });
      // Calculate distance from line start for sorting
      const dist = distance(lineStart, intersection);

      // Check for duplicates with small epsilon
      const epsilon = 0.0001;
      const isDuplicate = intersections.some(p => 
        Math.abs(p.x - intersection.x) < epsilon && 
        Math.abs(p.y - intersection.y) < epsilon
      );

      if (!isDuplicate) {
        intersections.push({
          x: intersection.x,
          y: intersection.y,
          edgeIndex: i,
          distance: dist
        });
      }
    }
  }

  // Sort by distance from line start
  intersections.sort((a, b) => (a.distance || 0) - (b.distance || 0));
  
  return intersections;
};

// =============================================================================
// CONVEX HULL CALCULATION
// =============================================================================

/**
 * Calculate the convex hull of a set of points using the Graham scan algorithm
 * @param points Array of points
 * @returns Array of points defining the convex hull
 */
export const calculateConvexHull = (points: Point[]): Point[] => {
  if (points.length <= 3) return [...points];

  // Find the point with the lowest y-coordinate (and leftmost if tied)
  let lowestPoint = points[0];
  if (!lowestPoint) return [];
  
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (!p) continue;
    if (p.y < lowestPoint.y || 
        (p.y === lowestPoint.y && p.x < lowestPoint.x)) {
      lowestPoint = p;
    }
  }

  // Sort points by polar angle with respect to the lowest point
  const sortedPoints = [...points].sort((a, b) => {
    if (a === lowestPoint) return -1;
    if (b === lowestPoint) return 1;

    const angleA = Math.atan2(a.y - lowestPoint.y, a.x - lowestPoint.x);
    const angleB = Math.atan2(b.y - lowestPoint.y, b.x - lowestPoint.x);

    if (angleA === angleB) {
      // If angles are the same, sort by distance from the lowest point
      const distA = distance(a, lowestPoint);
      const distB = distance(b, lowestPoint);
      return distA - distB;
    }

    return angleA - angleB;
  });

  // Remove duplicates
  const uniquePoints: Point[] = [];
  for (let i = 0; i < sortedPoints.length; i++) {
    const current = sortedPoints[i];
    const previous = i > 0 ? sortedPoints[i - 1] : undefined;
    if (!current) continue;
    
    if (i === 0 || !previous ||
        current.x !== previous.x || 
        current.y !== previous.y) {
      uniquePoints.push(current);
    }
  }

  // Graham scan algorithm
  if (uniquePoints.length < 3) return uniquePoints;

  const firstPoint = uniquePoints[0];
  const secondPoint = uniquePoints[1];
  if (!firstPoint || !secondPoint) return uniquePoints;
  
  const hull: Point[] = [firstPoint, secondPoint];

  for (let i = 2; i < uniquePoints.length; i++) {
    while (hull.length >= 2) {
      const n = hull.length;
      const p1 = hull[n - 2];
      const p2 = hull[n - 1];
      const p3 = uniquePoints[i];
      
      if (!p1 || !p2 || !p3) break;

      // Calculate the cross product to determine if we make a right turn
      const cross = (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);

      // If we make a right turn or go straight, pop the last point
      if (cross <= 0) {
        hull.pop();
      } else {
        break;
      }
    }

    const point = uniquePoints[i];
    if (point) {
      hull.push(point);
    }
  }

  return hull;
};

// =============================================================================
// POLYGON ORIENTATION
// =============================================================================

/**
 * Determine if a polygon is oriented clockwise
 * @param points Array of points defining the polygon
 * @returns True if the polygon is oriented clockwise, false otherwise
 */
export const isClockwise = (points: Point[]): boolean => {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const p1 = points[i];
    const p2 = points[j];
    if (p1 && p2) {
      sum += (p2.x - p1.x) * (p2.y + p1.y);
    }
  }
  return sum > 0;
};

/**
 * Ensure a polygon is oriented clockwise
 * @param points Array of points defining the polygon
 * @returns Array of points with clockwise orientation
 */
export const ensureClockwise = (points: Point[]): Point[] => {
  if (!isClockwise(points)) {
    return [...points].reverse();
  }
  return points;
};

/**
 * Ensure a polygon is oriented counter-clockwise
 * @param points Array of points defining the polygon
 * @returns Array of points with counter-clockwise orientation
 */
export const ensureCounterClockwise = (points: Point[]): Point[] => {
  if (isClockwise(points)) {
    return [...points].reverse();
  }
  return points;
};

// =============================================================================
// POLYGON SLICING AND SPLITTING
// =============================================================================

/**
 * Slice a polygon with a line, returning two new polygons
 * @param polygon Array of points defining the polygon
 * @param sliceStart Start point of the slice line
 * @param sliceEnd End point of the slice line
 * @returns Array of sliced polygons (0, 1, or 2 polygons)
 */
export const slicePolygon = (
  polygon: Point[], 
  sliceStart: Point, 
  sliceEnd: Point
): Point[][] => {
  // Debug logging (disabled in production)
  // console.log('[slicePolygon unified] Called with:', {
  //   polygonPoints: polygon.length,
  //   sliceStart,
  //   sliceEnd,
  //   polygonBounds: polygon.length > 0 ? {
  //     minX: Math.min(...polygon.map(p => p.x)),
  //     maxX: Math.max(...polygon.map(p => p.x)),
  //     minY: Math.min(...polygon.map(p => p.y)),
  //     maxY: Math.max(...polygon.map(p => p.y))
  //   } : null,
  //   firstFewPoints: polygon.slice(0, 5).map((p, i) => `[${i}]: (${p.x}, ${p.y})`)
  // });
  
  const intersections = calculateLinePolygonIntersections(
    sliceStart, sliceEnd, polygon
  );

  // Debug logging (disabled in production)
  // console.log('[slicePolygon unified] Found intersections:', intersections.length, intersections);

  // Need exactly 2 intersections to slice properly
  if (intersections.length !== 2) {
    // Debug logging (disabled in production)
    // console.log('[slicePolygon unified] Wrong number of intersections, returning original polygon');
    return [polygon]; // Return original polygon
  }

  const [int1, int2] = intersections;
  if (!int1 || !int2) {
    return [polygon]; // Return original polygon if intersections are invalid
  }
  
  // Create two new polygons
  const poly1: Point[] = [];
  const poly2: Point[] = [];

  // Add first intersection
  poly1.push({ x: int1.x, y: int1.y });
  
  // Add points from first edge to second edge
  let currentIndex = (int1.edgeIndex + 1) % polygon.length;
  while (currentIndex !== (int2.edgeIndex + 1) % polygon.length) {
    const point = polygon[currentIndex];
    if (point) {
      poly1.push(point);
    }
    currentIndex = (currentIndex + 1) % polygon.length;
  }
  
  // Add second intersection
  poly1.push({ x: int2.x, y: int2.y });

  // Create second polygon with remaining points
  poly2.push({ x: int2.x, y: int2.y });
  
  currentIndex = (int2.edgeIndex + 1) % polygon.length;
  while (currentIndex !== (int1.edgeIndex + 1) % polygon.length) {
    const point = polygon[currentIndex];
    if (point) {
      poly2.push(point);
    }
    currentIndex = (currentIndex + 1) % polygon.length;
  }
  
  poly2.push({ x: int1.x, y: int1.y });

  // Filter out degenerate polygons (less than 3 points)
  const result: Point[][] = [];
  if (poly1.length >= 3) result.push(poly1);
  if (poly2.length >= 3) result.push(poly2);
  
  return result.length > 0 ? result : [polygon];
};

/**
 * Slice a polygon object, returning new polygon objects
 * @param polygon Polygon object to slice
 * @param sliceStart Start point of the slice line
 * @param sliceEnd End point of the slice line
 * @returns Object with success flag and resulting polygons
 */
export const slicePolygonObject = (
  polygon: Polygon,
  sliceStart: Point,
  sliceEnd: Point
): { success: boolean; polygons: Polygon[] } => {
  const slicedPoints = slicePolygon(polygon.points, sliceStart, sliceEnd);
  
  if (slicedPoints.length === 1 && slicedPoints[0] === polygon.points) {
    return { success: false, polygons: [] };
  }

  const polygons = slicedPoints.map((points, index) => ({
    id: index === 0 ? polygon.id : uuidv4(),
    points,
    type: polygon.type || 'external' as const,
    ...Object.fromEntries(
      Object.entries(polygon).filter(([key]) => !['id', 'points', 'type'].includes(key))
    )
  }));

  return { success: true, polygons };
};

// =============================================================================
// POLYGON SIMPLIFICATION
// =============================================================================

/**
 * Simplify a polygon using the Ramer-Douglas-Peucker algorithm
 * @param points Array of points defining the polygon
 * @param epsilon Epsilon value for simplification (higher values = more simplification)
 * @returns Simplified array of points
 */
export const simplifyPolygon = (
  points: Point[], 
  epsilon: number = 2.0
): Point[] => {
  if (points.length <= 2) return points;

  // Find the point with the maximum distance
  let maxDistance = 0;
  let index = 0;

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  
  if (!firstPoint || !lastPoint) {
    return points; // Return original if endpoints are invalid
  }

  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    if (!p) continue;
    const dist = perpendicularDistance(p, firstPoint, lastPoint);

    if (dist > maxDistance) {
      maxDistance = dist;
      index = i;
    }
  }

  // If max distance is greater than epsilon, recursively simplify
  if (maxDistance > epsilon) {
    // Recursive case
    const firstHalf = simplifyPolygon(points.slice(0, index + 1), epsilon);
    const secondHalf = simplifyPolygon(points.slice(index), epsilon);

    // Concatenate the two halves (removing the duplicate point)
    return [...firstHalf.slice(0, -1), ...secondHalf];
  } else {
    // Base case
    return [firstPoint, lastPoint].filter((p): p is Point => p !== undefined);
  }
};

/**
 * Simplify a closed polygon using the Ramer-Douglas-Peucker algorithm
 * @param points Array of points defining the closed polygon
 * @param epsilon Epsilon value for simplification (higher values = more simplification)
 * @returns Simplified array of points
 */
export const simplifyClosedPolygon = (points: Point[], epsilon: number): Point[] => {
  if (points.length <= 3) return points;

  // Find the point with the maximum distance from any other point
  let maxDistance = 0;
  let maxI = 0;
  // let maxJ = 0;

  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    if (!p1) continue;
    for (let j = i + 1; j < points.length; j++) {
      const p2 = points[j];
      if (!p2) continue;
      const dist = distance(p1, p2);
      if (dist > maxDistance) {
        maxDistance = dist;
        maxI = i;
        // maxJ = j;
      }
    }
  }

  // Reorder the points to start at maxI and end at maxJ
  const reordered: Point[] = [];
  for (let i = maxI; i < points.length; i++) {
    const p = points[i];
    if (p) {
      reordered.push(p);
    }
  }
  for (let i = 0; i < maxI; i++) {
    const p = points[i];
    if (p) {
      reordered.push(p);
    }
  }

  // Simplify the reordered points
  const simplified = simplifyPolygon(reordered, epsilon);

  // Ensure the polygon is closed
  const firstPoint = simplified[0];
  const lastPoint = simplified[simplified.length - 1];
  if (simplified.length > 0 && firstPoint && lastPoint &&
      (firstPoint.x !== lastPoint.x || 
       firstPoint.y !== lastPoint.y)) {
    simplified.push({ ...firstPoint });
  }

  return simplified;
};

// =============================================================================
// POLYGON INTERSECTION
// =============================================================================

/**
 * Check if two polygons intersect
 * @param poly1 First polygon
 * @param poly2 Second polygon
 * @returns True if the polygons intersect, false otherwise
 */
export const doPolygonsIntersect = (poly1: Point[], poly2: Point[]): boolean => {
  // Check if any point of poly1 is inside poly2
  for (const point of poly1) {
    if (isPointInPolygon(point, poly2)) {
      return true;
    }
  }

  // Check if any point of poly2 is inside poly1
  for (const point of poly2) {
    if (isPointInPolygon(point, poly1)) {
      return true;
    }
  }

  // Check if any edges intersect
  for (let i = 0; i < poly1.length; i++) {
    const j = (i + 1) % poly1.length;

    for (let k = 0; k < poly2.length; k++) {
      const l = (k + 1) % poly2.length;

      const p1i = poly1[i];
      const p1j = poly1[j];
      const p2k = poly2[k];
      const p2l = poly2[l];
      
      if (p1i && p1j && p2k && p2l && calculateIntersection(p1i, p1j, p2k, p2l)) {
        return true;
      }
    }
  }

  return false;
};

// =============================================================================
// FERET DIAMETER
// =============================================================================

/**
 * Calculate the Feret diameter (maximum caliper diameter) of a polygon
 * @param points Array of points defining the polygon
 * @returns Object with maximum diameter, minimum diameter, and angle
 */
export const calculateFeretDiameter = (
  points: Point[]
): { max: number; min: number; angle: number } => {
  if (points.length < 2) {
    return { max: 0, min: Infinity, angle: 0 };
  }

  let maxDiameter = 0;
  let maxAngle = 0;
  let minDiameter = Infinity;

  // Calculate the convex hull first
  const hull = calculateConvexHull(points);

  // For each pair of points in the convex hull
  for (let i = 0; i < hull.length; i++) {
    const p1 = hull[i];
    if (!p1) continue;
    
    for (let j = i + 1; j < hull.length; j++) {
      const p2 = hull[j];
      if (!p2) continue;
      
      const dist = distance(p1, p2);

      if (dist > maxDiameter) {
        maxDiameter = dist;
        maxAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      }
    }
  }

  // Calculate the minimum diameter (orthogonal to the maximum diameter)
  const orthogonalAngle = maxAngle + Math.PI / 2;
  const cosAngle = Math.cos(orthogonalAngle);
  const sinAngle = Math.sin(orthogonalAngle);

  // Project all points onto the orthogonal axis
  let minProj = Infinity;
  let maxProj = -Infinity;

  for (const point of hull) {
    const proj = point.x * cosAngle + point.y * sinAngle;
    minProj = Math.min(minProj, proj);
    maxProj = Math.max(maxProj, proj);
  }

  minDiameter = maxProj - minProj;

  return {
    max: maxDiameter,
    min: minDiameter,
    angle: maxAngle
  };
};

// =============================================================================
// COMPREHENSIVE METRICS
// =============================================================================

/**
 * Calculate comprehensive metrics for a polygon
 * @param polygon External polygon
 * @param holes Array of internal polygons (holes)
 * @returns Object with calculated metrics
 */
export const calculateMetrics = (
  polygon: Polygon, 
  holes: Polygon[] = []
): PolygonMetrics => {
  try {
    // Calculate area of the external polygon
    const externalArea = calculatePolygonArea(polygon.points);

    // Calculate area of holes
    let holesArea = 0;
    for (const hole of holes) {
      holesArea += calculatePolygonArea(hole.points);
    }

    // Total area is external area minus holes area
    const area = externalArea - holesArea;

    // Calculate perimeter
    const perimeter = calculatePolygonPerimeter(polygon.points);

    // Calculate circularity
    const circularity = (4 * Math.PI * area) / (perimeter * perimeter);

    // Calculate equivalent diameter
    const equivalentDiameter = 2 * Math.sqrt(area / Math.PI);

    // Calculate bounding box
    const boundingBox = calculateBoundingBoxRect(polygon.points);

    // Calculate aspect ratio
    const aspectRatio = boundingBox.width / boundingBox.height || 1;

    // Calculate convex hull
    const convexHull = calculateConvexHull(polygon.points);

    // Calculate convex hull area
    const convexHullArea = calculatePolygonArea(convexHull);

    // Calculate solidity
    const solidity = area / convexHullArea || 1;

    // Calculate convex hull perimeter
    const convexHullPerimeter = calculatePolygonPerimeter(convexHull);

    // Calculate convexity
    const convexity = convexHullPerimeter / perimeter || 1;

    // Calculate compactness
    const compactness = (4 * Math.PI * area) / (perimeter * perimeter) || 1;

    // Calculate sphericity
    const sphericity = Math.sqrt(4 * Math.PI * area) / perimeter || 1;

    // Calculate Feret diameter
    const feretDiameter = calculateFeretDiameter(polygon.points);

    // Calculate centroid
    const centroid = calculateCentroid(polygon.points);

    return {
      area,
      perimeter,
      circularity,
      equivalentDiameter,
      aspectRatio,
      solidity,
      convexity,
      compactness,
      sphericity,
      feretDiameter,
      centroid
    };
  } catch (error) {
    // Debug logging (disabled in production)
    // console.error('Error calculating metrics:', error);

    // Return default metrics
    return {
      area: 0,
      perimeter: 0,
      circularity: 0,
      equivalentDiameter: 0,
      aspectRatio: 1,
      solidity: 1,
      convexity: 1,
      compactness: 1,
      sphericity: 1,
      feretDiameter: {
        max: 0,
        min: 0,
        angle: 0
      },
      centroid: { x: 0, y: 0 }
    };
  }
};

// =============================================================================
// VIEWPORT AND VISIBILITY
// =============================================================================

/**
 * Check if a bounding box is visible in the viewport
 * @param box Bounding box to check
 * @param viewport Viewport bounding box
 * @param margin Margin to add to viewport (default: 100)
 * @returns True if the box is visible in the viewport
 */
export const isBoxVisible = (
  box: BoundingBox,
  viewport: BoundingBox,
  margin: number = 100
): boolean => {
  const viewportWithMargin = {
    minX: viewport.minX - margin,
    minY: viewport.minY - margin,
    maxX: viewport.maxX + margin,
    maxY: viewport.maxY + margin
  };

  return !(
    box.maxX < viewportWithMargin.minX ||
    box.minX > viewportWithMargin.maxX ||
    box.maxY < viewportWithMargin.minY ||
    box.minY > viewportWithMargin.maxY
  );
};

// =============================================================================
// WEBWORKER OPERATIONS
// =============================================================================

/**
 * Base function to execute polygon worker operations with error handling
 */
export const executePolygonWorkerOperation = async <T>(
  points: Point[],
  polygonWorker: PolygonWorker,
  operation: (points: Point[]) => Promise<T>,
  operationName: string,
  defaultValue: T
): Promise<T> => {
  try {
    if (!polygonWorker.isReady) {
      return defaultValue;
    }

    return await operation(points);
  } catch (error) {
    // Debug logging (disabled in production)
    // console.warn(`Polygon worker operation ${operationName} failed:`, error);
    return defaultValue;
  }
};

/**
 * Calculate polygon area using WebWorker
 */
export const calculatePolygonAreaAsync = async (
  points: Point[],
  polygonWorker: PolygonWorker
): Promise<number> => {
  return executePolygonWorkerOperation(
    points,
    polygonWorker,
    (pts) => polygonWorker.calculatePolygonArea(pts),
    'calculatePolygonAreaAsync',
    0
  );
};

/**
 * Calculate polygon perimeter using WebWorker
 */
export const calculatePolygonPerimeterAsync = async (
  points: Point[],
  polygonWorker: PolygonWorker
): Promise<number> => {
  return executePolygonWorkerOperation(
    points,
    polygonWorker,
    (pts) => polygonWorker.calculatePolygonPerimeter(pts),
    'calculatePolygonPerimeterAsync',
    0
  );
};

/**
 * Calculate bounding box using WebWorker
 */
export const calculateBoundingBoxAsync = async (
  points: Point[],
  polygonWorker: PolygonWorker
): Promise<BoundingBox | null> => {
  return executePolygonWorkerOperation(
    points,
    polygonWorker,
    (pts) => polygonWorker.calculateBoundingBox(pts),
    'calculateBoundingBoxAsync',
    null
  );
};

// =============================================================================
// CACHING AND OPTIMIZATION
// =============================================================================

/**
 * Memoize bounding box calculations for polygons
 */
export class PolygonBoundingBoxCache {
  private cache: Map<string, BoundingBox> = new Map();
  
  getBoundingBox(polygonId: string, points: Point[]): BoundingBox {
    if (!this.cache.has(polygonId)) {
      this.cache.set(polygonId, calculateBoundingBox(points));
    }
    return this.cache.get(polygonId)!;
  }
  
  invalidate(polygonId: string): void {
    this.cache.delete(polygonId);
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  size(): number {
    return this.cache.size;
  }
}

// Create a singleton instance
export const polygonBoundingBoxCache = new PolygonBoundingBoxCache();

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Create a new polygon with a unique ID
 */
export const createPolygon = (
  points: Point[],
  type: 'external' | 'internal' = 'external',
  additionalProps: Record<string, unknown> = {}
): Polygon => ({
  id: uuidv4(),
  points,
  type,
  ...additionalProps
});

/**
 * Clone a polygon with a new ID
 */
export const clonePolygon = (polygon: Polygon): Polygon => ({
  ...polygon,
  id: uuidv4(),
  points: [...polygon.points]
});

/**
 * Validate polygon has minimum required points
 */
export const isValidPolygon = (points: Point[]): boolean => {
  return points.length >= 3;
};

// =============================================================================
// EXPORTS FOR BACKWARD COMPATIBILITY
// =============================================================================

// Legacy function names for compatibility
export const isPointInPolygonObj = isPointInPolygon;
export const calculateLineIntersection = calculateIntersection;
export const getBoundingBox = calculateBoundingBox;
export const getPolygonArea = calculatePolygonArea;
export const getPolygonPerimeter = calculatePolygonPerimeter;
export const distanceToLineSegment = perpendicularDistance;

// Default export with all functions
export default {
  // Basic calculations
  distance,
  calculateBoundingBox,
  calculateBoundingBoxRect,
  calculatePolygonArea,
  calculatePolygonPerimeter,
  calculateCentroid,
  
  // Point operations
  isPointInPolygon,
  isPointInPolygonXY,
  isPointInPolygonObj,
  getPointSideOfLine,
  perpendicularDistance,
  distanceToLineSegment,
  
  // Line intersections
  calculateIntersection,
  calculateLineIntersection,
  calculateLinePolygonIntersections,
  
  // Convex hull
  calculateConvexHull,
  
  // Orientation
  isClockwise,
  ensureClockwise,
  ensureCounterClockwise,
  
  // Polygon operations
  slicePolygon,
  slicePolygonObject,
  simplifyPolygon,
  simplifyClosedPolygon,
  doPolygonsIntersect,
  
  // Metrics
  calculateFeretDiameter,
  calculateMetrics,
  
  // Visibility
  isBoxVisible,
  
  // WebWorker operations
  calculatePolygonAreaAsync,
  calculatePolygonPerimeterAsync,
  calculateBoundingBoxAsync,
  executePolygonWorkerOperation,
  
  // Utilities
  createPolygon,
  clonePolygon,
  isValidPolygon,
  
  // Cache
  polygonBoundingBoxCache
};