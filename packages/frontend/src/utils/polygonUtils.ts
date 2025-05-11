/**
 * Centralized polygon utilities for geometric operations
 * This file provides a unified way to perform operations on polygons
 * across the application.
 *
 * @deprecated Import from @shared/utils/polygonOperationsUtils or other specialized modules directly for new code
 */

import { v4 as uuidv4 } from 'uuid';
import logger from '@/utils/logger';
import * as polygonOperationsUtils from '@shared/utils/polygonOperationsUtils';
import * as polygonSlicingUtils from '@shared/utils/polygonSlicingUtils';
import * as polygonWorkerUtils from '@shared/utils/polygonWorkerUtils';

/**
 * Point interface representing a 2D point
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Polygon interface representing a closed shape
 */
export interface Polygon {
  id: string;
  points: Point[];
  type?: 'external' | 'internal';
}

/**
 * Intersection interface representing an intersection point between a line and a polygon edge
 */
export interface Intersection {
  x: number;
  y: number;
  edgeIndex: number;
  distance: number;
}

/**
 * Bounding box interface
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
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
 * Check if a point is inside a polygon using the ray casting algorithm
 * @param x X coordinate of the point
 * @param y Y coordinate of the point
 * @param points Array of points defining the polygon
 * @returns True if the point is inside the polygon, false otherwise
 */
export const isPointInPolygon = (x: number, y: number, points: Point[]): boolean => {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

/**
 * Check if a point is inside a polygon (alternative version taking a Point object)
 * @param point Point to check
 * @param polygon Array of points defining the polygon
 * @returns True if the point is inside the polygon, false otherwise
 */
export const isPointInPolygonObj = (point: Point, polygon: Point[]): boolean => {
  return isPointInPolygon(point.x, point.y, polygon);
};

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
 * Calculate the perpendicular distance from a point to a line segment
 * @param point Point to calculate distance from
 * @param lineStart Start point of the line segment
 * @param lineEnd End point of the line segment
 * @returns Perpendicular distance from the point to the line segment
 */
export const perpendicularDistance = (point: Point, lineStart: Point, lineEnd: Point): number => {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  // If the line is just a point, return the distance to that point
  if (dx === 0 && dy === 0) {
    return distance(point, lineStart);
  }

  // Calculate the squared length of the line segment
  const lineLengthSquared = dx * dx + dy * dy;

  // Calculate the projection of the point onto the line
  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lineLengthSquared;

  // If the projection is outside the line segment, return the distance to the nearest endpoint
  if (t < 0) return distance(point, lineStart);
  if (t > 1) return distance(point, lineEnd);

  // Calculate the closest point on the line
  const closestPoint = {
    x: lineStart.x + t * dx,
    y: lineStart.y + t * dy,
  };

  // Return the distance to the closest point
  return distance(point, closestPoint);
};

/**
 * Calculate the intersection point between two line segments
 * @param p1 Start point of the first line segment
 * @param p2 End point of the first line segment
 * @param p3 Start point of the second line segment
 * @param p4 End point of the second line segment
 * @returns Intersection point or null if the lines don't intersect
 */
export const calculateIntersection = (p1: Point, p2: Point, p3: Point, p4: Point): Point | null => {
  // Calculate the determinant
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);

  // If the determinant is zero, the lines are parallel
  if (d === 0) return null;

  // Calculate the intersection point
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;

  // Check if the intersection is within both line segments
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: p1.x + t * (p2.x - p1.x),
      y: p1.y + t * (p2.y - p1.y),
    };
  }

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
  polygon: Point[],
): Intersection[] => {
  const intersections: Intersection[] = [];

  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    const intersection = calculateIntersection(lineStart, lineEnd, polygon[i], polygon[j]);

    if (intersection) {
      // Calculate the distance from the line start to the intersection
      const dist = distance(lineStart, intersection);

      // Add a small epsilon to avoid duplicate points
      const epsilon = 0.0001;
      const isDuplicate = intersections.some(
        (p) => Math.abs(p.x - intersection.x) < epsilon && Math.abs(p.y - intersection.y) < epsilon,
      );

      if (!isDuplicate) {
        intersections.push({
          x: intersection.x,
          y: intersection.y,
          edgeIndex: i,
          distance: dist,
        });
      }
    }
  }

  // Sort intersections by distance from the line start
  return intersections.sort((a, b) => a.distance - b.distance);
};

/**
 * Calculate the area of a polygon using the Shoelace formula
 * @param points Array of points defining the polygon
 * @returns Area of the polygon
 */
export const calculatePolygonArea = (points: Point[]): number => {
  let area = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }

  return Math.abs(area) / 2;
};

/**
 * Calculate the perimeter of a polygon
 * @param points Array of points defining the polygon
 * @returns Perimeter of the polygon
 */
export const calculatePerimeter = (points: Point[]): number => {
  let perimeter = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    perimeter += distance(points[i], points[j]);
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
    const cross = points[i].x * points[j].y - points[j].x * points[i].y;
    area += cross;
    cx += (points[i].x + points[j].x) * cross;
    cy += (points[i].y + points[j].y) * cross;
  }

  area /= 2;
  cx /= 6 * area;
  cy /= 6 * area;

  return { x: Math.abs(cx), y: Math.abs(cy) };
};

/**
 * Calculate the bounding box of a polygon
 * @param points Array of points defining the polygon
 * @returns Bounding box of the polygon
 */
export const calculateBoundingBox = (points: Point[]): BoundingBox => {
  if (points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;

  for (let i = 1; i < points.length; i++) {
    minX = Math.min(minX, points[i].x);
    minY = Math.min(minY, points[i].y);
    maxX = Math.max(maxX, points[i].x);
    maxY = Math.max(maxY, points[i].y);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

/**
 * Calculate the convex hull of a set of points using the Graham scan algorithm
 * @param points Array of points
 * @returns Array of points defining the convex hull
 */
export const calculateConvexHull = (points: Point[]): Point[] => {
  if (points.length <= 3) return [...points];

  // Find the point with the lowest y-coordinate (and leftmost if tied)
  let lowestPoint = points[0];
  for (let i = 1; i < points.length; i++) {
    if (points[i].y < lowestPoint.y || (points[i].y === lowestPoint.y && points[i].x < lowestPoint.x)) {
      lowestPoint = points[i];
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
    if (i === 0 || sortedPoints[i].x !== sortedPoints[i - 1].x || sortedPoints[i].y !== sortedPoints[i - 1].y) {
      uniquePoints.push(sortedPoints[i]);
    }
  }

  // Graham scan algorithm
  if (uniquePoints.length < 3) return uniquePoints;

  const hull: Point[] = [uniquePoints[0], uniquePoints[1]];

  for (let i = 2; i < uniquePoints.length; i++) {
    while (hull.length >= 2) {
      const n = hull.length;
      const p1 = hull[n - 2];
      const p2 = hull[n - 1];
      const p3 = uniquePoints[i];

      // Calculate the cross product to determine if we make a right turn
      const cross = (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);

      // If we make a right turn or go straight, pop the last point
      if (cross <= 0) {
        hull.pop();
      } else {
        break;
      }
    }

    hull.push(uniquePoints[i]);
  }

  return hull;
};

/**
 * Determine if a polygon is oriented clockwise
 * @param points Array of points defining the polygon
 * @returns True if the polygon is oriented clockwise, false otherwise
 */
export const isClockwise = (points: Point[]): boolean => {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    sum += (points[j].x - points[i].x) * (points[j].y + points[i].y);
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

/**
 * Simplify a polygon using the Ramer-Douglas-Peucker algorithm
 * @param points Array of points defining the polygon
 * @param epsilon Epsilon value for simplification (higher values result in more simplification)
 * @returns Simplified array of points
 */
export const simplifyPolygon = (points: Point[], epsilon: number): Point[] => {
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

  // If the maximum distance is greater than epsilon, recursively simplify
  if (maxDistance > epsilon) {
    // Recursive case
    const firstHalf = simplifyPolygon(points.slice(0, index + 1), epsilon);
    const secondHalf = simplifyPolygon(points.slice(index), epsilon);

    // Concatenate the two halves (removing the duplicate point)
    return [...firstHalf.slice(0, -1), ...secondHalf];
  } else {
    // Base case
    return [firstPoint, lastPoint];
  }
};

/**
 * Simplify a closed polygon using the Ramer-Douglas-Peucker algorithm
 * @param points Array of points defining the closed polygon
 * @param epsilon Epsilon value for simplification (higher values result in more simplification)
 * @returns Simplified array of points
 */
export const simplifyClosedPolygon = (points: Point[], epsilon: number): Point[] => {
  if (points.length <= 3) return points;

  // Find the point with the maximum distance from any other point
  let maxDistance = 0;
  let maxI = 0;
  let maxJ = 0;

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dist = distance(points[i], points[j]);
      if (dist > maxDistance) {
        maxDistance = dist;
        maxI = i;
        maxJ = j;
      }
    }
  }

  // Reorder the points to start at maxI and end at maxJ
  const reordered: Point[] = [];
  for (let i = maxI; i < points.length; i++) {
    reordered.push(points[i]);
  }
  for (let i = 0; i < maxI; i++) {
    reordered.push(points[i]);
  }

  // Simplify the reordered points
  const simplified = simplifyPolygon(reordered, epsilon);

  // Ensure the polygon is closed
  if (
    simplified.length > 0 &&
    (simplified[0].x !== simplified[simplified.length - 1].x || simplified[0].y !== simplified[simplified.length - 1].y)
  ) {
    simplified.push({ ...simplified[0] });
  }

  return simplified;
};

/**
 * Slice a polygon with a line
 * @param polygon Polygon to slice
 * @param sliceStart Start point of the slice line
 * @param sliceEnd End point of the slice line
 * @returns Object with success flag and resulting polygons
 */
export const slicePolygon = (
  polygon: Polygon,
  sliceStart: Point,
  sliceEnd: Point,
): { success: boolean; polygons: Polygon[] } => {
  const polygonPoints = polygon.points;

  // Find intersections between the slice line and the polygon
  const intersections = calculateLinePolygonIntersections(sliceStart, sliceEnd, polygonPoints);

  // We need exactly 2 intersections to slice the polygon
  if (intersections.length !== 2) {
    return { success: false, polygons: [] };
  }

  const int1 = intersections[0];
  const int2 = intersections[1];

  // Create the two new polygons
  const polygon1Points: Point[] = [];
  const polygon2Points: Point[] = [];

  // First polygon
  polygon1Points.push({ x: int1.x, y: int1.y });

  let i = (int1.edgeIndex + 1) % polygonPoints.length;
  while (i !== (int2.edgeIndex + 1) % polygonPoints.length) {
    polygon1Points.push({ ...polygonPoints[i] });
    i = (i + 1) % polygonPoints.length;
  }

  polygon1Points.push({ x: int2.x, y: int2.y });

  // Second polygon
  polygon2Points.push({ x: int2.x, y: int2.y });

  i = (int2.edgeIndex + 1) % polygonPoints.length;
  while (i !== (int1.edgeIndex + 1) % polygonPoints.length) {
    polygon2Points.push({ ...polygonPoints[i] });
    i = (i + 1) % polygonPoints.length;
  }

  polygon2Points.push({ x: int1.x, y: int1.y });

  // Ensure both polygons have at least 3 points
  if (polygon1Points.length >= 3 && polygon2Points.length >= 3) {
    // Create new polygon objects
    const newPolygon1 = {
      id: uuidv4(),
      points: polygon1Points,
      type: polygon.type || 'external',
    };

    const newPolygon2 = {
      id: uuidv4(),
      points: polygon2Points,
      type: polygon.type || 'external',
    };

    return { success: true, polygons: [newPolygon1, newPolygon2] };
  }

  // If we get here, slicing failed
  return { success: false, polygons: [] };
};

/**
 * Create a new polygon
 * @param points Array of points defining the polygon
 * @param type Type of polygon (external or internal)
 * @returns New polygon object
 */
export const createPolygon = (points: Point[], type: 'external' | 'internal' = 'external'): Polygon => {
  return {
    id: uuidv4(),
    points: [...points],
    type,
  };
};

/**
 * Check if two polygons intersect
 * @param poly1 First polygon
 * @param poly2 Second polygon
 * @returns True if the polygons intersect, false otherwise
 */
export const doPolygonsIntersect = (poly1: Point[], poly2: Point[]): boolean => {
  // Check if any point of poly1 is inside poly2
  for (const point of poly1) {
    if (isPointInPolygonObj(point, poly2)) {
      return true;
    }
  }

  // Check if any point of poly2 is inside poly1
  for (const point of poly2) {
    if (isPointInPolygonObj(point, poly1)) {
      return true;
    }
  }

  // Check if any edges intersect
  for (let i = 0; i < poly1.length; i++) {
    const j = (i + 1) % poly1.length;

    for (let k = 0; k < poly2.length; k++) {
      const l = (k + 1) % poly2.length;

      if (calculateIntersection(poly1[i], poly1[j], poly2[k], poly2[l])) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Calculate the Feret diameter (maximum caliper diameter) of a polygon
 * @param points Array of points defining the polygon
 * @returns Object with maximum diameter, minimum diameter, and angle
 */
export const calculateFeretDiameter = (points: Point[]): { max: number; min: number; angle: number } => {
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
    for (let j = i + 1; j < hull.length; j++) {
      const dist = distance(hull[i], hull[j]);

      if (dist > maxDiameter) {
        maxDiameter = dist;
        maxAngle = Math.atan2(hull[j].y - hull[i].y, hull[j].x - hull[i].x);
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
    angle: maxAngle,
  };
};

/**
 * Calculate comprehensive metrics for a polygon
 * @param polygon External polygon
 * @param holes Array of internal polygons (holes)
 * @returns Object with calculated metrics
 */
export const calculateMetrics = (polygon: Polygon, holes: Polygon[] = []): PolygonMetrics => {
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
    const perimeter = calculatePerimeter(polygon.points);

    // Calculate circularity
    const circularity = (4 * Math.PI * area) / (perimeter * perimeter);

    // Calculate equivalent diameter
    const equivalentDiameter = 2 * Math.sqrt(area / Math.PI);

    // Calculate bounding box
    const boundingBox = calculateBoundingBox(polygon.points);

    // Calculate aspect ratio
    const aspectRatio = boundingBox.width / boundingBox.height || 1;

    // Calculate convex hull
    const convexHull = calculateConvexHull(polygon.points);

    // Calculate convex hull area
    const convexHullArea = calculatePolygonArea(convexHull);

    // Calculate solidity
    const solidity = area / convexHullArea || 1;

    // Calculate convex hull perimeter
    const convexHullPerimeter = calculatePerimeter(convexHull);

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
      centroid,
    };
  } catch (error) {
    logger.error('Error calculating metrics:', { error });

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
        angle: 0,
      },
      centroid: { x: 0, y: 0 },
    };
  }
};

// Export default object with all methods
export default {
  isPointInPolygon,
  isPointInPolygonObj,
  distance,
  perpendicularDistance,
  calculateIntersection,
  calculateLinePolygonIntersections,
  calculatePolygonArea,
  calculatePerimeter,
  calculateCentroid,
  calculateBoundingBox,
  calculateConvexHull,
  isClockwise,
  ensureClockwise,
  ensureCounterClockwise,
  simplifyPolygon,
  simplifyClosedPolygon,
  slicePolygon,
  createPolygon,
  doPolygonsIntersect,
  calculateFeretDiameter,
  calculateMetrics,
};
