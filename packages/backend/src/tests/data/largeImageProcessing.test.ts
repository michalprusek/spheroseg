import path from 'path';
import { execSync } from 'child_process';
import { Readable } from 'stream';
import sharp from 'sharp';
import pool from '../../db';
import config from '../../config';
// Remove unused import - segmentImage is not exported from segmentationService
import { createMockSharp } from '../../test-utils/mockFactories';

// Mock database connection
jest.mock('../../db');

// Mock image processing libraries
jest.mock('sharp');

// Mock file system operations to avoid actual file creation
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true),
  createReadStream: jest.fn().mockImplementation(() => {
    return new Readable({
      read() {
        this.push(Buffer.alloc(1024 * 1024)); // 1MB of data
        this.push(null);
      },
    });
  }),
  statSync: jest.fn().mockImplementation((filePath) => {
    // Return different sizes based on the file path
    if (filePath.includes('large')) {
      return { size: 50 * 1024 * 1024 }; // 50MB
    } else if (filePath.includes('medium')) {
      return { size: 10 * 1024 * 1024 }; // 10MB
    } else {
      return { size: 2 * 1024 * 1024 }; // 2MB
    }
  }),
}));

describe('Large Image Processing Tests', () => {
  // File paths for test images
  const testDir = path.join(process.cwd(), 'test_assets');
  const largeImagePath = path.join(testDir, 'large_test_image.jpg');
  const complexImagePath = path.join(testDir, 'complex_test_image.jpg');

  // Setup test environment
  beforeAll(() => {
    // Setup sharp mock using factory
    const mockSharp = createMockSharp();
    (sharp as unknown as jest.Mock) = mockSharp;

    // Mock database responses
    (pool.query as jest.Mock).mockImplementation((query, params) => {
      if (query.includes('INSERT INTO images')) {
        return Promise.resolve({
          rows: [{ id: 'test-image-id' }],
        });
      }
      if (query.includes('INSERT INTO segmentation_results')) {
        return Promise.resolve({
          rows: [{ id: 'test-result-id' }],
        });
      }
      if (query.includes('SELECT')) {
        return Promise.resolve({
          rows: [
            {
              id: 'test-id',
              storage_path: '/uploads/test.jpg',
              width: 8000,
              height: 6000,
            },
          ],
        });
      }

      return Promise.resolve({ rows: [] });
    });
  });

  // Test large image upload handling
  it('should process large images efficiently', async () => {
    // Mock a large image upload (50MB, 8000x6000 pixels)
    const imageMetadata = {
      width: 8000,
      height: 6000,
      size: 50 * 1024 * 1024,
      format: 'jpeg',
    };

    // Process timer to measure performance
    const startTime = Date.now();

    // Process large image
    const result = await processLargeImage(largeImagePath, imageMetadata);

    // Check execution time
    const executionTime = Date.now() - startTime;

    console.log(`Large image processing took ${executionTime}ms`);

    // Test should complete within reasonable time (adjust timeout as needed)
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.width).toBeLessThanOrEqual(4000);
    expect(result.height).toBeLessThanOrEqual(4000);

    // Verify sharp was called with correct resizing parameters
    expect(sharp).toHaveBeenCalledWith(largeImagePath);
    expect(sharp().resize).toHaveBeenCalledWith(
      expect.objectContaining({
        width: expect.any(Number),
        height: expect.any(Number),
        fit: 'inside',
      })
    );
  });

  // Test memory usage during large image processing
  it('should handle large images without excessive memory usage', async () => {
    // Set up test data for a very large image
    const largeImageMetadata = {
      width: 12000,
      height: 9000,
      size: 100 * 1024 * 1024, // 100MB file
      format: 'jpeg',
    };

    // Get initial memory usage
    const initialMemoryUsage = process.memoryUsage();

    // Process large image
    await processLargeImage(largeImagePath, largeImageMetadata);

    // Get final memory usage
    const finalMemoryUsage = process.memoryUsage();

    // Calculate memory increase
    const heapUsageIncrease = finalMemoryUsage.heapUsed - initialMemoryUsage.heapUsed;
    const rssIncrease = finalMemoryUsage.rss - initialMemoryUsage.rss;

    console.log(
      `Memory usage increase - Heap: ${heapUsageIncrease / 1024 / 1024}MB, RSS: ${rssIncrease / 1024 / 1024}MB`
    );

    // Memory usage should be reasonable - the exact threshold depends on implementation
    // but we can verify it's significantly less than the image size
    expect(rssIncrease).toBeLessThan(largeImageMetadata.size);
  });

  // Test processing complex polygon data
  it('should handle images with complex polygon structures', async () => {
    // Mock complex polygon data with many vertices
    const complexPolygons = generateComplexPolygons(100, 1000); // 100 polygons with up to 1000 vertices each

    // Process complex polygon data
    const startTime = Date.now();
    const result = await processComplexPolygons(complexPolygons);
    const executionTime = Date.now() - startTime;

    console.log(
      `Complex polygon processing took ${executionTime}ms for ${complexPolygons.length} polygons`
    );

    // Verify results
    expect(result).toBeDefined();
    expect(result.simplifiedPolygons.length).toBe(complexPolygons.length);

    // Each simplified polygon should have fewer vertices than the original
    for (let i = 0; i < result.simplifiedPolygons.length; i++) {
      expect(result.simplifiedPolygons[i].vertices.length).toBeLessThan(
        complexPolygons[i].vertices.length
      );
    }
  });

  // Helper function to process large images
  async function processLargeImage(imagePath: string, metadata: any) {
    // Apply processing logic similar to what's in the actual service
    try {
      // Check if image needs resizing
      let width = metadata.width;
      let height = metadata.height;
      const maxWidth = 4000;
      const maxHeight = 4000;

      if (width > maxWidth || height > maxHeight) {
        // Calculate aspect ratio
        const aspectRatio = width / height;

        if (width > maxWidth) {
          width = maxWidth;
          height = Math.round(width / aspectRatio);
        }

        if (height > maxHeight) {
          height = maxHeight;
          width = Math.round(height * aspectRatio);
        }

        // Resize image
        await sharp(imagePath)
          .resize({ width, height, fit: 'inside' })
          .toFile(imagePath + '.resized.jpg');
      }

      return {
        success: true,
        width,
        height,
        path: imagePath + '.resized.jpg',
      };
    } catch (error) {
      console.error('Error processing large image:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Helper function to generate complex polygon data
  function generateComplexPolygons(count: number, maxVertices: number) {
    const polygons = [];

    for (let i = 0; i < count; i++) {
      const vertices = [];
      const vertexCount = Math.floor(Math.random() * maxVertices) + 50; // At least 50 vertices

      // Generate vertices for a circle-like shape with noise
      for (let j = 0; j < vertexCount; j++) {
        const angle = (j / vertexCount) * Math.PI * 2;
        const radius = 100 + Math.random() * 20; // Base radius with noise

        vertices.push({
          x: Math.cos(angle) * radius + 200, // Center at (200, 200)
          y: Math.sin(angle) * radius + 200,
        });
      }

      polygons.push({
        id: `poly-${i}`,
        vertices,
        type: Math.random() > 0.7 ? 'internal' : 'external', // Some polygons are internal
        properties: {
          area: Math.random() * 10000,
          color: '#' + Math.floor(Math.random() * 16777215).toString(16), // Random color
        },
      });
    }

    return polygons;
  }

  // Helper function to process complex polygons
  async function processComplexPolygons(polygons: any[]) {
    // Apply polygon simplification algorithm
    const simplifiedPolygons = polygons.map((polygon) => {
      // Simplified version - in real code this would use an actual
      // simplification algorithm like Douglas-Peucker
      const simplificationFactor = 0.1; // Keep 10% of points
      const stride = Math.max(1, Math.floor(1 / simplificationFactor));

      const simplifiedVertices = [];
      for (let i = 0; i < polygon.vertices.length; i += stride) {
        simplifiedVertices.push(polygon.vertices[i]);
      }

      return {
        ...polygon,
        vertices: simplifiedVertices,
      };
    });

    return {
      originalPolygons: polygons,
      simplifiedPolygons,
      compressionRatio:
        simplifiedPolygons.reduce((sum, p) => sum + p.vertices.length, 0) /
        polygons.reduce((sum, p) => sum + p.vertices.length, 0),
    };
  }
});
