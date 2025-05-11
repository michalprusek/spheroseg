/**
 * Shared utilities for slicing polygons
 */
import { Point } from '@spheroseg/types';
import { v4 as uuidv4 } from 'uuid';
import { 
  calculateLinePolygonIntersections,
  calculateIntersection
} from './geometryUtils';

/**
 * Interface representing a polygon with an ID and points
 */
export interface Polygon {
  id: string;
  points: Point[];
  type?: 'external' | 'internal';
}

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
 * Create a new polygon with the given points and type
 */
export const createPolygon = (
  points: Point[],
  type: 'external' | 'internal' = 'external'
): Polygon => {
  return {
    id: uuidv4(),
    points,
    type
  };
};

/**
 * Slice a polygon object with a line
 */
export const slicePolygonObject = (
  polygon: Polygon,
  sliceStart: Point,
  sliceEnd: Point
): Polygon[] | null => {
  try {
    const result = slicePolygon(polygon.points, sliceStart, sliceEnd);
    
    if (!result || result.length < 2) {
      return null;
    }
    
    // Create new polygon objects from the result
    return result.map(points => ({
      id: uuidv4(),
      points,
      type: polygon.type || 'external'
    }));
  } catch (error) {
    // Error is handled by returning null
    return null;
  }
};