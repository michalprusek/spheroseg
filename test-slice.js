// Test script for polygon slicing

// Simple polygon slicing implementation for testing
function calculateLineSegmentIntersection(lineStart, lineEnd, segStart, segEnd) {
  const x1 = lineStart.x, y1 = lineStart.y;
  const x2 = lineEnd.x, y2 = lineEnd.y;
  const x3 = segStart.x, y3 = segStart.y;
  const x4 = segEnd.x, y4 = segEnd.y;

  const denominator = ((y4 - y3) * (x2 - x1)) - ((x4 - x3) * (y2 - y1));

  if (denominator === 0) {
    return null; // Lines are parallel
  }

  const ua = (((x4 - x3) * (y1 - y3)) - ((y4 - y3) * (x1 - x3))) / denominator;
  const ub = (((x2 - x1) * (y1 - y3)) - ((y2 - y1) * (x1 - x3))) / denominator;

  // Only check if intersection is within the line segment (not the infinite line)
  if (ub >= 0 && ub <= 1) {
    const intersection = {
      x: x1 + ua * (x2 - x1),
      y: y1 + ua * (y2 - y1)
    };
    console.log('[calculateLineSegmentIntersection] Intersection found:', {
      ua,
      ub,
      intersection
    });
    return intersection;
  }

  return null;
}

function calculateLinePolygonIntersections(lineStart, lineEnd, polygon) {
  console.log('[calculateLinePolygonIntersections] Called with:', {
    lineStart,
    lineEnd,
    polygonPoints: polygon.length
  });
  
  const intersections = [];

  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    const intersection = calculateLineSegmentIntersection(
      lineStart, lineEnd, polygon[i], polygon[j]
    );

    if (intersection) {
      console.log(`[calculateLinePolygonIntersections] Found intersection at edge ${i}:`, intersection);
      const dist = Math.sqrt(
        Math.pow(lineStart.x - intersection.x, 2) + 
        Math.pow(lineStart.y - intersection.y, 2)
      );

      intersections.push({
        x: intersection.x,
        y: intersection.y,
        edgeIndex: i,
        distance: dist
      });
    }
  }

  // Sort by distance from line start
  intersections.sort((a, b) => (a.distance || 0) - (b.distance || 0));
  
  return intersections;
}

// Test polygon (a simple square)
const testPolygon = [
  { x: 100, y: 100 },
  { x: 200, y: 100 },
  { x: 200, y: 200 },
  { x: 100, y: 200 }
];

// Test slice line (horizontal line through the middle)
const sliceStart = { x: 50, y: 150 };
const sliceEnd = { x: 250, y: 150 };

console.log('Testing polygon slicing...');
console.log('Test polygon:', testPolygon);
console.log('Slice line:', sliceStart, 'to', sliceEnd);

// Run the intersection calculation
const intersections = calculateLinePolygonIntersections(sliceStart, sliceEnd, testPolygon);

console.log('[Test] Found intersections:', intersections.length, intersections);

if (intersections.length === 2) {
  console.log('SUCCESS: Found 2 intersections as expected!');
} else {
  console.error('FAILED: Expected 2 intersections, got', intersections.length);
}