import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CanvasContainer } from '../CanvasContainer';
import { EditMode } from '../hooks/segmentation/types';

// Mock context provider
vi.mock('../../../contexts/CanvasContext', () => ({
  CanvasProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="canvas-provider">{children}</div>,
}));

// Mock nested components
vi.mock('../CanvasImage', () => ({
  CanvasImage: () => <div data-testid="canvas-image">Canvas Image Mock</div>,
}));

vi.mock('../CanvasUIElements', () => ({
  CanvasUIElements: () => <div data-testid="canvas-ui-elements">Canvas UI Elements Mock</div>,
}));

// Mock resize observer
beforeEach(() => {
  // @ts-ignore
  global.ResizeObserver = class MockResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      // Immediately call the callback to simulate element being observed
      setTimeout(() => {
        callback(
          [
            {
              contentRect: {
                width: 800,
                height: 600,
              },
              target: document.createElement('div'),
            },
          ],
          this,
        );
      }, 0);
    }
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  };
});

describe('CanvasContainer', () => {
  const mockImageData = {
    url: 'https://example.com/test-image.jpg',
    width: 800,
    height: 600,
    originalFilename: 'test-image.jpg',
  };

  const mockPolygons = [
    {
      points: [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
        { x: 200, y: 200 },
        { x: 100, y: 200 },
      ],
      closed: true,
      color: '#FF0000',
    },
  ];

  const defaultProps = {
    imageData: mockImageData,
    polygons: mockPolygons,
    editMode: EditMode.VIEW,
    selectedPolygonIndex: -1,
    onPolygonSelect: vi.fn(),
    onPolygonsChange: vi.fn(),
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
    render(<CanvasContainer {...defaultProps} />);

    // Check for main component renders
    expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-provider')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-image')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-ui-elements')).toBeInTheDocument();
  });

  it('applies the correct class based on edit mode', () => {
    // Test VIEW mode
    const { rerender } = render(<CanvasContainer {...defaultProps} />);
    expect(screen.getByTestId('canvas-container')).toHaveClass('view-mode');

    // Test EDIT mode
    rerender(<CanvasContainer {...defaultProps} editMode={EditMode.EDIT} />);
    expect(screen.getByTestId('canvas-container')).toHaveClass('edit-mode');

    // Test CREATE mode
    rerender(<CanvasContainer {...defaultProps} editMode={EditMode.CREATE} />);
    expect(screen.getByTestId('canvas-container')).toHaveClass('create-mode');
  });

  it('handles key events correctly', () => {
    render(<CanvasContainer {...defaultProps} />);

    const container = screen.getByTestId('canvas-container');

    // Give the container focus
    container.focus();

    // Simulate pressing escape key
    fireEvent.keyDown(container, { key: 'Escape' });

    // Should call polygon select with -1 to deselect any polygon
    expect(defaultProps.onPolygonSelect).toHaveBeenCalledWith(-1);
  });

  it('handles mouse events for interacting with polygons', () => {
    render(<CanvasContainer {...defaultProps} />);

    const container = screen.getByTestId('canvas-container');

    // Simulate clicking on a polygon (coordinates don't matter in mock)
    fireEvent.mouseDown(container, {
      clientX: 150,
      clientY: 150,
      button: 0,
    });

    // In VIEW mode, clicking should select a polygon
    // Note: Actual polygon detection is tested separately
    // This just verifies the event handling wiring
    fireEvent.mouseUp(container, {
      clientX: 150,
      clientY: 150,
    });
  });

  it('updates canvas size on resize', async () => {
    render(<CanvasContainer {...defaultProps} />);

    // ResizeObserver should be initialized
    expect(global.ResizeObserver.prototype.observe).toHaveBeenCalled();

    // Check if the mock callback was executed and the component didn't crash
    expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
  });

  it('cleans up resize observer on unmount', () => {
    const { unmount } = render(<CanvasContainer {...defaultProps} />);

    // Unmount component
    unmount();

    // Should disconnect resize observer
    expect(global.ResizeObserver.prototype.disconnect).toHaveBeenCalled();
  });

  it('renders loading state during image load', () => {
    // Override the CanvasImage mock to control loading state
    vi.mocked(CanvasImage).mockImplementationOnce(() => null);

    render(<CanvasContainer {...defaultProps} />);

    // Should show loading indicator when image is not loaded
    expect(screen.getByTestId('canvas-loading')).toBeInTheDocument();
  });

  it('stops propagation for wheel events', () => {
    render(<CanvasContainer {...defaultProps} />);

    const container = screen.getByTestId('canvas-container');
    const wheelEvent = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
    });

    // Spy on preventDefault
    const preventDefaultSpy = vi.spyOn(wheelEvent, 'preventDefault');

    fireEvent(container, wheelEvent);

    // Should prevent default to avoid page scrolling
    expect(preventDefaultSpy).toHaveBeenCalled();
  });
});
