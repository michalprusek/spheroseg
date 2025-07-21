import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  loadImage, 
  getImageDimensions, 
  loadImageFromUrl,
  loadImageFromFile,
  checkImageExists,
  addCacheBuster,
  generatePossibleImageUrls,
  tryMultipleImageUrls,
  loadImageFromApi,
  universalImageLoader,
  imageToCanvas,
  getImageData
} from '../imageLoader';

// Mock logger
vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock API client
vi.mock('@/services/api/client', () => ({
  default: {
    get: vi.fn(),
  },
}));

// Mock Image class
class MockImage {
  onload: () => void = () => {};
  onerror: (event?: Event | string) => void = () => {};
  src: string = '';
  width: number = 0;
  height: number = 0;
  naturalWidth: number = 800;
  naturalHeight: number = 600;
  crossOrigin: string = '';

  constructor() {
    // Schedule onload callback asynchronously
    setTimeout(() => {
      this.width = 800;
      this.height = 600;
      this.onload();
    }, 10);
  }
}

// Mock FileReader
class MockFileReader {
  onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
  onerror: ((event: ProgressEvent<FileReader>) => void) | null = null;
  result: string | ArrayBuffer | null = null;

  readAsDataURL(file: File) {
    setTimeout(() => {
      this.result = 'data:image/png;base64,mockDataUrl';
      if (this.onload) {
        this.onload({ target: { result: this.result } } as any);
      }
    }, 10);
  }
}

// Mock canvas API
const mockContext = {
  drawImage: vi.fn(),
  getImageData: vi.fn().mockReturnValue({
    data: new Uint8ClampedArray(100),
    width: 10,
    height: 10,
  }),
};

const mockCanvas = {
  getContext: vi.fn().mockReturnValue(mockContext),
  width: 0,
  height: 0,
};

// Mock document.createElement
const originalCreateElement = document.createElement;
document.createElement = vi.fn((tagName: string) => {
  if (tagName === 'canvas') {
    return mockCanvas as unknown as HTMLCanvasElement;
  }
  return originalCreateElement.call(document, tagName);
});

// Mock fetch
global.fetch = vi.fn();

describe('Image Loader Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset global Image constructor
    // @ts-expect-error: Override global Image constructor with mock for testing
    global.Image = MockImage;
    
    // @ts-expect-error: Override global FileReader constructor with mock for testing
    global.FileReader = MockFileReader;

    // Reset fetch mock
    (global.fetch as any).mockReset();
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
      expect(image.src).toContain(url);
    });

    it('handles image load error', async () => {
      // Mock image that fails to load
      global.Image = class FailingMockImage {
        onload: () => void = () => {};
        onerror: (event?: Event | string) => void = () => {};
        src: string = '';
        width: number = 0;
        height: number = 0;
        crossOrigin: string = '';

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

    it('loads an image from File', async () => {
      const file = new File([''], 'test.png', { type: 'image/png' });

      const image = await loadImage(file);

      expect(image).toBeDefined();
      expect(image.src).toBe('data:image/png;base64,mockDataUrl');
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
        crossOrigin: string = '';

        constructor() {
          // Simulate error
          setTimeout(() => {
            this.onerror(new Error('Failed to load image'));
          }, 10);
        }
      } as unknown as typeof Image;

      const url = 'https://example.com/invalid.jpg';

      // Should return null on error
      const dimensions = await getImageDimensions(url);
      expect(dimensions).toBeNull();
    });
  });

  describe('addCacheBuster', () => {
    it('adds cache buster to URL without query params', () => {
      const url = 'https://example.com/image.jpg';
      const result = addCacheBuster(url);
      
      expect(result).toMatch(/\?_cb=\d+$/);
    });

    it('adds cache buster to URL with existing query params', () => {
      const url = 'https://example.com/image.jpg?size=large';
      const result = addCacheBuster(url);
      
      expect(result).toMatch(/&_cb=\d+$/);
    });
  });

  describe('checkImageExists', () => {
    it('returns true for existing image', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
      });

      const exists = await checkImageExists('https://example.com/image.jpg');
      
      expect(exists).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/image.jpg',
        expect.objectContaining({
          method: 'HEAD',
          cache: 'no-cache',
        })
      );
    });

    it('returns false for non-existing image', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
      });

      const exists = await checkImageExists('https://example.com/missing.jpg');
      
      expect(exists).toBe(false);
    });

    it('returns false on fetch error', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const exists = await checkImageExists('https://example.com/error.jpg');
      
      expect(exists).toBe(false);
    });
  });

  describe('generatePossibleImageUrls', () => {
    it('generates multiple URL variations', () => {
      const originalUrl = 'https://example.com/uploads/image.jpg';
      const projectId = 'proj123';
      const imageId = 'img456';

      const urls = generatePossibleImageUrls(originalUrl, projectId, imageId);

      expect(urls).toContain(originalUrl);
      expect(urls).toContain('/uploads/image.jpg');
      expect(urls).toContain('/api/uploads/image.jpg');
      expect(urls).toContain('/uploads/proj123/image.jpg');
      expect(urls).toContain('/uploads/proj123/img456.png');
    });

    it('adds extensions for files without extension', () => {
      const originalUrl = 'https://example.com/uploads/image';
      
      const urls = generatePossibleImageUrls(originalUrl);

      expect(urls).toContain('https://example.com/uploads/image.png');
      expect(urls).toContain('https://example.com/uploads/image.jpg');
      expect(urls).toContain('https://example.com/uploads/image.jpeg');
    });
  });

  describe('tryMultipleImageUrls', () => {
    it('tries multiple URLs and returns first successful', async () => {
      const urls = [
        'https://example.com/fail1.jpg',
        'https://example.com/fail2.jpg',
        'https://example.com/success.jpg',
        'https://example.com/unused.jpg',
      ];

      // Mock fetch responses
      (global.fetch as any)
        .mockResolvedValueOnce({ ok: false }) // fail1
        .mockResolvedValueOnce({ ok: false }) // fail2
        .mockResolvedValueOnce({ ok: true });  // success

      const result = await tryMultipleImageUrls(urls);

      expect(result).toEqual({
        url: 'https://example.com/success.jpg',
        width: 800,
        height: 600,
      });
    });

    it('returns null if all URLs fail', async () => {
      const urls = [
        'https://example.com/fail1.jpg',
        'https://example.com/fail2.jpg',
      ];

      (global.fetch as any).mockResolvedValue({ ok: false });

      const result = await tryMultipleImageUrls(urls);

      expect(result).toBeNull();
    });
  });

  describe('imageToCanvas', () => {
    it('converts image to canvas', async () => {
      const image = await loadImage('https://example.com/test.jpg');
      
      const canvas = imageToCanvas(image);

      expect(mockCanvas.width).toBe(800);
      expect(mockCanvas.height).toBe(600);
      expect(mockContext.drawImage).toHaveBeenCalledWith(image, 0, 0);
    });
  });

  describe('getImageData', () => {
    it('gets image data from image', async () => {
      const image = await loadImage('https://example.com/test.jpg');
      
      const imageData = getImageData(image);

      expect(imageData).toBeDefined();
      expect(imageData?.width).toBe(10);
      expect(imageData?.height).toBe(10);
      expect(mockContext.getImageData).toHaveBeenCalled();
    });
  });
});