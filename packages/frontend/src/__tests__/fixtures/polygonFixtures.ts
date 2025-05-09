import { Point, Polygon } from '@spheroseg/types';

/**
 * Creates a random point within the given bounds
 */
export function createRandomPoint(
  minX = 0,
  maxX = 1000,
  minY = 0,
  maxY = 800
): Point {
  return {
    x: minX + Math.random() * (maxX - minX),
    y: minY + Math.random() * (maxY - minY)
  };
}

/**
 * Creates a random polygon with the specified number of points
 */
export function createRandomPolygon(
  numPoints = 5,
  centerX = 500,
  centerY = 400,
  radius = 100
): Polygon {
  const points: Point[] = [];
  
  // Generate points around a circle for a somewhat realistic polygon
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    // Add some randomness to make the polygon irregular
    const jitter = 0.7 + Math.random() * 0.6; // 0.7 to 1.3
    const x = centerX + Math.cos(angle) * radius * jitter;
    const y = centerY + Math.sin(angle) * radius * jitter;
    
    points.push({ x, y });
  }
  
  return {
    points,
    closed: true,
    color: getRandomColor()
  };
}

/**
 * Creates multiple random polygons
 */
export function createRandomPolygons(count: number): Polygon[] {
  const polygons: Polygon[] = [];
  
  for (let i = 0; i < count; i++) {
    // Vary the center position for each polygon
    const centerX = 200 + Math.random() * 800;
    const centerY = 150 + Math.random() * 500;
    
    // Vary the number of points and size
    const numPoints = 4 + Math.floor(Math.random() * 8); // 4 to 11 points
    const radius = 20 + Math.random() * 100; // 20 to 120 px radius
    
    polygons.push(createRandomPolygon(numPoints, centerX, centerY, radius));
  }
  
  return polygons;
}

/**
 * Generates a random hex color
 */
function getRandomColor(): string {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

/**
 * Creates mock image data for testing
 */
export function createMockImageData(
  width = 1024,
  height = 768
) {
  return {
    width,
    height,
    url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', // 1x1 transparent pixel
    originalFilename: 'test-image.jpg'
  };
}

/**
 * Creates a set of test polygons with deterministic values (for snapshot testing)
 */
export function createTestPolygonSet(): Polygon[] {
  return [
    {
      points: [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
        { x: 200, y: 200 },
        { x: 100, y: 200 }
      ],
      closed: true,
      color: '#FF0000'
    },
    {
      points: [
        { x: 300, y: 300 },
        { x: 400, y: 300 },
        { x: 350, y: 400 }
      ],
      closed: true,
      color: '#00FF00'
    },
    {
      points: [
        { x: 500, y: 100 },
        { x: 600, y: 100 },
        { x: 650, y: 200 },
        { x: 600, y: 300 },
        { x: 500, y: 300 },
        { x: 450, y: 200 }
      ],
      closed: true,
      color: '#0000FF'
    }
  ];
}

/**
 * Creates a deep copy of polygon data
 */
export function clonePolygons(polygons: Polygon[]): Polygon[] {
  return JSON.parse(JSON.stringify(polygons));
}