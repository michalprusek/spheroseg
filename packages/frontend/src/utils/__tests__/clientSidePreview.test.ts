import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateBmpPreview,
  generateFallbackPreview,
  canBrowserDisplayFormat,
  generateClientSidePreview,
} from '../clientSidePreview';

// Mock FileReader
global.FileReader = vi.fn(() => ({
  readAsDataURL: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
})) as any;

// Mock Image
global.Image = vi.fn(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
})) as any;

// Mock Canvas context
const mockCanvasContext = {
  fillStyle: '',
  fillRect: vi.fn(),
  font: '',
  textAlign: '',
  fillText: vi.fn(),
  drawImage: vi.fn(),
};

// Mock document.createElement
const mockCanvas = {
  getContext: vi.fn(() => mockCanvasContext),
  toDataURL: vi.fn(() => 'data:image/png;base64,mock'),
  width: 0,
  height: 0,
};

describe('clientSidePreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.document.createElement = vi.fn((tag) => {
      if (tag === 'canvas') {
        return mockCanvas as any;
      }
      return {} as any;
    });
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  });

  describe('generateFallbackPreview', () => {
    it('should generate a fallback preview with file info', () => {
      const file = new File(['content'], 'test.tiff', { type: 'image/tiff' });
      const result = generateFallbackPreview(file);

      expect(result).toBe('data:image/png;base64,mock');
      expect(mockCanvasContext.fillText).toHaveBeenCalledWith('TIFF', 100, 90);
      expect(mockCanvasContext.fillText).toHaveBeenCalledWith('test.tiff', 100, 160);
    });

    it('should truncate long file names', () => {
      const file = new File(['content'], 'very-long-filename-that-exceeds-limit.tiff', { type: 'image/tiff' });
      const result = generateFallbackPreview(file);

      expect(mockCanvasContext.fillText).toHaveBeenCalledWith('very-long-filenam...', 100, 160);
    });
  });

  describe('canBrowserDisplayFormat', () => {
    it('should return true for supported formats', () => {
      const jpegFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
      const pngFile = new File([''], 'test.png', { type: 'image/png' });
      const bmpFile = new File([''], 'test.bmp', { type: 'image/bmp' });

      expect(canBrowserDisplayFormat(jpegFile)).toBe(true);
      expect(canBrowserDisplayFormat(pngFile)).toBe(true);
      expect(canBrowserDisplayFormat(bmpFile)).toBe(true);
    });

    it('should return false for unsupported formats', () => {
      const tiffFile = new File([''], 'test.tiff', { type: 'image/tiff' });
      const unknownFile = new File([''], 'test.xyz', { type: 'application/octet-stream' });

      expect(canBrowserDisplayFormat(tiffFile)).toBe(false);
      expect(canBrowserDisplayFormat(unknownFile)).toBe(false);
    });
  });

  describe('generateClientSidePreview', () => {
    it('should return null for TIFF files', async () => {
      const tiffFile = new File([''], 'test.tiff', { type: 'image/tiff' });
      const result = await generateClientSidePreview(tiffFile);

      expect(result).toBe(null);
    });

    it('should return blob URL for supported formats', async () => {
      const jpegFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
      const result = await generateClientSidePreview(jpegFile);

      expect(result).toBe('blob:mock-url');
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(jpegFile);
    });

    it('should attempt BMP preview for BMP files', async () => {
      const bmpFile = new File([''], 'test.bmp', { type: 'image/bmp' });
      
      // Mock FileReader to simulate successful read
      const mockFileReader = {
        readAsDataURL: vi.fn(),
        onload: null as any,
        onerror: null as any,
        result: 'data:image/bmp;base64,mockdata',
      };
      
      global.FileReader = vi.fn(() => mockFileReader) as any;
      
      // Mock successful image load
      const mockImage = {
        onload: null as any,
        onerror: null as any,
        src: '',
        width: 800,
        height: 600,
      };
      
      global.Image = vi.fn(() => mockImage) as any;
      
      const promise = generateClientSidePreview(bmpFile);
      
      // Simulate FileReader load
      mockFileReader.readAsDataURL(bmpFile);
      if (mockFileReader.onload) {
        mockFileReader.onload({ target: { result: mockFileReader.result } } as any);
      }
      
      // Wait a bit for async operations
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Simulate Image load
      if (mockImage.onload) {
        mockImage.onload();
      }
      
      const result = await promise;
      expect(result).toBe('data:image/png;base64,mock');
    });
  });
});