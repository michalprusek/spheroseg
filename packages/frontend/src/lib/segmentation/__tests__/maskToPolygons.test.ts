import { maskToPolygons } from '../maskToPolygons';
import { vi } from 'vitest';

// Mock the Image class
class MockImage {
  public src: string = '';
  public crossOrigin: string = '';
  public width: number = 100;
  public height: number = 100;
  public onload: (() => void) | null = null;
  public onerror: ((error: any) => void) | null = null;

  constructor() {
    setTimeout(() => {
      if (this.onload) this.onload();
    }, 0);
  }
}

// Mock the canvas and context
const mockContext = {
  drawImage: vi.fn(),
  getImageData: vi.fn(),
};

const mockCanvas = {
  getContext: vi.fn(() => mockContext),
  width: 100,
  height: 100,
};

// Mock document.createElement
document.createElement = vi.fn((tagName) => {
  if (tagName === 'canvas') {
    return mockCanvas as unknown as HTMLCanvasElement;
  }
  return {} as any;
});

// Mock global Image constructor
global.Image = MockImage as unknown;

describe('maskToPolygons', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock implementations
    mockContext.drawImage.mockReset();
    mockContext.getImageData.mockReset();
  });

  it('should convert a mask to polygons', async () => {
    // Mock image data with a simple square in the middle
    const imageData = {
      data: new Uint8Array(100 * 100 * 4),
      width: 100,
      height: 100,
    };

    // Create a 20x20 square in the middle (from pixel 40,40 to 60,60)
    for (let y = 40; y < 60; y++) {
      for (let x = 40; x < 60; x++) {
        const idx = (y * 100 + x) * 4;
        imageData.data[idx] = 255; // R
        imageData.data[idx + 1] = 0; // G
        imageData.data[idx + 2] = 0; // B
        imageData.data[idx + 3] = 255; // A
      }
    }

    // Mock the getImageData to return our test data
    mockContext.getImageData.mockReturnValue(imageData);

    // Call the function
    const result = await maskToPolygons('test-mask.png', 100, 100);

    // Verify the result
    expect(result).toBeDefined();
    expect(result.imageWidth).toBe(100);
    expect(result.imageHeight).toBe(100);
    expect(result.polygons).toBeDefined();
    expect(result.polygons?.length).toBeGreaterThan(0);

    // The first polygon should represent our square
    const polygon = result.polygons?.[0];
    expect(polygon).toBeDefined();
    expect(polygon?.points.length).toBeGreaterThanOrEqual(4); // At least 4 points for a square

    // Check that the polygon points are around our square
    polygon?.points.forEach((point) => {
      // Points should be near the square boundaries
      expect(point.x).toBeGreaterThanOrEqual(39);
      expect(point.x).toBeLessThanOrEqual(61);
      expect(point.y).toBeGreaterThanOrEqual(39);
      expect(point.y).toBeLessThanOrEqual(61);
    });
  });

  it('should handle empty masks', async () => {
    // Mock image data with no segments (all black)
    const imageData = {
      data: new Uint8Array(100 * 100 * 4), // All zeros (black)
      width: 100,
      height: 100,
    };

    // Mock the getImageData to return our test data
    mockContext.getImageData.mockReturnValue(imageData);

    // Call the function
    const result = await maskToPolygons('empty-mask.png', 100, 100);

    // Verify the result
    expect(result).toBeDefined();
    expect(result.imageWidth).toBe(100);
    expect(result.imageHeight).toBe(100);
    expect(result.polygons).toBeDefined();
    expect(result.polygons?.length).toBe(0); // No polygons should be found
  });

  it('should handle multiple segments', async () => {
    // Mock image data with two separate squares
    const imageData = {
      data: new Uint8Array(100 * 100 * 4),
      width: 100,
      height: 100,
    };

    // Create a red 10x10 square in the top-left (from pixel 10,10 to 20,20)
    for (let y = 10; y < 20; y++) {
      for (let x = 10; x < 20; x++) {
        const idx = (y * 100 + x) * 4;
        imageData.data[idx] = 255; // R
        imageData.data[idx + 1] = 0; // G
        imageData.data[idx + 2] = 0; // B
        imageData.data[idx + 3] = 255; // A
      }
    }

    // Create a blue 10x10 square in the bottom-right (from pixel 70,70 to 80,80)
    for (let y = 70; y < 80; y++) {
      for (let x = 70; x < 80; x++) {
        const idx = (y * 100 + x) * 4;
        imageData.data[idx] = 0; // R
        imageData.data[idx + 1] = 0; // G
        imageData.data[idx + 2] = 255; // B
        imageData.data[idx + 3] = 255; // A
      }
    }

    // Mock the getImageData to return our test data
    mockContext.getImageData.mockReturnValue(imageData);

    // Call the function
    const result = await maskToPolygons('multi-segment-mask.png', 100, 100);

    // Verify the result
    expect(result).toBeDefined();
    expect(result.imageWidth).toBe(100);
    expect(result.imageHeight).toBe(100);
    expect(result.polygons).toBeDefined();
    expect(result.polygons?.length).toBe(2); // Two polygons should be found

    // Check that the polygons have different colors
    expect(result.polygons?.[0].color).not.toBe(result.polygons?.[1].color);

    // Check that the polygons are in the correct positions
    const polygon1 = result.polygons?.[0];
    const polygon2 = result.polygons?.[1];

    // One polygon should be near the top-left square
    const isPolygon1TopLeft = polygon1?.points.every(
      (point) => point.x >= 9 && point.x <= 21 && point.y >= 9 && point.y <= 21,
    );

    const isPolygon2TopLeft = polygon2?.points.every(
      (point) => point.x >= 9 && point.x <= 21 && point.y >= 9 && point.y <= 21,
    );

    // One polygon should be near the bottom-right square
    const isPolygon1BottomRight = polygon1?.points.every(
      (point) => point.x >= 69 && point.x <= 81 && point.y >= 69 && point.y <= 81,
    );

    const isPolygon2BottomRight = polygon2?.points.every(
      (point) => point.x >= 69 && point.x <= 81 && point.y >= 69 && point.y <= 81,
    );

    // Either polygon1 is top-left and polygon2 is bottom-right, or vice versa
    expect((isPolygon1TopLeft && isPolygon2BottomRight) || (isPolygon2TopLeft && isPolygon1BottomRight)).toBe(true);
  });

  it('should handle errors when loading the mask', async () => {
    // Override the Image mock to simulate an error
    global.Image = class ErrorImage {
      public src: string = '';
      public crossOrigin: string = '';
      public onload: (() => void) | null = null;
      public onerror: ((error: any) => void) | null = null;

      constructor() {
        setTimeout(() => {
          if (this.onerror) this.onerror(new Error('Failed to load image'));
        }, 0);
      }
    } as any;

    // Call the function and expect it to reject
    await expect(maskToPolygons('error-mask.png', 100, 100)).rejects.toThrow('Failed to load segmentation mask');
  });
});
