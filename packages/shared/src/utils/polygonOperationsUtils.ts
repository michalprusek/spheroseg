/**
 * Shared utility functions for polygon operations
 */
import { Point } from '@spheroseg/types';

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
 * Worker message types
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
 * Calculate the bounding box of a polygon
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
 * Check if a point is inside a polygon using ray casting algorithm
 */
export const isPointInPolygon = (point: Point, polygon: Point[]): boolean => {
  if (polygon.length < 3) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect = ((yi > point.y) !== (yj > point.y)) &&
      (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);

    if (intersect) inside = !inside;
  }

  return inside;
};

/**
 * Calculate the intersection point of two line segments
 */
export const calculateIntersection = (
  p1: Point, p2: Point, p3: Point, p4: Point
): Point | null => {
  // Line 1 represented as a1x + b1y = c1
  const a1 = p2.y - p1.y;
  const b1 = p1.x - p2.x;
  const c1 = a1 * p1.x + b1 * p1.y;

  // Line 2 represented as a2x + b2y = c2
  const a2 = p4.y - p3.y;
  const b2 = p3.x - p4.x;
  const c2 = a2 * p3.x + b2 * p3.y;

  const determinant = a1 * b2 - a2 * b1;

  if (determinant === 0) {
    // Lines are parallel
    return null;
  }

  const x = (b2 * c1 - b1 * c2) / determinant;
  const y = (a1 * c2 - a2 * c1) / determinant;

  // Check if the intersection point is on both line segments
  const onSegment1 = 
    Math.min(p1.x, p2.x) <= x && x <= Math.max(p1.x, p2.x) &&
    Math.min(p1.y, p2.y) <= y && y <= Math.max(p1.y, p2.y);
  
  const onSegment2 = 
    Math.min(p3.x, p4.x) <= x && x <= Math.max(p3.x, p4.x) &&
    Math.min(p3.y, p4.y) <= y && y <= Math.max(p3.y, p4.y);

  if (onSegment1 && onSegment2) {
    return { x, y };
  }

  return null;
};

/**
 * Calculate all intersection points between a line and a polygon
 */
export const calculateLinePolygonIntersections = (
  lineStart: Point, 
  lineEnd: Point, 
  polygon: Point[]
): Point[] => {
  const intersections: Point[] = [];

  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    const intersection = calculateIntersection(
      lineStart, lineEnd, polygon[i], polygon[j]
    );

    if (intersection) {
      // Add a small epsilon to avoid duplicate points
      const epsilon = 0.0001;
      const isDuplicate = intersections.some(p => 
        Math.abs(p.x - intersection.x) < epsilon && 
        Math.abs(p.y - intersection.y) < epsilon
      );

      if (!isDuplicate) {
        intersections.push(intersection);
      }
    }
  }

  return intersections;
};

/**
 * Calculate perpendicular distance from a point to a line
 */
export const perpendicularDistance = (
  point: Point, 
  lineStart: Point, 
  lineEnd: Point
): number => {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  
  // Line length
  const lineLengthSquared = dx * dx + dy * dy;
  
  if (lineLengthSquared === 0) {
    // Line is actually a point
    return Math.sqrt(
      Math.pow(point.x - lineStart.x, 2) + 
      Math.pow(point.y - lineStart.y, 2)
    );
  }
  
  // Calculate the projection of the point onto the line
  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lineLengthSquared;
  
  if (t < 0) {
    // Point is beyond the lineStart end of the line segment
    return Math.sqrt(
      Math.pow(point.x - lineStart.x, 2) + 
      Math.pow(point.y - lineStart.y, 2)
    );
  }
  
  if (t > 1) {
    // Point is beyond the lineEnd end of the line segment
    return Math.sqrt(
      Math.pow(point.x - lineEnd.x, 2) + 
      Math.pow(point.y - lineEnd.y, 2)
    );
  }
  
  // Projection falls on the line segment
  const projectionX = lineStart.x + t * dx;
  const projectionY = lineStart.y + t * dy;
  
  return Math.sqrt(
    Math.pow(point.x - projectionX, 2) + 
    Math.pow(point.y - projectionY, 2)
  );
};

/**
 * Slice a polygon with a line
 */
export const slicePolygon = (
  polygon: Point[], 
  sliceStart: Point, 
  sliceEnd: Point
): Point[][] => {
  // Find intersections
  const intersections = calculateLinePolygonIntersections(
    sliceStart, sliceEnd, polygon
  );

  // If we don't have exactly 2 intersections, we can't slice properly
  if (intersections.length !== 2) {
    return [polygon]; // Return original polygon
  }

  // Sort intersections by distance from slice start
  intersections.sort((a, b) => {
    const distA = Math.pow(a.x - sliceStart.x, 2) + Math.pow(a.y - sliceStart.y, 2);
    const distB = Math.pow(b.x - sliceStart.x, 2) + Math.pow(b.y - sliceStart.y, 2);
    return distA - distB;
  });

  // Find the polygon edges that contain the intersections
  const intersectionEdges: number[] = [];
  
  for (const intersection of intersections) {
    for (let i = 0; i < polygon.length; i++) {
      const j = (i + 1) % polygon.length;
      const p1 = polygon[i];
      const p2 = polygon[j];
      
      const intersection2 = calculateIntersection(
        sliceStart, sliceEnd, p1, p2
      );
      
      if (intersection2) {
        const epsilon = 0.0001;
        if (
          Math.abs(intersection.x - intersection2.x) < epsilon && 
          Math.abs(intersection.y - intersection2.y) < epsilon
        ) {
          intersectionEdges.push(i);
          break;
        }
      }
    }
  }

  // Create two new polygons
  const poly1: Point[] = [];
  const poly2: Point[] = [];

  // First polygon: from edge1 to edge2 via one side
  let currentIndex = intersectionEdges[0];
  poly1.push(intersections[0]);
  
  while (currentIndex !== intersectionEdges[1]) {
    currentIndex = (currentIndex + 1) % polygon.length;
    poly1.push(polygon[currentIndex]);
  }
  
  poly1.push(intersections[1]);

  // Second polygon: from edge2 to edge1 via the other side
  currentIndex = intersectionEdges[1];
  poly2.push(intersections[1]);
  
  while (currentIndex !== intersectionEdges[0]) {
    currentIndex = (currentIndex + 1) % polygon.length;
    poly2.push(polygon[currentIndex]);
  }
  
  poly2.push(intersections[0]);

  return [poly1, poly2];
};

/**
 * Calculate polygon area using the Shoelace formula
 */
export const calculatePolygonArea = (points: Point[]): number => {
  let area = 0;
  
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  
  return Math.abs(area / 2);
};

/**
 * Calculate polygon perimeter
 */
export const calculatePolygonPerimeter = (points: Point[]): number => {
  let perimeter = 0;
  
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    perimeter += Math.sqrt(
      Math.pow(points[j].x - points[i].x, 2) + 
      Math.pow(points[j].y - points[i].y, 2)
    );
  }
  
  return perimeter;
};

/**
 * Simplify a polygon using the Ramer-Douglas-Peucker algorithm
 */
export const simplifyPolygon = (
  points: Point[], 
  epsilon: number
): Point[] => {
  if (points.length <= 2) return points;

  // Find the point with the maximum distance
  let maxDistance = 0;
  let index = 0;
  
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  
  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], firstPoint, lastPoint);
    
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }
  
  // If max distance is greater than epsilon, recursively simplify
  if (maxDistance > epsilon) {
    // Recursive call
    const firstHalf = simplifyPolygon(points.slice(0, index + 1), epsilon);
    const secondHalf = simplifyPolygon(points.slice(index), epsilon);
    
    // Concatenate the two parts
    return firstHalf.slice(0, -1).concat(secondHalf);
  } else {
    // Base case - return just the endpoints
    return [firstPoint, lastPoint];
  }
};

/**
 * Check if a bounding box is visible in the viewport
 * Adds a margin to ensure polygons that are partially visible are included
 */
export const isBoxVisible = (
  box: BoundingBox,
  viewport: BoundingBox,
  margin: number = 100
): boolean => {
  // Add margin to viewport
  const viewportWithMargin = {
    minX: viewport.minX - margin,
    minY: viewport.minY - margin,
    maxX: viewport.maxX + margin,
    maxY: viewport.maxY + margin
  };

  // Check if the boxes overlap
  return !(
    box.maxX < viewportWithMargin.minX ||
    box.minX > viewportWithMargin.maxX ||
    box.maxY < viewportWithMargin.minY ||
    box.minY > viewportWithMargin.maxY
  );
};

/**
 * Memoize bounding box calculations for polygons
 */
export class PolygonBoundingBoxCache {
  private cache: Map<string, BoundingBox> = new Map();
  
  /**
   * Get the bounding box for a polygon, calculating it if not cached
   */
  getBoundingBox(polygonId: string, points: Point[]): BoundingBox {
    if (!this.cache.has(polygonId)) {
      this.cache.set(polygonId, calculateBoundingBox(points));
    }
    return this.cache.get(polygonId)!;
  }
  
  /**
   * Invalidate the cache for a specific polygon
   */
  invalidate(polygonId: string): void {
    this.cache.delete(polygonId);
  }
  
  /**
   * Clear the entire cache
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Get the number of cached bounding boxes
   */
  size(): number {
    return this.cache.size;
  }
}

// Create a singleton instance
export const polygonBoundingBoxCache = new PolygonBoundingBoxCache();