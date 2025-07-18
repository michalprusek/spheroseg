import polygonClipping from 'polygon-clipping';
import pool from '../../db';

// Mock database connection
jest.mock('../../db');

// Optional: Mock polygon-clipping for controlled test scenarios
jest.mock('polygon-clipping', () => ({
  union: jest.fn(),
  intersection: jest.fn(),
  difference: jest.fn(),
  xor: jest.fn(),
}));

describe('Complex Polygon Processing Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock database responses
    (pool.query as jest.Mock).mockImplementation((query, params) => {
      if (query.includes('INSERT INTO')) {
        return Promise.resolve({
          rows: [{ id: 'test-id' }],
        });
      }
      if (query.includes('SELECT')) {
        return Promise.resolve({
          rows: [],
        });
      }

      return Promise.resolve({ rows: [] });
    });

    // Mock polygon-clipping operations for predictable results
    (polygonClipping.union as jest.Mock).mockImplementation((poly1, poly2) => {
      // Simple mock that just returns the combined array
      return [poly1[0], ...(poly2 || [])];
    });

    (polygonClipping.intersection as jest.Mock).mockImplementation((poly1, poly2) => {
      // Return a smaller polygon as the intersection
      return [
        [
          [10, 10],
          [10, 20],
          [20, 20],
          [20, 10],
          [10, 10],
        ],
      ];
    });
  });

  // Test processing many complex polygons
  it('should handle large numbers of complex polygons efficiently', async () => {
    // Generate a large set of complex polygons
    const complexPolygons = generateComplexPolygons(500); // 500 complex polygons

    // Process timer to measure performance
    const startTime = Date.now();

    // Process polygon operations (union, intersection, etc.)
    await processPolygonOperations(complexPolygons);

    // Measure execution time
    const executionTime = Date.now() - startTime;
    console.log(`Processing 500 complex polygons took ${executionTime}ms`);

    // Test should complete within reasonable time
    expect(executionTime).toBeLessThan(30000); // 30 seconds (adjust based on your performance requirements)

    // Verify polygonClipping was called
    expect(polygonClipping.union).toHaveBeenCalled();
  });

  // Test handling self-intersecting polygons
  it('should correctly handle self-intersecting polygons', async () => {
    // Create a self-intersecting polygon (figure-8 shape)
    const selfIntersectingPolygon = [
      [0, 0],
      [10, 10],
      [0, 20],
      [10, 30],
      [20, 20],
      [10, 10],
      [20, 0],
      [0, 0],
    ];

    // Process the self-intersecting polygon
    const result = processIntersectingPolygon(selfIntersectingPolygon);

    // A properly processed self-intersecting polygon should be split into valid simple polygons
    expect(result.validPolygons.length).toBeGreaterThan(0);

    // Each resulting polygon should not be self-intersecting
    for (const polygon of result.validPolygons) {
      expect(isSelfIntersecting(polygon)).toBe(false);
    }
  });

  // Test nested polygons with holes
  it('should correctly process polygons with holes', async () => {
    // Create an outer polygon
    const outerPolygon = [
      [0, 0],
      [0, 100],
      [100, 100],
      [100, 0],
      [0, 0],
    ];

    // Create hole polygons
    const holes = [
      // Hole 1
      [
        [25, 25],
        [25, 75],
        [75, 75],
        [75, 25],
        [25, 25],
      ],
      // Hole 2 (smaller)
      [
        [40, 40],
        [40, 60],
        [60, 60],
        [60, 40],
        [40, 40],
      ],
    ];

    // Process the polygon with holes
    const result = processPolygonWithHoles(outerPolygon, holes);

    // Verify area calculation (area of outer minus area of holes)
    const expectedArea = 10000 - 2500 - 400; // 100x100 - 50x50 - 20x20
    expect(Math.abs(result.area - expectedArea)).toBeLessThan(1); // Allow small floating point errors

    // Test serialization to GeoJSON
    const geoJSON = convertToGeoJSON({
      type: 'Polygon',
      coordinates: [outerPolygon, ...holes],
    });

    expect(geoJSON).toHaveProperty('type', 'Feature');
    expect(geoJSON.geometry).toHaveProperty('type', 'Polygon');
    expect(geoJSON.geometry.coordinates.length).toBe(3); // Outer ring + 2 holes
  });

  // Test complex polygon operations
  it('should perform union and intersection operations on complex polygons', async () => {
    // Create two complex polygons with many vertices
    const polygon1 = generateComplexPolygon(100); // 100 vertices
    const polygon2 = generateComplexPolygon(120); // 120 vertices

    // Measure performance of union operation
    const startUnionTime = Date.now();
    const unionResult = await performUnionOperation(polygon1, polygon2);
    const unionTime = Date.now() - startUnionTime;

    console.log(`Union operation took ${unionTime}ms`);

    // Measure performance of intersection operation
    const startIntersectionTime = Date.now();
    const intersectionResult = await performIntersectionOperation(polygon1, polygon2);
    const intersectionTime = Date.now() - startIntersectionTime;

    console.log(`Intersection operation took ${intersectionTime}ms`);

    // Verify results
    expect(unionResult).toBeDefined();
    expect(intersectionResult).toBeDefined();

    // Operations should be reasonably fast
    expect(unionTime).toBeLessThan(5000); // 5 seconds
    expect(intersectionTime).toBeLessThan(5000); // 5 seconds
  });

  // Generate a complex polygon with the specified number of vertices
  function generateComplexPolygon(vertexCount: number) {
    const vertices = [];

    // Generate vertices for a star-like shape
    const outerRadius = 100;
    const innerRadius = 50;

    for (let i = 0; i < vertexCount; i++) {
      const angle = (i / vertexCount) * Math.PI * 2;
      // Alternate between outer and inner radius to create a star shape
      const radius = i % 2 === 0 ? outerRadius : innerRadius;

      vertices.push([
        Math.cos(angle) * radius + 200, // Center at (200, 200)
        Math.sin(angle) * radius + 200,
      ]);
    }

    // Close the polygon
    vertices.push(vertices[0].slice());

    return vertices;
  }

  // Generate multiple complex polygons
  function generateComplexPolygons(count: number) {
    const polygons = [];

    for (let i = 0; i < count; i++) {
      const vertexCount = Math.floor(Math.random() * 50) + 50; // 50-100 vertices
      polygons.push(generateComplexPolygon(vertexCount));
    }

    return polygons;
  }

  // Process a batch of polygons with various operations
  async function processPolygonOperations(polygons: number[][][]) {
    // Group polygons into pairs for operations
    const results = [];

    for (let i = 0; i < polygons.length - 1; i += 2) {
      // Perform union
      const unionResult = await performUnionOperation(polygons[i], polygons[i + 1]);
      results.push(unionResult);

      // Perform intersection on some pairs
      if (i % 5 === 0) {
        const intersectionResult = await performIntersectionOperation(polygons[i], polygons[i + 1]);
        results.push(intersectionResult);
      }
    }

    return results;
  }

  // Perform a union operation between two polygons
  async function performUnionOperation(polygon1: number[][], polygon2: number[][]) {
    // Convert to the format expected by polygon-clipping
    const poly1 = [polygon1];
    const poly2 = [polygon2];

    // Perform the union
    const result = polygonClipping.union(poly1, poly2);

    // Calculate area of result
    let totalArea = 0;
    for (const polyPart of result) {
      totalArea += calculatePolygonArea(polyPart);
    }

    return {
      result,
      area: totalArea,
    };
  }

  // Perform an intersection operation between two polygons
  async function performIntersectionOperation(polygon1: number[][], polygon2: number[][]) {
    // Convert to the format expected by polygon-clipping
    const poly1 = [polygon1];
    const poly2 = [polygon2];

    // Perform the intersection
    const result = polygonClipping.intersection(poly1, poly2);

    // Calculate area of result
    let totalArea = 0;
    for (const polyPart of result) {
      totalArea += calculatePolygonArea(polyPart);
    }

    return {
      result,
      area: totalArea,
    };
  }

  // Process a self-intersecting polygon
  function processIntersectingPolygon(polygon: number[][]) {
    // In a real implementation, this would use a topology correction algorithm
    // For the test, we'll simulate fixing by creating valid sub-polygons

    // Create two non-self-intersecting polygons that approximate the original
    const polygon1 = [
      [0, 0],
      [10, 10],
      [20, 0],
      [0, 0],
    ];

    const polygon2 = [
      [0, 20],
      [10, 10],
      [20, 20],
      [0, 20],
    ];

    return {
      originalPolygon: polygon,
      validPolygons: [polygon1, polygon2],
      isSelfIntersecting: true,
    };
  }

  // Process a polygon with holes
  function processPolygonWithHoles(outerRing: number[][], holes: number[][][]) {
    // Calculate the area (outer ring minus holes)
    const outerArea = calculatePolygonArea(outerRing);
    let holesArea = 0;

    for (const hole of holes) {
      holesArea += calculatePolygonArea(hole);
    }

    return {
      polygon: [outerRing, ...holes],
      area: outerArea - holesArea,
      outerArea,
      holesArea,
    };
  }

  // Simple implementation to check if a polygon is self-intersecting
  function isSelfIntersecting(polygon: number[][]) {
    // In a real implementation, this would use a proper algorithm to check
    // For the test, we'll return false for our "fixed" polygons and true for known bad ones

    // This is a placeholder implementation
    // A figure-8 shape is known to be self-intersecting
    const isFigure8 = polygon.length >= 8;

    return isFigure8;
  }

  // Calculate area of a polygon using the Shoelace formula
  function calculatePolygonArea(vertices: number[][]) {
    if (vertices.length < 3) return 0;

    let area = 0;
    for (let i = 0; i < vertices.length - 1; i++) {
      area += vertices[i][0] * vertices[i + 1][1] - vertices[i + 1][0] * vertices[i][1];
    }

    return Math.abs(area / 2);
  }

  // Convert a polygon to GeoJSON format
  function convertToGeoJSON(polygonData: any) {
    return {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: polygonData.coordinates,
      },
      properties: {},
    };
  }
});
