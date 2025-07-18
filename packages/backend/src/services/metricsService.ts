/**
 * Consolidated Metrics Service
 *
 * This service provides functions for calculating various metrics for polygons,
 * including area, perimeter, circularity, convex hull, etc.
 *
 * Uses the unified polygon utilities from @spheroseg/shared
 */

import {
  calculatePolygonArea,
  calculatePolygonPerimeter as calculatePerimeter,
  calculateBoundingBoxRect as calculateBoundingBox,
  calculateConvexHull,
  calculateMetrics,
} from '@spheroseg/shared';
import { Point, Polygon } from '../types/geometry';

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
  calculateMetrics,
};
