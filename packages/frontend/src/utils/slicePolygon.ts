/**
 * Polygon Slicing Utilities
 * 
 * Functions for slicing polygons with lines
 */

/**
 * Find the intersection point between two line segments
 */
export function findIntersectionPoint(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number }
): { x: number; y: number } | null {
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
export function slicePolygon(
  polygon: Array<{ x: number; y: number }>,
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number }
): [Array<{ x: number; y: number }>, Array<{ x: number; y: number }>] | null {
  if (polygon.length < 3) {
    return null;
  }

  const intersections: Array<{
    point: { x: number; y: number };
    index: number;
    t: number;
  }> = [];

  // Find all intersection points
  for (let i = 0; i < polygon.length; i++) {
    const nextIndex = (i + 1) % polygon.length;
    const intersection = findIntersectionPoint(
      polygon[i],
      polygon[nextIndex],
      lineStart,
      lineEnd
    );

    if (intersection) {
      // Calculate t parameter for sorting
      const dx = polygon[nextIndex].x - polygon[i].x;
      const dy = polygon[nextIndex].y - polygon[i].y;
      const t = Math.abs(dx) > Math.abs(dy)
        ? (intersection.x - polygon[i].x) / dx
        : (intersection.y - polygon[i].y) / dy;

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
  const polygon1: Array<{ x: number; y: number }> = [];
  const polygon2: Array<{ x: number; y: number }> = [];

  // Add points from start to first intersection
  for (let i = 0; i <= intersections[0].index; i++) {
    polygon1.push(polygon[i]);
  }
  polygon1.push(intersections[0].point);

  // Add intersection points to second polygon
  polygon2.push(intersections[0].point);

  // Add points between intersections to second polygon
  for (let i = intersections[0].index + 1; i <= intersections[1].index; i++) {
    polygon2.push(polygon[i]);
  }
  polygon2.push(intersections[1].point);

  // Add second intersection to first polygon
  polygon1.push(intersections[1].point);

  // Add remaining points to first polygon
  for (let i = intersections[1].index + 1; i < polygon.length; i++) {
    polygon1.push(polygon[i]);
  }

  return [polygon1, polygon2];
}