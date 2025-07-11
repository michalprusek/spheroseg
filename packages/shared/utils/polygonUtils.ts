/**
 * Shared Polygon Utilities
 * 
 * Common polygon operations used across the application
 */

export interface Point {
  x: number;
  y: number;
}

export interface Polygon {
  id: string;
  points: Point[];
  type: 'external' | 'internal';
  color?: string;
  label?: string;
  visible?: boolean;
}

/**
 * Calculate the area of a polygon using the shoelace formula
 */
export function calculatePolygonArea(points: Point[]): number {
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
export function calculatePolygonPerimeter(points: Point[]): number {
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
 * Check if a point is inside a polygon using ray casting
 * Note: Points exactly on the edge are considered inside
 */
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  if (!polygon || polygon.length < 3) return false;
  
  let inside = false;
  const n = polygon.length;
  let p1 = polygon[0];
  
  for (let i = 1; i <= n; i++) {
    const p2 = polygon[i % n];
    
    // Check if point is on the edge
    if (isPointOnLineSegment(point, p1, p2)) {
      return true;
    }
    
    if (point.y > Math.min(p1.y, p2.y)) {
      if (point.y <= Math.max(p1.y, p2.y)) {
        if (point.x <= Math.max(p1.x, p2.x)) {
          const xinters = (point.y - p1.y) * (p2.x - p1.x) / (p2.y - p1.y) + p1.x;
          if (p1.x === p2.x || point.x <= xinters) {
            inside = !inside;
          }
        }
      }
    }
    p1 = p2;
  }
  
  return inside;
}

/**
 * Check if a point lies on a line segment
 */
function isPointOnLineSegment(point: Point, lineStart: Point, lineEnd: Point): boolean {
  const epsilon = 0.0001;
  
  // Calculate vectors
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  
  // Handle the case where lineStart and lineEnd are the same point
  if (Math.abs(dx) < epsilon && Math.abs(dy) < epsilon) {
    return Math.abs(point.x - lineStart.x) < epsilon && Math.abs(point.y - lineStart.y) < epsilon;
  }
  
  // Calculate parameter t for the parametric line equation
  let t: number;
  if (Math.abs(dx) > Math.abs(dy)) {
    t = (point.x - lineStart.x) / dx;
  } else {
    t = (point.y - lineStart.y) / dy;
  }
  
  // Check if t is within [0, 1] range (point is on the segment)
  if (t < -epsilon || t > 1 + epsilon) {
    return false;
  }
  
  // Calculate the expected point on the line
  const expectedX = lineStart.x + t * dx;
  const expectedY = lineStart.y + t * dy;
  
  // Check if the point is close enough to the line
  return Math.abs(point.x - expectedX) < epsilon && Math.abs(point.y - expectedY) < epsilon;
}

/**
 * Find the intersection point between two line segments
 */
export function findLineIntersection(
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point
): Point | null {
  const x1 = p1.x, y1 = p1.y;
  const x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y;
  const x4 = p4.x, y4 = p4.y;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  
  if (Math.abs(denom) < 1e-10) {
    return null; // Lines are parallel
  }

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1)
    };
  }

  return null;
}

/**
 * Slice a polygon along a line
 */
export function slicePolygonObject(
  polygon: Polygon,
  lineStart: Point,
  lineEnd: Point
): Polygon[] | null {
  const points = polygon.points;
  if (points.length < 3) {
    return null;
  }

  const intersections: Array<{
    point: Point;
    index: number;
    t: number;
  }> = [];

  // Find all intersection points
  for (let i = 0; i < points.length; i++) {
    const nextIndex = (i + 1) % points.length;
    const intersection = findLineIntersection(
      points[i],
      points[nextIndex],
      lineStart,
      lineEnd
    );

    if (intersection) {
      // Calculate t parameter for sorting
      const dx = points[nextIndex].x - points[i].x;
      const dy = points[nextIndex].y - points[i].y;
      const t = Math.abs(dx) > Math.abs(dy)
        ? (intersection.x - points[i].x) / dx
        : (intersection.y - points[i].y) / dy;

      intersections.push({
        point: intersection,
        index: i,
        t
      });
    }
  }

  // Need exactly 2 intersections for a valid slice
  if (intersections.length !== 2) {
    return null;
  }

  // Sort intersections by index and t
  intersections.sort((a, b) => {
    if (a.index !== b.index) {
      return a.index - b.index;
    }
    return a.t - b.t;
  });

  // Build the two polygons
  const polygon1Points: Point[] = [];
  const polygon2Points: Point[] = [];

  // Add points from start to first intersection
  for (let i = 0; i <= intersections[0].index; i++) {
    polygon1Points.push(points[i]);
  }
  polygon1Points.push(intersections[0].point);

  // Add intersection points to second polygon
  polygon2Points.push(intersections[0].point);

  // Add points between intersections to second polygon
  for (let i = intersections[0].index + 1; i <= intersections[1].index; i++) {
    polygon2Points.push(points[i]);
  }
  polygon2Points.push(intersections[1].point);

  // Add second intersection to first polygon
  polygon1Points.push(intersections[1].point);

  // Add remaining points to first polygon
  for (let i = intersections[1].index + 1; i < points.length; i++) {
    polygon1Points.push(points[i]);
  }

  return [
    {
      ...polygon,
      id: `${polygon.id}-1`,
      points: polygon1Points,
    },
    {
      ...polygon,
      id: `${polygon.id}-2`,
      points: polygon2Points,
    }
  ];
}

/**
 * Simplify a polygon using Douglas-Peucker algorithm
 */
export function simplifyPolygon(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) {
    return points;
  }

  // Find the point with the maximum distance
  let maxDistance = 0;
  let maxIndex = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const distance = perpendicularDistance(points[i], points[0], points[end]);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  // If max distance is greater than tolerance, recursively simplify
  if (maxDistance > tolerance) {
    const leftPart = simplifyPolygon(points.slice(0, maxIndex + 1), tolerance);
    const rightPart = simplifyPolygon(points.slice(maxIndex), tolerance);
    
    // Remove the last point of the left part to avoid duplication
    return [...leftPart.slice(0, -1), ...rightPart];
  } else {
    return [points[0], points[end]];
  }
}

/**
 * Calculate perpendicular distance from point to line
 */
function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  
  if (dx === 0 && dy === 0) {
    // The line is a point
    const diffX = point.x - lineStart.x;
    const diffY = point.y - lineStart.y;
    return Math.sqrt(diffX * diffX + diffY * diffY);
  }
  
  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);
  const tClamped = Math.max(0, Math.min(1, t));
  
  const nearestX = lineStart.x + tClamped * dx;
  const nearestY = lineStart.y + tClamped * dy;
  
  const distX = point.x - nearestX;
  const distY = point.y - nearestY;
  
  return Math.sqrt(distX * distX + distY * distY);
}

/**
 * Generate a random color for a polygon
 */
export function generatePolygonColor(): string {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#DDA0DD',
    '#FFD93D', '#6BCB77', '#4D96FF', '#FF6B9D', '#C44569',
    '#F8B500', '#00818A', '#FF5722', '#795548', '#607D8B'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Calculate the centroid of a polygon
 */
export function calculatePolygonCentroid(points: Point[]): Point {
  if (!points || points.length === 0) {
    return { x: 0, y: 0 };
  }
  
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
 * Calculate distance between two points
 */
export function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Create a polygon with default properties
 */
export function createPolygon(points: Point[], properties?: Partial<Polygon>): Polygon {
  return {
    id: properties?.id || `polygon-${Date.now()}`,
    points,
    type: properties?.type || 'external',
    color: properties?.color || generatePolygonColor(),
    label: properties?.label,
    visible: properties?.visible !== false,
    ...properties
  };
}

/**
 * Calculate the bounding box of a polygon
 */
export function calculateBoundingBox(points: Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
  if (!points || points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
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

  return { minX, minY, maxX, maxY };
}

/**
 * Check if two polygons intersect
 */
export function doPolygonsIntersect(polygon1: Point[], polygon2: Point[]): boolean {
  // Check if any edge of polygon1 intersects with any edge of polygon2
  for (let i = 0; i < polygon1.length; i++) {
    const p1 = polygon1[i];
    const p2 = polygon1[(i + 1) % polygon1.length];
    
    for (let j = 0; j < polygon2.length; j++) {
      const p3 = polygon2[j];
      const p4 = polygon2[(j + 1) % polygon2.length];
      
      if (findLineIntersection(p1, p2, p3, p4)) {
        return true;
      }
    }
  }
  
  // Check if one polygon is inside the other
  if (polygon1.length > 0 && isPointInPolygon(polygon1[0], polygon2)) {
    return true;
  }
  
  if (polygon2.length > 0 && isPointInPolygon(polygon2[0], polygon1)) {
    return true;
  }
  
  return false;
}