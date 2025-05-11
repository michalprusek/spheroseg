import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CanvasImage } from '../CanvasImage';
import { EditMode } from '@spheroseg/types';

// Mock custom hooks
vi.mock('../../../hooks/useCanvasContext', () => ({
  useCanvasContext: () => ({
    editMode: EditMode.VIEW,
    scale: 1,
    panOffset: { x: 0, y: 0 },
    setScale: vi.fn(),
    setPanOffset: vi.fn(),
    canvasSize: { width: 800, height: 600 },
    canvasBounds: { left: 0, top: 0, right: 800, bottom: 600 },
  }),
}));

// Mock image loading
const originalImage = global.Image;
beforeEach(() => {
  // Mock Image constructor
  global.Image = class MockImage {
    onload: Function = () => {};
    onerror: Function = () => {};
    src: string = '';
    width: number = 800;
    height: number = 600;

    constructor() {
      setTimeout(() => {
        this.onload();
      }, 100);
    }
  } as unknown as typeof Image;
});

afterEach(() => {
  global.Image = originalImage;
});

describe('CanvasImage', () => {
  const mockImageData = {
    url: 'https://example.com/test-image.jpg',
    width: 800,
    height: 600,
    originalFilename: 'test-image.jpg',
  };

  const defaultProps = {
    imageData: mockImageData,
    onLoad: vi.fn(),
    imageFilters: {
      brightness: 100,
      contrast: 100,
      saturation: 100,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<CanvasImage {...defaultProps} />);
    // Basic assertion to ensure component renders
    expect(screen.getByTestId('canvas-image')).toBeInTheDocument();
  });

  it('applies image filters correctly', () => {
    const filteredProps = {
      ...defaultProps,
      imageFilters: {
        brightness: 120,
        contrast: 130,
        saturation: 90,
      },
    };

    render(<CanvasImage {...filteredProps} />);

    // Check if filter is applied correctly
    const imageElement = screen.getByTestId('canvas-image');
    expect(imageElement).toHaveStyle(`filter: brightness(120%) contrast(130%) saturate(90%)`);
  });

  it('calls onLoad when image loads', async () => {
    render(<CanvasImage {...defaultProps} />);

    // Wait for the mock image to "load"
    await vi.waitFor(() => {
      expect(defaultProps.onLoad).toHaveBeenCalledTimes(1);
    });
  });

  it('adjusts transform based on scale and pan offset', () => {
    // Mocking different scale and pan offset
    vi.mocked(useCanvasContext).mockReturnValue({
      editMode: EditMode.VIEW,
      scale: 1.5,
      panOffset: { x: 50, y: 30 },
      setScale: vi.fn(),
      setPanOffset: vi.fn(),
      canvasSize: { width: 800, height: 600 },
      canvasBounds: { left: 0, top: 0, right: 800, bottom: 600 },
    });

    render(<CanvasImage {...defaultProps} />);

    const imageContainer = screen.getByTestId('canvas-image-container');
    expect(imageContainer).toHaveStyle('transform: scale(1.5) translate(50px, 30px)');
  });

  it('handles mouse wheel for zooming', () => {
    const mockSetScale = vi.fn();

    // Mock scale setter
    vi.mocked(useCanvasContext).mockReturnValue({
      editMode: EditMode.VIEW,
      scale: 1,
      panOffset: { x: 0, y: 0 },
      setScale: mockSetScale,
      setPanOffset: vi.fn(),
      canvasSize: { width: 800, height: 600 },
      canvasBounds: { left: 0, top: 0, right: 800, bottom: 600 },
    });

    render(<CanvasImage {...defaultProps} />);

    const imageContainer = screen.getByTestId('canvas-image-container');

    // Simulate wheel event to zoom in
    fireEvent.wheel(imageContainer, {
      deltaY: -100, // Negative deltaY = zoom in
      ctrlKey: true,
    });

    // Check if scale was increased
    expect(mockSetScale).toHaveBeenCalled();
  });

  it('handles mouse drag for panning', () => {
    const mockSetPanOffset = vi.fn();

    // Mock pan offset setter
    vi.mocked(useCanvasContext).mockReturnValue({
      editMode: EditMode.VIEW,
      scale: 1,
      panOffset: { x: 0, y: 0 },
      setScale: vi.fn(),
      setPanOffset: mockSetPanOffset,
      canvasSize: { width: 800, height: 600 },
      canvasBounds: { left: 0, top: 0, right: 800, bottom: 600 },
    });

    render(<CanvasImage {...defaultProps} />);

    const imageContainer = screen.getByTestId('canvas-image-container');

    // Simulate mouse down
    fireEvent.mouseDown(imageContainer, {
      button: 0, // Left mouse button
      clientX: 100,
      clientY: 100,
    });

    // Simulate mouse move
    fireEvent.mouseMove(document, {
      clientX: 150,
      clientY: 120,
    });

    // Check if pan offset was updated
    expect(mockSetPanOffset).toHaveBeenCalled();

    // Simulate mouse up to end the drag
    fireEvent.mouseUp(document);
  });

  it('handles image load error', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock Image to trigger onerror
    global.Image = class MockImageWithError {
      onload: Function = () => {};
      onerror: Function = () => {};
      src: string = '';

      constructor() {
        setTimeout(() => {
          this.onerror(new Error('Failed to load image'));
        }, 100);
      }
    } as unknown as typeof Image;

    render(<CanvasImage {...defaultProps} />);

    // Wait for the error to be logged
    vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });

  it('applies different styling in EDIT mode', () => {
    // Mock EDIT mode
    vi.mocked(useCanvasContext).mockReturnValue({
      editMode: EditMode.EDIT,
      scale: 1,
      panOffset: { x: 0, y: 0 },
      setScale: vi.fn(),
      setPanOffset: vi.fn(),
      canvasSize: { width: 800, height: 600 },
      canvasBounds: { left: 0, top: 0, right: 800, bottom: 600 },
    });

    render(<CanvasImage {...defaultProps} />);

    const imageContainer = screen.getByTestId('canvas-image-container');
    expect(imageContainer).toHaveClass('edit-mode');
  });
});
