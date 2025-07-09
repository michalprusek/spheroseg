import { Point, Polygon, SegmentationResult } from '@/lib/segmentation';
import { v4 as uuidv4 } from 'uuid';

interface Intersection {
  point: Point;
  segmentIndex: number;
  t: number;
}

/**
 * Calculate line segment intersection
 */
function getLineIntersection(p1: Point, p2: Point, p3: Point, p4: Point): Point | null {
  const x1 = p1.x,
    y1 = p1.y;
  const x2 = p2.x,
    y2 = p2.y;
  const x3 = p3.x,
    y3 = p3.y;
  const x4 = p4.x,
    y4 = p4.y;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-10) return null;

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1),
    };
  }

  return null;
}

/**
 * Find intersections between a line and a polygon
 */
function findLinePolygonIntersections(line: [Point, Point], polygon: Point[]): Intersection[] {
  const intersections: Intersection[] = [];
  const [lineStart, lineEnd] = line;

  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];

    const intersection = getLineIntersection(lineStart, lineEnd, p1, p2);
    if (intersection) {
      // Calculate t parameter for ordering
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const t = Math.abs(dx) > Math.abs(dy) ? (intersection.x - p1.x) / dx : (intersection.y - p1.y) / dy;

      intersections.push({
        point: intersection,
        segmentIndex: i,
        t: t,
      });
    }
  }

  return intersections;
}

/**
 * Calculate polygon area using shoelace formula
 */
function calculatePolygonArea(points: Point[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area / 2);
}

/**
 * Split polygon into two polygons
 */
const polygonOperations = {
  splitPolygon: (
    segmentation: SegmentationResult,
    polygonId: string,
    line: [Point, Point],
  ): SegmentationResult | null => {
    const polygon = segmentation.polygons.find((p) => p.id === polygonId);
    if (!polygon) {
      console.error('[polygonOperations] Polygon not found:', polygonId);
      return null;
    }

    const intersections = findLinePolygonIntersections(line, polygon.points);

    if (intersections.length !== 2) {
      console.error('[polygonOperations] Expected exactly 2 intersections, got:', intersections.length);
      return null;
    }

    // Sort intersections by their position along the polygon
    intersections.sort((a, b) => {
      if (a.segmentIndex !== b.segmentIndex) {
        return a.segmentIndex - b.segmentIndex;
      }
      return a.t - b.t;
    });

    const [int1, int2] = intersections;

    // Create first polygon
    const poly1Points: Point[] = [];
    poly1Points.push(int1.point);

    let i = int1.segmentIndex + 1;
    while (i !== int2.segmentIndex + 1) {
      if (i === polygon.points.length) i = 0;
      if (i === int2.segmentIndex + 1) break;
      poly1Points.push(polygon.points[i]);
      i++;
      if (i === polygon.points.length) i = 0;
    }

    poly1Points.push(int2.point);

    // Create second polygon
    const poly2Points: Point[] = [];
    poly2Points.push(int2.point);

    i = int2.segmentIndex + 1;
    while (i !== int1.segmentIndex + 1) {
      if (i === polygon.points.length) i = 0;
      if (i === int1.segmentIndex + 1) break;
      poly2Points.push(polygon.points[i]);
      i++;
      if (i === polygon.points.length) i = 0;
    }

    poly2Points.push(int1.point);

    // Validate both polygons have at least 3 points
    if (poly1Points.length < 3 || poly2Points.length < 3) {
      console.error('[polygonOperations] Invalid polygon split - insufficient points');
      return null;
    }

    // Create new polygons
    const newPolygon1: Polygon = {
      ...polygon,
      id: uuidv4(),
      points: poly1Points,
      area: calculatePolygonArea(poly1Points),
    };

    const newPolygon2: Polygon = {
      ...polygon,
      id: uuidv4(),
      points: poly2Points,
      area: calculatePolygonArea(poly2Points),
    };

    // Update segmentation
    const updatedPolygons = segmentation.polygons.filter((p) => p.id !== polygonId);
    updatedPolygons.push(newPolygon1, newPolygon2);

    return {
      ...segmentation,
      polygons: updatedPolygons,
    };
  },
};

export default polygonOperations;
