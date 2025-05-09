/**
 * Consolidated Metrics Service
 * 
 * This service provides functions for calculating various metrics for polygons,
 * including area, perimeter, circularity, convex hull, etc.
 * 
 * It consolidates duplicate implementations from:
 * - src/services/metricsService.ts
 * - server/src/services/metricsService.ts
 */

import { Point, Polygon } from '../types/geometry';

/**
 * Calculate the area of a polygon using the Shoelace formula
 * @param points Array of points defining the polygon
 * @returns Area of the polygon
 */
export const calculatePolygonArea = (points: Point[]): number => {
  if (points.length < 3) return 0;
  
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  
  return Math.abs(area / 2);
};

/**
 * Calculate the perimeter of a polygon
 * @param points Array of points defining the polygon
 * @returns Perimeter of the polygon
 */
export const calculatePerimeter = (points: Point[]): number => {
  if (points.length < 2) return 0;
  
  let perimeter = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const dx = points[j].x - points[i].x;
    const dy = points[j].y - points[i].y;
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }
  
  return perimeter;
};

/**
 * Calculate the bounding box of a polygon
 * @param points Array of points defining the polygon
 * @returns Bounding box as {x, y, width, height}
 */
export const calculateBoundingBox = (points: Point[]): { x: number; y: number; width: number; height: number } => {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  
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
    height: maxY - minY
  };
};

/**
 * Calculate the convex hull of a polygon using Graham scan algorithm
 * @param points Array of points defining the polygon
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
      const distA = Math.pow(a.x - lowestPoint.x, 2) + Math.pow(a.y - lowestPoint.y, 2);
      const distB = Math.pow(b.x - lowestPoint.x, 2) + Math.pow(b.y - lowestPoint.y, 2);
      return distA - distB;
    }
    
    return angleA - angleB;
  });
  
  // Remove duplicate points
  const uniquePoints: Point[] = [];
  for (let i = 0; i < sortedPoints.length; i++) {
    if (i === 0 || sortedPoints[i].x !== sortedPoints[i-1].x || sortedPoints[i].y !== sortedPoints[i-1].y) {
      uniquePoints.push(sortedPoints[i]);
    }
  }
  
  // Graham scan algorithm
  if (uniquePoints.length <= 3) return uniquePoints;
  
  const hull: Point[] = [uniquePoints[0], uniquePoints[1]];
  
  for (let i = 2; i < uniquePoints.length; i++) {
    while (
      hull.length >= 2 &&
      !isLeftTurn(hull[hull.length - 2], hull[hull.length - 1], uniquePoints[i])
    ) {
      hull.pop();
    }
    hull.push(uniquePoints[i]);
  }
  
  return hull;
};

/**
 * Helper function to determine if three points make a left turn
 */
const isLeftTurn = (p1: Point, p2: Point, p3: Point): boolean => {
  return (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x) > 0;
};

/**
 * Calculate the area of the convex hull
 * @param points Array of points defining the polygon
 * @returns Area of the convex hull
 */
export const calculateConvexHullArea = (points: Point[]): number => {
  const hull = calculateConvexHull(points);
  return calculatePolygonArea(hull);
};

/**
 * Calculate the equivalent diameter of a polygon
 * @param area Area of the polygon
 * @returns Equivalent diameter
 */
export const calculateEquivalentDiameter = (area: number): number => {
  return 2 * Math.sqrt(area / Math.PI);
};

/**
 * Calculate the circularity of a polygon
 * @param area Area of the polygon
 * @param perimeter Perimeter of the polygon
 * @returns Circularity value (1 for a perfect circle)
 */
export const calculateCircularity = (area: number, perimeter: number): number => {
  if (perimeter === 0) return 0;
  return (4 * Math.PI * area) / (perimeter * perimeter);
};

/**
 * Calculate the aspect ratio of a polygon
 * @param points Array of points defining the polygon
 * @returns Aspect ratio (width/height)
 */
export const calculateAspectRatio = (points: Point[]): number => {
  const bbox = calculateBoundingBox(points);
  if (bbox.height === 0) return 0;
  return bbox.width / bbox.height;
};

/**
 * Calculate the solidity of a polygon (area / convex hull area)
 * @param area Area of the polygon
 * @param convexHullArea Area of the convex hull
 * @returns Solidity value (1 for a convex polygon)
 */
export const calculateSolidity = (area: number, convexHullArea: number): number => {
  if (convexHullArea === 0) return 0;
  return area / convexHullArea;
};

/**
 * Calculate the compactness of a polygon
 * @param area Area of the polygon
 * @param perimeter Perimeter of the polygon
 * @returns Compactness value
 */
export const calculateCompactness = (area: number, perimeter: number): number => {
  if (perimeter === 0) return 0;
  return Math.sqrt(4 * Math.PI * area) / perimeter;
};

/**
 * Calculate the sphericity of a polygon
 * @param area Area of the polygon
 * @param perimeter Perimeter of the polygon
 * @returns Sphericity value
 */
export const calculateSphericity = (area: number, perimeter: number): number => {
  if (perimeter === 0) return 0;
  return (2 * Math.sqrt(Math.PI * area)) / perimeter;
};

/**
 * Calculate all metrics for a polygon
 * @param polygon Polygon to calculate metrics for
 * @param holes Array of holes in the polygon (optional)
 * @returns Object containing all calculated metrics
 */
export const calculateMetrics = (
  polygon: Polygon | Point[],
  holes: Polygon[] | Point[][] = []
): Record<string, number> => {
  // Extract points from polygon
  const points = Array.isArray(polygon) ? polygon : polygon.points;
  
  // Calculate basic metrics
  const area = calculatePolygonArea(points);
  const perimeter = calculatePerimeter(points);
  const convexHullArea = calculateConvexHullArea(points);
  
  // Calculate derived metrics
  const circularity = calculateCircularity(area, perimeter);
  const equivalentDiameter = calculateEquivalentDiameter(area);
  const aspectRatio = calculateAspectRatio(points);
  const solidity = calculateSolidity(area, convexHullArea);
  const compactness = calculateCompactness(area, perimeter);
  const sphericity = calculateSphericity(area, perimeter);
  
  // Calculate metrics for holes
  let holesArea = 0;
  let holesPerimeter = 0;
  
  for (const hole of holes) {
    const holePoints = Array.isArray(hole) ? hole : hole.points;
    holesArea += calculatePolygonArea(holePoints);
    holesPerimeter += calculatePerimeter(holePoints);
  }
  
  // Calculate total area (external - holes)
  const totalArea = area - holesArea;
  
  return {
    Area: totalArea,
    Perimeter: perimeter + holesPerimeter,
    Circularity: circularity,
    EquivalentDiameter: equivalentDiameter,
    AspectRatio: aspectRatio,
    Solidity: solidity,
    Convexity: solidity, // Alias for solidity
    Compactness: compactness,
    Sphericity: sphericity,
    HolesArea: holesArea,
    HolesCount: holes.length
  };
};

export default {
  calculatePolygonArea,
  calculatePerimeter,
  calculateBoundingBox,
  calculateConvexHull,
  calculateConvexHullArea,
  calculateEquivalentDiameter,
  calculateCircularity,
  calculateAspectRatio,
  calculateSolidity,
  calculateCompactness,
  calculateSphericity,
  calculateMetrics
};
