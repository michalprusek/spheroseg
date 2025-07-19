import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadImage, getImageDimensions, applyImageFilters, resizeImage, cropImage, rotateImage } from '../imageLoader';

// Mock logger
vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock Image class
class MockImage {
  onload: () => void = () => {};
  onerror: (event?: Event | string) => void = () => {};
  src: string = '';
  width: number = 0;
  height: number = 0;

  constructor() {
    // Schedule onload callback asynchronously
    setTimeout(() => {
      this.width = 800;
      this.height = 600;
      this.onload();
    }, 10);
  }
}

// Mock canvas API
const mockContext = {
  drawImage: vi.fn(),
  getImageData: vi.fn(),
  putImageData: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  scale: vi.fn(),
  filter: '',
  save: vi.fn(),
  restore: vi.fn(),
};

const mockCanvas = {
  getContext: vi.fn().mockReturnValue(mockContext),
  width: 0,
  height: 0,
  toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mockDataUrl'),
};

// Mock document.createElement
document.createElement = vi.fn((tagName: string) => {
  if (tagName === 'canvas') {
    return mockCanvas as unknown as HTMLCanvasElement;
  }
  return {} as any;
});

describe('Image Loader Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset global Image constructor
    // @ts-expect-error
    global.Image = MockImage;

    // Reset mocks
    mockContext.drawImage.mockClear();
    mockContext.getImageData.mockClear();
    mockContext.putImageData.mockClear();
    mockCanvas.toDataURL.mockClear();
  });

  describe('loadImage', () => {
    it('loads an image from URL', async () => {
      const url = 'https://example.com/test.jpg';

      const imagePromise = loadImage(url);

      // Should return promise that resolves with image
      const image = await imagePromise;

      expect(image).toBeDefined();
      expect(image.width).toBe(800);
      expect(image.height).toBe(600);
      expect(image.src).toBe(url);
    });

    it('handles image load error', async () => {
      // Mock image that fails to load
      global.Image = class FailingMockImage {
        onload: () => void = () => {};
        onerror: (event?: Event | string) => void = () => {};
        src: string = '';
        width: number = 0;
        height: number = 0;

        constructor() {
          // Simulate error
          setTimeout(() => {
            this.onerror(new Error('Failed to load image'));
          }, 10);
        }
      } as unknown as typeof Image;

      const url = 'https://example.com/invalid.jpg';

      // Should reject with error
      await expect(loadImage(url)).rejects.toThrow();
    });
  });

  describe('getImageDimensions', () => {
    it('gets dimensions from an image URL', async () => {
      const url = 'https://example.com/test.jpg';

      const dimensions = await getImageDimensions(url);

      expect(dimensions).toEqual({ width: 800, height: 600 });
    });

    it('handles error when getting dimensions', async () => {
      // Mock image that fails to load
      global.Image = class FailingMockImage {
        onload: () => void = () => {};
        onerror: (event?: Event | string) => void = () => {};
        src: string = '';

        constructor() {
          // Simulate error
          setTimeout(() => {
            this.onerror(new Error('Failed to load image'));
          }, 10);
        }
      } as unknown as typeof Image;

      const url = 'https://example.com/invalid.jpg';

      // Should reject with error
      await expect(getImageDimensions(url)).rejects.toThrow();
    });
  });

  describe('applyImageFilters', () => {
    it('applies filters to an image', async () => {
      // Mock image data
      const mockImageData = {
        data: new Uint8ClampedArray(100),
        width: 10,
        height: 10,
      };
      mockContext.getImageData.mockReturnValue(mockImageData);

      const image = await loadImage('https://example.com/test.jpg');

      // Apply filters
      const filters = {
        brightness: 120,
        contrast: 110,
        saturation: 90,
      };

      await applyImageFilters(image, filters);

      // Should set filter on context
      expect(mockContext.filter).toContain('brightness(120%)');
      expect(mockContext.filter).toContain('contrast(110%)');
      expect(mockContext.filter).toContain('saturate(90%)');

      // Should draw image on canvas
      expect(mockContext.drawImage).toHaveBeenCalledWith(image, 0, 0);

      // Should return data URL
      expect(mockCanvas.toDataURL).toHaveBeenCalled();
    });

    it('uses default values for missing filters', async () => {
      const image = await loadImage('https://example.com/test.jpg');

      // Apply partial filters
      const filters = {
        brightness: 120,
        // contrast and saturation missing
      };

      await applyImageFilters(image, filters);

      // Should set filter with defaults for missing values
      expect(mockContext.filter).toContain('brightness(120%)');
      expect(mockContext.filter).toContain('contrast(100%)'); // Default
      expect(mockContext.filter).toContain('saturate(100%)'); // Default
    });

    it('returns original image if no filters are applied', async () => {
      const image = await loadImage('https://example.com/test.jpg');

      // Apply default filters
      const filters = {
        brightness: 100,
        contrast: 100,
        saturation: 100,
      };

      const result = await applyImageFilters(image, filters);

      // Should return original image since no actual filtering is needed
      expect(result).toBe(image);
    });
  });

  describe('resizeImage', () => {
    it('resizes an image', async () => {
      const image = await loadImage('https://example.com/test.jpg');

      await resizeImage(image, 400, 300);

      // Should set canvas dimensions
      expect(mockCanvas.width).toBe(400);
      expect(mockCanvas.height).toBe(300);

      // Should draw resized image
      expect(mockContext.drawImage).toHaveBeenCalledWith(image, 0, 0, 400, 300);

      // Should return data URL
      expect(mockCanvas.toDataURL).toHaveBeenCalled();
    });

    it('maintains aspect ratio when only width is specified', async () => {
      const image = await loadImage('https://example.com/test.jpg');

      await resizeImage(image, 400); // Only width specified

      // Should calculate height to maintain aspect ratio
      const expectedHeight = Math.round(400 * (600 / 800)); // 300

      expect(mockCanvas.width).toBe(400);
      expect(mockCanvas.height).toBe(expectedHeight);
    });

    it('maintains aspect ratio when only height is specified', async () => {
      const image = await loadImage('https://example.com/test.jpg');

      await resizeImage(image, undefined, 300); // Only height specified

      // Should calculate width to maintain aspect ratio
      const expectedWidth = Math.round(300 * (800 / 600)); // 400

      expect(mockCanvas.width).toBe(expectedWidth);
      expect(mockCanvas.height).toBe(300);
    });
  });

  describe('cropImage', () => {
    it('crops an image to specified region', async () => {
      const image = await loadImage('https://example.com/test.jpg');

      // Crop region
      const cropRegion = {
        x: 100,
        y: 100,
        width: 200,
        height: 200,
      };

      await cropImage(image, cropRegion);

      // Should set canvas dimensions to crop size
      expect(mockCanvas.width).toBe(cropRegion.width);
      expect(mockCanvas.height).toBe(cropRegion.height);

      // Should draw cropped region
      expect(mockContext.drawImage).toHaveBeenCalledWith(
        image,
        cropRegion.x,
        cropRegion.y,
        cropRegion.width,
        cropRegion.height,
        0,
        0,
        cropRegion.width,
        cropRegion.height,
      );
    });

    it('handles invalid crop regions gracefully', async () => {
      const image = await loadImage('https://example.com/test.jpg');

      // Crop region outside image bounds
      const invalidRegion = {
        x: 900, // Beyond image width
        y: 100,
        width: 200,
        height: 200,
      };

      // Should adjust crop region to fit within image
      await cropImage(image, invalidRegion);

      // x should be clamped to image width
      expect(mockContext.drawImage).toHaveBeenCalledWith(
        image,
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        0,
        0,
        expect.any(Number),
        expect.any(Number),
      );

      // First x parameter should be clamped
      const actualX = mockContext.drawImage.mock.calls[0][1];
      expect(actualX).toBeLessThan(image.width);
    });
  });

  describe('rotateImage', () => {
    it('rotates an image by specified angle', async () => {
      const image = await loadImage('https://example.com/test.jpg');

      // Rotate 90 degrees
      await rotateImage(image, 90);

      // Should set save context state
      expect(mockContext.save).toHaveBeenCalled();

      // Should translate and rotate
      expect(mockContext.translate).toHaveBeenCalled();
      expect(mockContext.rotate).toHaveBeenCalledWith(Math.PI / 2); // 90 degrees in radians

      // Should restore context
      expect(mockContext.restore).toHaveBeenCalled();
    });

    it('swaps width and height for 90/270 degree rotations', async () => {
      const image = await loadImage('https://example.com/test.jpg');

      // Original dimensions: 800x600

      // Rotate 90 degrees
      await rotateImage(image, 90);

      // Should swap dimensions
      expect(mockCanvas.width).toBe(600); // Was height
      expect(mockCanvas.height).toBe(800); // Was width
    });

    it('maintains original dimensions for 180 degree rotation', async () => {
      const image = await loadImage('https://example.com/test.jpg');

      // Original dimensions: 800x600

      // Rotate 180 degrees
      await rotateImage(image, 180);

      // Should maintain dimensions
      expect(mockCanvas.width).toBe(800);
      expect(mockCanvas.height).toBe(600);
    });
  });
});
