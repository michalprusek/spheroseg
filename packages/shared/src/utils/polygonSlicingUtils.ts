import { v4 as uuidv4 } from 'uuid';
import { Point } from '@spheroseg/types';

// Generic Polygon interface
export interface Polygon {
  id: string;
  points: Point[];
  type?: 'external' | 'internal';
  [key: string]: unknown; // Allow for additional properties
}

// Intersection interface used for polygon slicing
interface Intersection extends Point {
  edgeIndex: number;
}

/**
 * Determines which side of a line a point falls on
 * 
 * @param point The point to check
 * @param lineStart The first point of the line
 * @param lineEnd The second point of the line
 * @returns 1 if point is on one side, -1 if on the other side, 0 if on the line
 */
export function getPointSideOfLine(
  point: Point, 
  lineStart: Point, 
  lineEnd: Point
): number {
  // Calculate the cross product to determine side
  // (x2-x1)(y-y1) - (y2-y1)(x-x1)
  const value = (lineEnd.x - lineStart.x) * (point.y - lineStart.y) -
                (lineEnd.y - lineStart.y) * (point.x - lineStart.x);
  return value > 0 ? 1 : (value < 0 ? -1 : 0);
}

/**
 * Calculates the intersection point between two line segments
 * 
 * @param line1Start First point of line 1
 * @param line1End Second point of line 1
 * @param line2Start First point of line 2
 * @param line2End Second point of line 2
 * @returns The intersection point, or null if lines don't intersect
 */
export function calculateLineIntersection(
  line1Start: Point,
  line1End: Point,
  line2Start: Point,
  line2End: Point
): Point | null {
  const x1 = line1Start.x, y1 = line1Start.y;
  const x2 = line1End.x, y2 = line1End.y;
  const x3 = line2Start.x, y3 = line2Start.y;
  const x4 = line2End.x, y4 = line2End.y;

  const denominator = ((y4 - y3) * (x2 - x1)) - ((x4 - x3) * (y2 - y1));

  // If lines are parallel
  if (denominator === 0) {
    return null;
  }

  // Calculate intersection
  const ua = (((x4 - x3) * (y1 - y3)) - ((y4 - y3) * (x1 - x3))) / denominator;

  // Check if intersection is within the line segments
  if (ua < 0 || ua > 1) {
    return null;
  }

  // Calculate intersection point
  return {
    x: x1 + ua * (x2 - x1),
    y: y1 + ua * (y2 - y1)
  };
}

/**
 * Slices a polygon along a line defined by two points
 * 
 * @param polygon The polygon to slice
 * @param sliceStart The start point of the slice line
 * @param sliceEnd The end point of the slice line
 * @returns An array of two new polygons if slicing was successful, or null if slicing failed
 */
export function slicePolygon(
  polygon: Polygon,
  sliceStart: Point,
  sliceEnd: Point
): [Polygon, Polygon] | null {
  const polygonPoints = polygon.points;

  // Determine which side each point is on
  const sides: number[] = polygonPoints.map(point => 
    getPointSideOfLine(point, sliceStart, sliceEnd)
  );

  // Find where the slice line intersects the polygon edges
  const intersections: Intersection[] = [];

  for (let i = 0; i < polygonPoints.length; i++) {
    const p1 = polygonPoints[i];
    const p2 = polygonPoints[(i + 1) % polygonPoints.length];
    const side1 = sides[i];
    const side2 = sides[(i + 1) % polygonPoints.length];

    // If points are on opposite sides, the line intersects this edge
    if (side1 !== 0 && side2 !== 0 && side1 !== side2) {
      // Calculate intersection point
      const intersection = calculateLineIntersection(
        p1, p2, sliceStart, sliceEnd
      );
      
      if (intersection) {
        intersections.push({
          ...intersection,
          edgeIndex: i
        });
      }
    }
    // If a point is exactly on the line, add it as an intersection
    else if (side1 === 0) {
      intersections.push({
        x: p1.x,
        y: p1.y,
        edgeIndex: i
      });
    }
  }

  // We need at least 2 intersections to slice the polygon
  if (intersections.length >= 2) {
    // Sort intersections by position along the slice line
    intersections.sort((a, b) => {
      // Project onto the slice line and sort by distance from start
      const distA = Math.pow(a.x - sliceStart.x, 2) + Math.pow(a.y - sliceStart.y, 2);
      const distB = Math.pow(b.x - sliceStart.x, 2) + Math.pow(b.y - sliceStart.y, 2);
      return distA - distB;
    });

    // Use the first and last intersections for a clean cut
    const int1 = intersections[0];
    const int2 = intersections[intersections.length - 1];

    // Create two new polygons by splitting at the intersections
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
      const newPolygon1: Polygon = {
        id: uuidv4(),
        points: polygon1Points,
        type: polygon.type || 'external'
      };

      const newPolygon2: Polygon = {
        id: uuidv4(),
        points: polygon2Points,
        type: polygon.type || 'external'
      };

      return [newPolygon1, newPolygon2];
    }
  }

  // If we get here, slicing failed
  return null;
}

/**
 * Calculates the distance from a point to a line segment
 * 
 * @param point The point
 * @param lineStart The first point of the line segment
 * @param lineEnd The second point of the line segment
 * @returns The shortest distance from the point to the line segment
 */
export function distanceToLineSegment(
  point: Point,
  lineStart: Point,
  lineEnd: Point
): number {
  // Calculate squared length of segment
  const l2 = Math.pow(lineStart.x - lineEnd.x, 2) + Math.pow(lineStart.y - lineEnd.y, 2);

  // If segment is a point, return distance to that point
  if (l2 === 0) return Math.sqrt(Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2));

  // Calculate projection of point onto line containing segment
  const t = ((point.x - lineStart.x) * (lineEnd.x - lineStart.x) + 
             (point.y - lineStart.y) * (lineEnd.y - lineStart.y)) / l2;

  // If projection is outside segment, return distance to nearest endpoint
  if (t < 0) return Math.sqrt(Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2));
  if (t > 1) return Math.sqrt(Math.pow(point.x - lineEnd.x, 2) + Math.pow(point.y - lineEnd.y, 2));

  // Calculate projection point on segment
  const projection = {
    x: lineStart.x + t * (lineEnd.x - lineStart.x),
    y: lineStart.y + t * (lineEnd.y - lineStart.y)
  };

  // Return distance to projection point
  return Math.sqrt(Math.pow(point.x - projection.x, 2) + Math.pow(point.y - projection.y, 2));
}

/**
 * Creates a new polygon
 * 
 * @param points The polygon points
 * @param type The polygon type (external or internal)
 * @returns A new polygon object
 */
export function createPolygon(
  points: Point[], 
  type: 'external' | 'internal' = 'external'
): Polygon {
  return {
    id: uuidv4(),
    points: [...points],
    type
  };
}