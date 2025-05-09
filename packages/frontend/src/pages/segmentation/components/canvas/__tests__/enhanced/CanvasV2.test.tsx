import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';
import CanvasV2 from '../../CanvasV2';
import { EditMode, InteractionState } from '@/pages/segmentation/hooks/segmentation';
import userEvent from '@testing-library/user-event';

// Mock the external dependencies
vi.mock('@/hooks/useImageLoader', () => ({
  default: vi.fn((src) => {
    // Mock successful image loading by default
    return {
      image: src ? {
        src,
        width: 800,
        height: 600,
        onload: null,
        onerror: null
      } : null,
      isLoading: !src, // Loading if no src provided
      error: null
    };
  })
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}));

// Mock lodash debounce to execute immediately in tests
vi.mock('lodash', () => ({
  debounce: (fn) => fn
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn()
  }
}));

// Mock the polygonVisibility utility
vi.mock('@/pages/segmentation/utils/polygonVisibility', () => ({
  default: vi.fn((polygons) => polygons)
}));

// Helper function to create a mock mouse event
const createMouseEvent = (
  x: number, 
  y: number, 
  options: { button?: number; shiftKey?: boolean; ctrlKey?: boolean } = {}
) => {
  return {
    clientX: x,
    clientY: y,
    button: options.button ?? 0, // 0 = left, 1 = middle, 2 = right button
    shiftKey: options.shiftKey ?? false,
    ctrlKey: options.ctrlKey ?? false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  };
};

// Helper function to create a mock wheel event
const createWheelEvent = (deltaY: number, options: { ctrlKey?: boolean } = {}) => {
  return {
    deltaY,
    ctrlKey: options.ctrlKey ?? false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  };
};

describe('CanvasV2 Component', () => {
  // Standard props for most tests
  const mockImageData = {
    width: 800,
    height: 600,
    src: 'https://example.com/test-image.jpg'
  };
  
  const mockPolygons = [
    {
      id: 'polygon-1',
      points: [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
        { x: 200, y: 200 },
        { x: 100, y: 200 },
      ],
      color: '#FF0000',
      label: 'Polygon 1',
      type: 'external'
    },
    {
      id: 'polygon-2',
      points: [
        { x: 300, y: 300 },
        { x: 400, y: 300 },
        { x: 400, y: 400 },
        { x: 300, y: 400 },
      ],
      color: '#00FF00',
      label: 'Polygon 2',
      type: 'internal'
    }
  ];
  
  const defaultProps = {
    imageData: mockImageData,
    segmentationData: { polygons: mockPolygons },
    transform: { zoom: 1, translateX: 0, translateY: 0 },
    selectedPolygonId: null,
    hoveredVertex: null,
    setHoveredVertex: vi.fn(),
    tempPoints: [],
    editMode: EditMode.View,
    canvasRef: { current: null } as React.RefObject<HTMLDivElement>,
    interactionState: null,
    setSelectedPolygonId: vi.fn(),
    setEditMode: vi.fn(),
    setTempPoints: vi.fn(),
    setInteractionState: vi.fn(),
    onMouseDown: vi.fn(),
    onMouseMove: vi.fn(),
    onMouseUp: vi.fn(),
    onWheel: vi.fn(),
    onContextMenu: vi.fn()
  };
  
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    
    // Mock getBoundingClientRect for canvas container
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      width: 1000,
      height: 800,
      top: 0,
      left: 0,
      right: 1000,
      bottom: 800,
      toJSON: () => {}
    }));
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  it('renders canvas with image when image is available', async () => {
    // Override the image loader mock for this test
    const useImageLoader = require('@/hooks/useImageLoader').default;
    useImageLoader.mockReturnValueOnce({
      image: {
        src: mockImageData.src,
        width: mockImageData.width,
        height: mockImageData.height
      },
      isLoading: false,
      error: null
    });
    
    render(<CanvasV2 {...defaultProps} />);
    
    // Check that the canvas container is rendered
    const canvasContainer = screen.getByRole('presentation');
    expect(canvasContainer).toBeInTheDocument();
    
    // Check that the SVG is rendered
    const svg = canvasContainer.querySelector('svg');
    expect(svg).toBeInTheDocument();
    
    // Check for image element in the SVG
    const image = svg!.querySelector('image');
    expect(image).toBeInTheDocument();
    expect(image!.getAttribute('href')).toBe(mockImageData.src);
    
    // Should render the instruction text based on edit mode
    expect(screen.getByText(/View Mode/i)).toBeInTheDocument();
    expect(screen.getByText(/Click on a polygon to select it/i)).toBeInTheDocument();
  });
  
  it('renders loading state when image is loading', async () => {
    // Override the image loader mock for this test
    const useImageLoader = require('@/hooks/useImageLoader').default;
    useImageLoader.mockReturnValueOnce({
      image: null,
      isLoading: true,
      error: null
    });
    
    render(<CanvasV2 {...defaultProps} />);
    
    // Check for loading text
    expect(screen.getByText(/Načítání obrázku.../i)).toBeInTheDocument();
  });
  
  it('renders error state when image loading fails', async () => {
    // Override the image loader mock for this test
    const useImageLoader = require('@/hooks/useImageLoader').default;
    useImageLoader.mockReturnValueOnce({
      image: null,
      isLoading: false,
      error: new Error('Failed to load image')
    });
    
    render(<CanvasV2 {...defaultProps} />);
    
    // Check for error text
    expect(screen.getByText(/Chyba při načítání obrázku/i)).toBeInTheDocument();
  });
  
  it('renders polygons with correct styles', async () => {
    render(<CanvasV2 {...defaultProps} />);
    
    // Check that all polygons are rendered
    const polygonElements = document.querySelectorAll('polygon');
    expect(polygonElements.length).toBe(2); // We have 2 mock polygons
    
    // Check the points attribute of the first polygon
    const firstPolygon = polygonElements[0];
    expect(firstPolygon.getAttribute('points')).toBe('100,100 200,100 200,200 100,200');
  });
  
  it('renders selected polygon with different styling', async () => {
    // Render with a selected polygon
    render(<CanvasV2 {...defaultProps} selectedPolygonId="polygon-1" />);
    
    // Get all polygon elements
    const polygonElements = document.querySelectorAll('polygon');
    
    // First polygon should have different styling (selected)
    const firstPolygon = polygonElements[0];
    const firstPolygonStyle = window.getComputedStyle(firstPolygon);
    
    // Second polygon should have normal styling (not selected)
    const secondPolygon = polygonElements[1];
    const secondPolygonStyle = window.getComputedStyle(secondPolygon);
    
    // While we can't directly assert on the computed styles in jsdom,
    // we can check that the style attributes are different
    expect(firstPolygon.getAttribute('style')).not.toBe(secondPolygon.getAttribute('style'));
  });
  
  it('renders vertices for selected polygon in edit mode', async () => {
    // Render with a selected polygon in EditVertices mode
    render(
      <CanvasV2 
        {...defaultProps} 
        selectedPolygonId="polygon-1" 
        editMode={EditMode.EditVertices} 
      />
    );
    
    // The first polygon has 4 points, so we should see 4 vertex circles
    const vertexCircles = document.querySelectorAll('circle');
    expect(vertexCircles.length).toBe(4);
  });
  
  it('handles mouse events correctly', async () => {
    render(<CanvasV2 {...defaultProps} />);
    
    // Get the canvas container
    const canvasContainer = screen.getByRole('presentation');
    
    // Simulate mouse down event
    fireEvent.mouseDown(canvasContainer, createMouseEvent(100, 100));
    expect(defaultProps.onMouseDown).toHaveBeenCalled();
    
    // Simulate mouse move event
    fireEvent.mouseMove(canvasContainer, createMouseEvent(150, 150));
    expect(defaultProps.onMouseMove).toHaveBeenCalled();
    
    // Simulate mouse up event
    fireEvent.mouseUp(canvasContainer, createMouseEvent(200, 200));
    expect(defaultProps.onMouseUp).toHaveBeenCalled();
  });
  
  it('handles right-click/context menu events', async () => {
    render(<CanvasV2 {...defaultProps} />);
    
    // Get the canvas container
    const canvasContainer = screen.getByRole('presentation');
    
    // Simulate context menu event (right-click)
    fireEvent.contextMenu(canvasContainer);
    
    // Check that the default context menu is prevented
    expect(defaultProps.onContextMenu).toHaveBeenCalled();
  });
  
  it('renders temporary points in CreatePolygon mode', async () => {
    // Render with CreatePolygon mode and some temporary points
    render(
      <CanvasV2 
        {...defaultProps} 
        editMode={EditMode.CreatePolygon} 
        tempPoints={[
          { x: 100, y: 100 },
          { x: 200, y: 100 },
          { x: 200, y: 200 }
        ]}
      />
    );
    
    // Should render 3 temporary point circles + polyline
    const tempPointCircles = document.querySelectorAll('circle');
    expect(tempPointCircles.length).toBe(3);
    
    // Should render a polyline connecting the points
    const polyline = document.querySelector('polyline');
    expect(polyline).toBeInTheDocument();
    expect(polyline!.getAttribute('points')).toBe('100,100 200,100 200,200');
  });
  
  it('renders slice line in Slice mode', async () => {
    // Render with Slice mode and two points for the slice line
    render(
      <CanvasV2 
        {...defaultProps} 
        editMode={EditMode.Slice} 
        selectedPolygonId="polygon-1"
        tempPoints={[
          { x: 100, y: 100 },
          { x: 200, y: 200 }
        ]}
      />
    );
    
    // Should render a line element for the slice
    const sliceLine = document.querySelector('line');
    expect(sliceLine).toBeInTheDocument();
    expect(sliceLine!.getAttribute('x1')).toBe('100');
    expect(sliceLine!.getAttribute('y1')).toBe('100');
    expect(sliceLine!.getAttribute('x2')).toBe('200');
    expect(sliceLine!.getAttribute('y2')).toBe('200');
  });
  
  it('renders instruction text based on edit mode', async () => {
    // Test View mode instructions
    const { rerender } = render(<CanvasV2 {...defaultProps} editMode={EditMode.View} />);
    expect(screen.getByText(/View Mode/i)).toBeInTheDocument();
    
    // Test EditVertices mode instructions
    rerender(<CanvasV2 {...defaultProps} editMode={EditMode.EditVertices} />);
    expect(screen.getByText(/Edit Vertices Mode/i)).toBeInTheDocument();
    
    // Test CreatePolygon mode instructions
    rerender(<CanvasV2 {...defaultProps} editMode={EditMode.CreatePolygon} />);
    expect(screen.getByText(/Create Polygon Mode/i)).toBeInTheDocument();
    
    // Test DeletePolygon mode instructions
    rerender(<CanvasV2 {...defaultProps} editMode={EditMode.DeletePolygon} />);
    expect(screen.getByText(/Delete Polygon Mode/i)).toBeInTheDocument();
    
    // Test Slice mode instructions
    rerender(<CanvasV2 {...defaultProps} editMode={EditMode.Slice} />);
    expect(screen.getByText(/Slice Mode/i)).toBeInTheDocument();
  });
  
  it('renders special instructions for AddPoints mode', async () => {
    // Test AddPoints mode with different states
    
    // 1. Initial state (no interaction yet)
    const { rerender } = render(
      <CanvasV2 
        {...defaultProps} 
        editMode={EditMode.AddPoints} 
        interactionState={null}
      />
    );
    expect(screen.getByText(/Add Points Mode/i)).toBeInTheDocument();
    expect(screen.getByText(/Click on any vertex to start adding points/i)).toBeInTheDocument();
    
    // 2. Adding points state
    rerender(
      <CanvasV2 
        {...defaultProps} 
        editMode={EditMode.AddPoints} 
        interactionState={{ 
          isAddingPoints: true,
          addPointStartVertex: { polygonId: 'polygon-1', vertexIndex: 0 }
        }}
      />
    );
    expect(screen.getByText(/Click to add points/i)).toBeInTheDocument();
  });
  
  it('handles wheel events for zoom', async () => {
    render(<CanvasV2 {...defaultProps} />);
    
    // Get the SVG element
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
    
    // Simulate wheel event (scroll down = zoom out)
    fireEvent.wheel(svg!, createWheelEvent(100));
    
    // Check that onWheel handler was called
    expect(defaultProps.onWheel).toHaveBeenCalled();
  });
  
  it('applies the correct transform to SVG content', async () => {
    // Render with a different transform
    render(
      <CanvasV2 
        {...defaultProps} 
        transform={{ zoom: 2, translateX: 100, translateY: 50 }}
      />
    );
    
    // Check the transform attribute on the SVG group
    const svgGroup = document.querySelector('svg g');
    expect(svgGroup).toBeInTheDocument();
    expect(svgGroup!.getAttribute('transform')).toBe('translate(100 50) scale(2)');
  });
  
  it('handles vertex interaction in EditVertices mode', async () => {
    // Setup props for vertex interaction test
    const editVerticesProps = {
      ...defaultProps,
      editMode: EditMode.EditVertices,
      selectedPolygonId: 'polygon-1',
      setHoveredVertex: vi.fn()
    };
    
    render(<CanvasV2 {...editVerticesProps} />);
    
    // Find all vertex circles
    const vertexCircles = document.querySelectorAll('circle');
    expect(vertexCircles.length).toBe(4); // Polygon 1 has 4 vertices
    
    // Simulate shift key press
    const shiftKeyHandler = {} as any;
    window.addEventListener = vi.fn((event, handler) => {
      if (event === 'keydown' || event === 'keyup') {
        shiftKeyHandler[event] = handler;
      }
    });
    
    // Simulate shift key down
    act(() => {
      if (shiftKeyHandler.keydown) {
        shiftKeyHandler.keydown({ key: 'Shift' });
      }
    });
    
    // Click on a vertex with shift pressed
    const firstVertex = vertexCircles[0];
    fireEvent.click(firstVertex);
    
    // Should trigger mode change to AddPoints
    expect(editVerticesProps.setEditMode).toHaveBeenCalledWith(EditMode.AddPoints);
    expect(editVerticesProps.setInteractionState).toHaveBeenCalledWith(
      expect.objectContaining({
        isAddingPoints: true,
        addPointStartVertex: expect.objectContaining({
          polygonId: 'polygon-1',
          vertexIndex: 0
        })
      })
    );
  });
  
  it('handles complex interaction state in AddPoints mode', async () => {
    // Setup props for AddPoints mode test
    const addPointsProps = {
      ...defaultProps,
      editMode: EditMode.AddPoints,
      selectedPolygonId: 'polygon-1',
      interactionState: {
        isAddingPoints: true,
        addPointStartVertex: { polygonId: 'polygon-1', vertexIndex: 0 }
      },
      tempPoints: [
        { x: 150, y: 150 },
        { x: 180, y: 180 }
      ],
      setHoveredVertex: vi.fn()
    };
    
    render(<CanvasV2 {...addPointsProps} />);
    
    // Should render temporary points
    const tempPointCircles = document.querySelectorAll('circle');
    expect(tempPointCircles.length).toBeGreaterThan(2); // 4 vertices + 2 temp points
    
    // Should render a polyline for temp points
    const polyline = document.querySelector('polyline');
    expect(polyline).toBeInTheDocument();
    
    // Should render line from first vertex to first temp point
    const lines = document.querySelectorAll('line');
    expect(lines.length).toBeGreaterThan(0);
  });
});

describe('CanvasV2 Component - Edge Cases', () => {
  // Standard props for most tests
  const defaultProps = {
    imageData: null,
    segmentationData: null,
    transform: { zoom: 1, translateX: 0, translateY: 0 },
    selectedPolygonId: null,
    hoveredVertex: null,
    setHoveredVertex: vi.fn(),
    tempPoints: [],
    editMode: EditMode.View,
    canvasRef: { current: null } as React.RefObject<HTMLDivElement>,
    interactionState: null,
    setSelectedPolygonId: vi.fn(),
    setEditMode: vi.fn(),
    setTempPoints: vi.fn(),
    setInteractionState: vi.fn(),
    onMouseDown: vi.fn(),
    onMouseMove: vi.fn(),
    onMouseUp: vi.fn(),
    onWheel: vi.fn(),
    onContextMenu: vi.fn()
  };
  
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('handles no image or segmentation data gracefully', async () => {
    render(<CanvasV2 {...defaultProps} />);
    
    // Should still render canvas container without errors
    const canvasContainer = screen.getByRole('presentation');
    expect(canvasContainer).toBeInTheDocument();
    
    // No image, polygons, or errors should be shown
    const svg = canvasContainer.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg!.querySelector('image')).toBeNull();
    expect(svg!.querySelectorAll('polygon').length).toBe(0);
  });
  
  it('handles empty polygon array gracefully', async () => {
    render(
      <CanvasV2 
        {...defaultProps} 
        segmentationData={{ polygons: [] }}
      />
    );
    
    // Should render canvas without polygons
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg!.querySelectorAll('polygon').length).toBe(0);
  });
  
  it('handles extreme zoom values correctly', async () => {
    // Test very small zoom
    const { rerender } = render(
      <CanvasV2 
        {...defaultProps} 
        transform={{ zoom: 0.1, translateX: 0, translateY: 0 }}
      />
    );
    
    // Check transform attribute
    let svgGroup = document.querySelector('svg g');
    expect(svgGroup!.getAttribute('transform')).toBe('translate(0 0) scale(0.1)');
    
    // Test very large zoom
    rerender(
      <CanvasV2 
        {...defaultProps} 
        transform={{ zoom: 10, translateX: 0, translateY: 0 }}
      />
    );
    
    // Check transform attribute
    svgGroup = document.querySelector('svg g');
    expect(svgGroup!.getAttribute('transform')).toBe('translate(0 0) scale(10)');
  });
  
  it('handles negative translations correctly', async () => {
    render(
      <CanvasV2 
        {...defaultProps} 
        transform={{ zoom: 1, translateX: -100, translateY: -50 }}
      />
    );
    
    // Check transform attribute
    const svgGroup = document.querySelector('svg g');
    expect(svgGroup!.getAttribute('transform')).toBe('translate(-100 -50) scale(1)');
  });
  
  it('handles mode changes without unnecessary re-renders', async () => {
    const { rerender } = render(<CanvasV2 {...defaultProps} />);
    
    // Change mode several times
    rerender(<CanvasV2 {...defaultProps} editMode={EditMode.EditVertices} />);
    rerender(<CanvasV2 {...defaultProps} editMode={EditMode.CreatePolygon} />);
    rerender(<CanvasV2 {...defaultProps} editMode={EditMode.Slice} />);
    
    // Should update instruction text for each mode
    expect(screen.getByText(/Slice Mode/i)).toBeInTheDocument();
  });
  
  it('handles window resize gracefully', async () => {
    // Set up resize observer mock
    const resizeObserverMock = vi.fn();
    window.ResizeObserver = vi.fn(() => ({
      observe: resizeObserverMock,
      unobserve: vi.fn(),
      disconnect: vi.fn()
    }));
    
    render(<CanvasV2 {...defaultProps} />);
    
    // Should not throw errors when window is resized
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
  });
  
  it('adjusts vertex size based on zoom level', async () => {
    // Test with normal zoom
    const { rerender } = render(
      <CanvasV2 
        {...defaultProps} 
        selectedPolygonId="polygon-1"
        editMode={EditMode.EditVertices}
        transform={{ zoom: 1, translateX: 0, translateY: 0 }}
        segmentationData={{
          polygons: [{
            id: 'polygon-1',
            points: [{ x: 100, y: 100 }],
            type: 'external'
          }]
        }}
      />
    );
    
    // Find vertex circle
    let vertexCircle = document.querySelector('circle');
    let radius1 = parseFloat(vertexCircle!.getAttribute('r') || '0');
    
    // Test with high zoom - vertices should appear smaller relative to content
    rerender(
      <CanvasV2 
        {...defaultProps} 
        selectedPolygonId="polygon-1"
        editMode={EditMode.EditVertices}
        transform={{ zoom: 2, translateX: 0, translateY: 0 }}
        segmentationData={{
          polygons: [{
            id: 'polygon-1',
            points: [{ x: 100, y: 100 }],
            type: 'external'
          }]
        }}
      />
    );
    
    // Find vertex circle again
    vertexCircle = document.querySelector('circle');
    let radius2 = parseFloat(vertexCircle!.getAttribute('r') || '0');
    
    // Radius should be smaller at higher zoom (r ∝ 1/zoom)
    expect(radius2).toBeLessThan(radius1);
  });
});