/**
 * Metric Calculations Utility
 * 
 * Functions for calculating polygon and cell metrics
 */

import { Polygon } from '@/pages/segmentation/types';

export interface PolygonMetrics {
  area: number;
  perimeter: number;
  circularity: number;
  centroid: { x: number; y: number };
  boundingBox: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
}

/**
 * Calculate the area of a polygon using the shoelace formula
 */
export function calculatePolygonArea(points: Array<{ x: number; y: number }>): number {
  if (!points || points.length < 3) return 0;
  
  let area = 0;
  const n = points.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  
  return Math.abs(area / 2);
}

/**
 * Calculate the perimeter of a polygon
 */
export function calculatePolygonPerimeter(points: Array<{ x: number; y: number }>): number {
  if (!points || points.length < 2) return 0;
  
  let perimeter = 0;
  const n = points.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = points[j].x - points[i].x;
    const dy = points[j].y - points[i].y;
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }
  
  return perimeter;
}

/**
 * Calculate the circularity of a polygon (4π × area / perimeter²)
 * Returns a value between 0 and 1, where 1 is a perfect circle
 */
export function calculatePolygonCircularity(area: number, perimeter: number): number {
  if (perimeter === 0) return 0;
  return (4 * Math.PI * area) / (perimeter * perimeter);
}

/**
 * Calculate the centroid of a polygon
 */
export function calculatePolygonCentroid(points: Array<{ x: number; y: number }>): { x: number; y: number } {
  if (!points || points.length === 0) return { x: 0, y: 0 };
  
  let cx = 0;
  let cy = 0;
  let area = 0;
  const n = points.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a = points[i].x * points[j].y - points[j].x * points[i].y;
    area += a;
    cx += (points[i].x + points[j].x) * a;
    cy += (points[i].y + points[j].y) * a;
  }
  
  area *= 0.5;
  if (area === 0) {
    // Fallback to average of points
    const sumX = points.reduce((sum, p) => sum + p.x, 0);
    const sumY = points.reduce((sum, p) => sum + p.y, 0);
    return { x: sumX / n, y: sumY / n };
  }
  
  const factor = 1 / (6 * area);
  return { x: cx * factor, y: cy * factor };
}

/**
 * Calculate all metrics for a polygon
 */
export function calculatePolygonMetrics(points: Array<{ x: number; y: number }>): PolygonMetrics {
  const area = calculatePolygonArea(points);
  const perimeter = calculatePolygonPerimeter(points);
  const circularity = calculatePolygonCircularity(area, perimeter);
  const centroid = calculatePolygonCentroid(points);
  
  // Calculate bounding box
  const xCoords = points.map(p => p.x);
  const yCoords = points.map(p => p.y);
  const minX = Math.min(...xCoords);
  const maxX = Math.max(...xCoords);
  const minY = Math.min(...yCoords);
  const maxY = Math.max(...yCoords);
  
  return {
    area,
    perimeter,
    circularity,
    centroid,
    boundingBox: {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    }
  };
}

/**
 * Convert pixels to real units based on calibration
 */
export function convertPixelsToRealUnits(
  pixelValue: number,
  pixelsPerUnit: number,
  unitName: string = 'μm'
): { value: number; unit: string } {
  if (!pixelsPerUnit || pixelsPerUnit === 0) {
    return { value: pixelValue, unit: 'px' };
  }
  
  return {
    value: pixelValue / pixelsPerUnit,
    unit: unitName
  };
}

/**
 * Generate statistics for a collection of polygons
 */
export function generatePolygonStatistics(polygons: Polygon[]): {
  count: number;
  totalArea: number;
  averageArea: number;
  minArea: number;
  maxArea: number;
  totalPerimeter: number;
  averagePerimeter: number;
  averageCircularity: number;
} {
  if (!polygons || polygons.length === 0) {
    return {
      count: 0,
      totalArea: 0,
      averageArea: 0,
      minArea: 0,
      maxArea: 0,
      totalPerimeter: 0,
      averagePerimeter: 0,
      averageCircularity: 0
    };
  }
  
  const metrics = polygons.map(polygon => calculatePolygonMetrics(polygon.points));
  const areas = metrics.map(m => m.area);
  const perimeters = metrics.map(m => m.perimeter);
  const circularities = metrics.map(m => m.circularity);
  
  return {
    count: polygons.length,
    totalArea: areas.reduce((sum, a) => sum + a, 0),
    averageArea: areas.reduce((sum, a) => sum + a, 0) / areas.length,
    minArea: Math.min(...areas),
    maxArea: Math.max(...areas),
    totalPerimeter: perimeters.reduce((sum, p) => sum + p, 0),
    averagePerimeter: perimeters.reduce((sum, p) => sum + p, 0) / perimeters.length,
    averageCircularity: circularities.reduce((sum, c) => sum + c, 0) / circularities.length
  };
}