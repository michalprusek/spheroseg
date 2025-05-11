import { Point, Polygon } from './types';

/**
 * Minimum number of points required for a valid polygon
 */
export const MIN_POINTS_FOR_POLYGON = 3;

/**
 * Result of polygon validation
 */
export interface PolygonValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates if a polygon is valid for saving
 */
export const validatePolygon = (polygon: Polygon): PolygonValidationResult => {
  const errors: string[] = [];

  // Check if polygon has enough points
  if (!polygon.points || polygon.points.length < MIN_POINTS_FOR_POLYGON) {
    errors.push(`Polygon must have at least ${MIN_POINTS_FOR_POLYGON} points`);
  }

  // Check if polygon has a valid ID
  if (!polygon.id) {
    errors.push('Polygon must have an ID');
  }

  // Check if polygon has a valid type
  if (!polygon.type || !['external', 'internal'].includes(polygon.type)) {
    errors.push('Polygon must have a valid type (external or internal)');
  }

  // Check for duplicate points
  if (polygon.points) {
    const duplicatePoints = findDuplicatePoints(polygon.points);
    if (duplicatePoints.length > 0) {
      errors.push(`Polygon contains ${duplicatePoints.length} duplicate point(s)`);
    }
  }

  // Check for self-intersections
  if (polygon.points && polygon.points.length >= MIN_POINTS_FOR_POLYGON) {
    if (hasSelfIntersections(polygon.points)) {
      errors.push('Polygon has self-intersections');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validates a collection of polygons
 */
export const validatePolygons = (polygons: Polygon[]): PolygonValidationResult => {
  const errors: string[] = [];

  // Validate each polygon individually
  polygons.forEach((polygon, index) => {
    const result = validatePolygon(polygon);
    if (!result.isValid) {
      errors.push(`Polygon #${index + 1} (${polygon.id}): ${result.errors.join(', ')}`);
    }
  });

  // Check for duplicate IDs
  const ids = polygons.map((p) => p.id);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    errors.push(`Found ${duplicateIds.length} duplicate polygon ID(s): ${duplicateIds.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Finds duplicate points in a polygon
 */
const findDuplicatePoints = (points: Point[]): Point[] => {
  const duplicates: Point[] = [];

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if (arePointsEqual(points[i], points[j])) {
        duplicates.push(points[i]);
        break;
      }
    }
  }

  return duplicates;
};

/**
 * Checks if two points are equal (within a small epsilon)
 */
const arePointsEqual = (p1: Point, p2: Point, epsilon = 0.001): boolean => {
  return Math.abs(p1.x - p2.x) < epsilon && Math.abs(p1.y - p2.y) < epsilon;
};

/**
 * Checks if a line segment intersects with another line segment
 */
const doSegmentsIntersect = (p1: Point, p2: Point, p3: Point, p4: Point): boolean => {
  // Calculate direction vectors
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;

  // Calculate the determinant
  const det = d1x * d2y - d1y * d2x;

  // If determinant is zero, lines are parallel
  if (Math.abs(det) < 1e-10) return false;

  // Calculate parameters for the intersection point
  const dx = p3.x - p1.x;
  const dy = p3.y - p1.y;

  const t1 = (dx * d2y - dy * d2x) / det;
  const t2 = (dx * d1y - dy * d1x) / det;

  // Check if intersection point is within both line segments
  return t1 >= 0 && t1 <= 1 && t2 >= 0 && t2 <= 1;
};

/**
 * Checks if a polygon has self-intersections
 */
const hasSelfIntersections = (points: Point[]): boolean => {
  const n = points.length;

  // Need at least 4 points to have self-intersections
  if (n < 4) return false;

  // Check each pair of non-adjacent edges
  for (let i = 0; i < n; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % n];

    for (let j = i + 2; j < n; j++) {
      // Skip adjacent edges (j and i are adjacent when j is the last point and i is 0)
      if (j === n - 1 && i === 0) continue;

      const p3 = points[j];
      const p4 = points[(j + 1) % n];

      if (doSegmentsIntersect(p1, p2, p3, p4)) {
        return true;
      }
    }
  }

  return false;
};
