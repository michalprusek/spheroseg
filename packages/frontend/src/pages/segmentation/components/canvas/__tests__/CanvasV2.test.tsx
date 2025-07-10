import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi, describe, beforeEach, it, expect } from 'vitest';
import CanvasV2 from '../CanvasV2';
import { EditMode, InteractionState } from '../../../hooks/segmentation';
import '@testing-library/jest-dom';

// Mock dependencies
vi.mock('@/hooks/useImageLoader', () => ({
  default: vi.fn(() => ({
    image: { src: 'test-image-url', width: 800, height: 600 },
    isLoading: false,
    error: null,
  })),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../utils/polygonVisibility', () => ({
  default: vi.fn((polygons) => polygons), // Just return all polygons for testing
}));

// Mock debounce to execute immediately for testing
vi.mock('lodash', () => ({
  debounce: (fn) => {
    const debounced = (...args) => fn(...args);
    debounced.cancel = vi.fn();
    return debounced;
  },
}));

describe('CanvasV2 Component', () => {
  // Mock data
  const mockImageData = {
    width: 800,
    height: 600,
    src: 'test-image-url',
  };

  const mockExternalPolygon = {
    id: 'polygon-1',
    points: [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 200 },
      { x: 100, y: 200 },
    ],
    type: 'external' as const,
    color: '#FF0000',
    metadata: {},
  };

  const mockInternalPolygon = {
    id: 'polygon-2',
    points: [
      { x: 120, y: 120 },
      { x: 180, y: 120 },
      { x: 180, y: 180 },
      { x: 120, y: 180 },
    ],
    type: 'internal' as const,
    color: '#0000FF',
    metadata: {},
  };

  const mockSegmentationData = {
    polygons: [mockExternalPolygon, mockInternalPolygon],
    contours: [],
    image: { width: 800, height: 600 },
    metadata: {},
  };

  const mockTransform = {
    zoom: 1,
    translateX: 0,
    translateY: 0,
  };

  // Common props for rendering
  const mockProps = {
    imageData: mockImageData,
    segmentationData: mockSegmentationData,
    transform: mockTransform,
    selectedPolygonId: null,
    hoveredVertex: null,
    setHoveredVertex: vi.fn(),
    tempPoints: [],
    editMode: EditMode.View,
    canvasRef: { current: document.createElement('div') },
    interactionState: {} as InteractionState,
    setSelectedPolygonId: vi.fn(),
    setEditMode: vi.fn(),
    setTempPoints: vi.fn(),
    setInteractionState: vi.fn(),
    onMouseDown: vi.fn(),
    onMouseMove: vi.fn(),
    onMouseUp: vi.fn(),
    onWheel: vi.fn(),
    onContextMenu: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Add getBoundingClientRect to mock canvas element
    if (mockProps.canvasRef.current) {
      mockProps.canvasRef.current.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        right: 800,
        bottom: 600,
        width: 800,
        height: 600,
        x: 0,
        y: 0,
        toJSON: () => {},
      });
    }
  });

  it('renders the canvas with the image', () => {
    render(<CanvasV2 {...mockProps} />);

    // Should have svg element
    const svgElement = document.querySelector('svg');
    expect(svgElement).toBeInTheDocument();

    // Should have image element with correct attributes
    const imageElement = document.querySelector('image');
    expect(imageElement).toBeInTheDocument();
    expect(imageElement).toHaveAttribute('href', 'test-image-url');
    expect(imageElement).toHaveAttribute('width', '800');
    expect(imageElement).toHaveAttribute('height', '600');
  });

  it('renders polygons correctly', () => {
    render(<CanvasV2 {...mockProps} />);

    // Should render both polygons
    const polygonElements = document.querySelectorAll('polygon');
    expect(polygonElements.length).toBe(2);

    // First polygon should have correct points
    expect(polygonElements[0]).toHaveAttribute('points', '100,100 200,100 200,200 100,200');

    // Second polygon should have correct points
    expect(polygonElements[1]).toHaveAttribute('points', '120,120 180,120 180,180 120,180');

    // Style differences should be applied (external vs internal)
    const firstPolygonStyle = window.getComputedStyle(polygonElements[0]);
    const secondPolygonStyle = window.getComputedStyle(polygonElements[1]);

    // The actual styles are difficult to test with JSDOM, but we can check that they're different
    expect(polygonElements[0].getAttribute('style')).not.toBe(polygonElements[1].getAttribute('style'));
  });

  it('renders different UI elements based on edit mode', () => {
    // Render in View mode
    const { rerender } = render(<CanvasV2 {...mockProps} editMode={EditMode.View} />);

    // Should show View mode instructions
    expect(screen.getByText('View Mode')).toBeInTheDocument();
    expect(screen.getByText('Click on a polygon to select it')).toBeInTheDocument();

    // Rerender in Create Polygon mode
    rerender(<CanvasV2 {...mockProps} editMode={EditMode.CreatePolygon} />);

    // Should show Create Polygon mode instructions
    expect(screen.getByText('Create Polygon Mode')).toBeInTheDocument();
    expect(screen.getByText('1. Click to start creating a polygon')).toBeInTheDocument();

    // Rerender in Slice mode
    rerender(<CanvasV2 {...mockProps} editMode={EditMode.Slice} />);

    // Should show Slice mode instructions
    expect(screen.getByText('Slice Mode')).toBeInTheDocument();
    expect(screen.getByText('1. Click on a polygon to select it for slicing')).toBeInTheDocument();

    // Rerender in Edit Vertices mode
    rerender(<CanvasV2 {...mockProps} editMode={EditMode.EditVertices} />);

    // Should show Edit Vertices mode instructions
    expect(screen.getByText('Edit Vertices Mode')).toBeInTheDocument();

    // Rerender in Delete Polygon mode
    rerender(<CanvasV2 {...mockProps} editMode={EditMode.DeletePolygon} />);

    // Should show Delete Polygon mode instructions
    expect(screen.getByText('Delete Polygon Mode')).toBeInTheDocument();
    expect(screen.getByText('Click on a polygon to delete it')).toBeInTheDocument();

    // Rerender in Add Points mode
    rerender(<CanvasV2 {...mockProps} editMode={EditMode.AddPoints} />);

    // Should show Add Points mode instructions
    expect(screen.getByText('Add Points Mode')).toBeInTheDocument();
  });

  it('shows loading state when image is loading', () => {
    // Override the useImageLoader mock for this test
    vi.mocked(require('@/hooks/useImageLoader').default).mockReturnValueOnce({
      image: null,
      isLoading: true,
      error: null,
    });

    render(<CanvasV2 {...mockProps} />);

    // Should show loading text
    expect(screen.getByText('Načítání obrázku...')).toBeInTheDocument();
  });

  it('shows error state when image fails to load', () => {
    // Override the useImageLoader mock for this test
    vi.mocked(require('@/hooks/useImageLoader').default).mockReturnValueOnce({
      image: null,
      isLoading: false,
      error: new Error('Failed to load image'),
    });

    render(<CanvasV2 {...mockProps} />);

    // Should show error text
    expect(screen.getByText('Chyba při načítání obrázku')).toBeInTheDocument();
  });

  it('handles mouse events correctly', () => {
    render(<CanvasV2 {...mockProps} />);

    const canvasElement = screen.getByRole('presentation');

    // Simulate mouse down
    fireEvent.mouseDown(canvasElement);

    // Check if onMouseDown was called
    expect(mockProps.onMouseDown).toHaveBeenCalled();

    // Simulate mouse move
    fireEvent.mouseMove(canvasElement);

    // Check if onMouseMove was called
    expect(mockProps.onMouseMove).toHaveBeenCalled();

    // Simulate mouse up
    fireEvent.mouseUp(canvasElement);

    // Check if onMouseUp was called
    expect(mockProps.onMouseUp).toHaveBeenCalled();

    // Simulate context menu
    fireEvent.contextMenu(canvasElement);

    // Check if onContextMenu was called
    expect(mockProps.onContextMenu).toHaveBeenCalled();
  });

  it('renders vertices for selected polygon in edit vertices mode', () => {
    render(<CanvasV2 {...mockProps} editMode={EditMode.EditVertices} selectedPolygonId="polygon-1" />);

    // Should render 4 vertices (one for each point in the polygon)
    const vertexElements = document.querySelectorAll('circle');
    expect(vertexElements.length).toBe(4);

    // First vertex should be at the correct position
    expect(vertexElements[0]).toHaveAttribute('cx', '100');
    expect(vertexElements[0]).toHaveAttribute('cy', '100');
  });

  it('renders vertices with different styles when hovered', () => {
    render(
      <CanvasV2
        {...mockProps}
        editMode={EditMode.EditVertices}
        selectedPolygonId="polygon-1"
        hoveredVertex={{ polygonId: 'polygon-1', vertexIndex: 0 }}
      />,
    );

    // Get the first vertex
    const vertexElements = document.querySelectorAll('circle');
    const hoveredVertex = vertexElements[0];

    // Hovered vertex should have yellow fill
    expect(hoveredVertex).toHaveAttribute('fill', 'yellow');

    // Hovered vertex should have larger radius
    const regularRadius = vertexElements[1].getAttribute('r');
    const hoveredRadius = hoveredVertex.getAttribute('r');
    expect(parseFloat(hoveredRadius || '0')).toBeGreaterThan(parseFloat(regularRadius || '0'));
  });

  it('renders temporary points in create polygon mode', () => {
    const tempPoints = [
      { x: 50, y: 50 },
      { x: 150, y: 50 },
    ];

    render(<CanvasV2 {...mockProps} editMode={EditMode.CreatePolygon} tempPoints={tempPoints} />);

    // Should render a polyline connecting the points
    const polyline = document.querySelector('polyline');
    expect(polyline).toBeInTheDocument();
    expect(polyline).toHaveAttribute('points', '50,50 150,50');

    // Should render vertices for each point
    const tempVertices = document.querySelectorAll('circle');
    expect(tempVertices.length).toBe(2);

    // First vertex should have special styling
    expect(tempVertices[0]).toHaveAttribute('fill', 'yellow');
  });

  it('renders slice line in slice mode', () => {
    const tempPoints = [
      { x: 50, y: 50 },
      { x: 150, y: 150 },
    ];

    render(<CanvasV2 {...mockProps} editMode={EditMode.Slice} tempPoints={tempPoints} />);

    // Should render a line connecting the points
    const line = document.querySelector('line');
    expect(line).toBeInTheDocument();
    expect(line).toHaveAttribute('x1', '50');
    expect(line).toHaveAttribute('y1', '50');
    expect(line).toHaveAttribute('x2', '150');
    expect(line).toHaveAttribute('y2', '150');
    expect(line).toHaveAttribute('stroke', 'magenta');

    // Should render vertices for each point
    const sliceVertices = document.querySelectorAll('circle');
    expect(sliceVertices.length).toBe(2);
    expect(sliceVertices[0]).toHaveAttribute('fill', 'magenta');
  });

  it('renders add points mode UI correctly', () => {
    const tempPoints = [
      { x: 50, y: 50 },
      { x: 150, y: 50 },
    ];

    const interactionState = {
      isAddingPoints: true,
      addPointStartVertex: {
        polygonId: 'polygon-1',
        vertexIndex: 0,
      },
    };

    render(
      <CanvasV2
        {...mockProps}
        editMode={EditMode.AddPoints}
        selectedPolygonId="polygon-1"
        tempPoints={tempPoints}
        interactionState={interactionState}
      />,
    );

    // Should show Add Points Mode instructions
    expect(screen.getByText('Add Points Mode')).toBeInTheDocument();

    // Should render a polyline connecting the temporary points
    const polyline = document.querySelector('polyline');
    expect(polyline).toBeInTheDocument();
    expect(polyline).toHaveAttribute('points', '50,50 150,50');

    // Should render vertices for temporary points
    const tempVertices = document.querySelectorAll('circle[fill="cyan"], circle[fill="yellow"]');
    expect(tempVertices.length).toBeGreaterThan(0);
  });

  it('adds keyboard event listeners for shift key', () => {
    // Spy on addEventListener
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = render(<CanvasV2 {...mockProps} />);

    // Check that event listeners were added
    expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(addEventListenerSpy).toHaveBeenCalledWith('keyup', expect.any(Function));

    // Unmount to test cleanup
    unmount();

    // Check that event listeners were removed
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keyup', expect.any(Function));
  });

  it('handles shift key press correctly', () => {
    render(<CanvasV2 {...mockProps} />);

    // Simulate pressing shift key
    fireEvent.keyDown(window, { key: 'Shift' });

    // Rerender in edit vertices mode to see the effect on cursor
    render(<CanvasV2 {...mockProps} editMode={EditMode.EditVertices} selectedPolygonId="polygon-1" />);

    // Get vertex elements
    const vertexElements = document.querySelectorAll('circle');

    // With shift pressed, cursor should be 'pointer'
    expect(vertexElements[0]).toHaveStyle('cursor: pointer');

    // Simulate releasing shift key
    fireEvent.keyUp(window, { key: 'Shift' });

    // Rerender to see the effect
    render(<CanvasV2 {...mockProps} editMode={EditMode.EditVertices} selectedPolygonId="polygon-1" />);

    // Get vertex elements again
    const updatedVertexElements = document.querySelectorAll('circle');

    // Without shift pressed, cursor should be 'default'
    expect(updatedVertexElements[0]).toHaveStyle('cursor: default');
  });

  it('handles vertex click with shift in edit vertices mode', () => {
    render(<CanvasV2 {...mockProps} editMode={EditMode.EditVertices} selectedPolygonId="polygon-1" />);

    // Simulate pressing shift key
    fireEvent.keyDown(window, { key: 'Shift' });

    // Get the first vertex
    const vertexElements = document.querySelectorAll('circle');

    // Simulate clicking on a vertex with shift pressed
    fireEvent.click(vertexElements[0]);

    // Should switch to add points mode
    expect(mockProps.setEditMode).toHaveBeenCalledWith(EditMode.AddPoints);

    // Should update interaction state
    expect(mockProps.setInteractionState).toHaveBeenCalledWith(
      expect.objectContaining({
        isAddingPoints: true,
        addPointStartVertex: {
          polygonId: 'polygon-1',
          vertexIndex: 0,
        },
      }),
    );

    // Should clear temporary points
    expect(mockProps.setTempPoints).toHaveBeenCalledWith([]);
  });

  it('handles vertex click in add points mode to start adding points', () => {
    render(<CanvasV2 {...mockProps} editMode={EditMode.AddPoints} interactionState={{ isAddingPoints: false }} />);

    // In add points mode, all polygons' vertices should be rendered
    // Get all vertices
    const vertexElements = document.querySelectorAll('circle');

    // Should render 8 vertices (4 for each polygon)
    expect(vertexElements.length).toBe(8);

    // Simulate clicking on a vertex
    fireEvent.click(vertexElements[0]);

    // Should set selected polygon ID
    expect(mockProps.setSelectedPolygonId).toHaveBeenCalledWith('polygon-1');

    // Should update interaction state
    expect(mockProps.setInteractionState).toHaveBeenCalledWith(
      expect.objectContaining({
        isAddingPoints: true,
        addPointStartVertex: expect.any(Object),
      }),
    );

    // Should clear temporary points
    expect(mockProps.setTempPoints).toHaveBeenCalledWith([]);
  });

  it('handles vertex click in add points mode to complete adding points', () => {
    // Setup interaction state as if we're already adding points
    const interactionState = {
      isAddingPoints: true,
      addPointStartVertex: {
        polygonId: 'polygon-1',
        vertexIndex: 0,
      },
    };

    render(
      <CanvasV2
        {...mockProps}
        editMode={EditMode.AddPoints}
        interactionState={interactionState}
        selectedPolygonId="polygon-1"
      />,
    );

    // Get all vertices
    const vertexElements = document.querySelectorAll('circle');

    // Click on a different vertex to complete the sequence
    fireEvent.click(vertexElements[1]); // Second vertex of first polygon

    // Should call the original onMouseDown handler to process the completed sequence
    expect(mockProps.onMouseDown).toHaveBeenCalled();
  });

  it('handles wheel events correctly', () => {
    render(<CanvasV2 {...mockProps} />);

    // Get the SVG element
    const svgElement = document.querySelector('svg');
    expect(svgElement).toBeInTheDocument();

    // Simulate wheel event
    fireEvent.wheel(svgElement as SVGSVGElement, { deltaY: -100 });

    // Should call onWheel handler
    expect(mockProps.onWheel).toHaveBeenCalled();
  });

  it('calculates cursor position correctly', () => {
    // We need to mock the getBoundingClientRect method of the canvasRef
    if (mockProps.canvasRef.current) {
      mockProps.canvasRef.current.getBoundingClientRect = () => ({
        left: 50,
        top: 50,
        right: 850,
        bottom: 650,
        width: 800,
        height: 600,
        x: 50,
        y: 50,
        toJSON: () => {},
      });
    }

    // Use a transform to test coordinate calculations
    const transformedProps = {
      ...mockProps,
      transform: {
        zoom: 2,
        translateX: 100,
        translateY: 100,
      },
    };

    render(<CanvasV2 {...transformedProps} />);

    // Simulate mouse move to trigger cursor position calculation
    fireEvent.mouseMove(screen.getByRole('presentation'), {
      clientX: 250, // 250 - 50 (left) - 100 (translateX) = 100, then divided by zoom (2) = 50
      clientY: 250, // 250 - 50 (top) - 100 (translateY) = 100, then divided by zoom (2) = 50
    });

    // The cursor position is calculated internally and we can't directly test it
    // However, we can test that onMouseMove was called
    expect(mockProps.onMouseMove).toHaveBeenCalled();

    // For CreatePolygon mode, we can test the rendering of the cursor line
    // Reset mocks first
    vi.clearAllMocks();

    render(<CanvasV2 {...transformedProps} editMode={EditMode.CreatePolygon} tempPoints={[{ x: 0, y: 0 }]} />);

    // Simulate mouse move
    fireEvent.mouseMove(screen.getByRole('presentation'), {
      clientX: 250,
      clientY: 250,
    });

    // A line should be rendered from the temp point to the cursor position
    const lines = document.querySelectorAll('line');
    expect(lines.length).toBeGreaterThan(0);
  });

  it('renders different states in slice mode based on selection and temp points', () => {
    // Test slice mode with no selection
    const { rerender } = render(
      <CanvasV2 {...mockProps} editMode={EditMode.Slice} selectedPolygonId={null} tempPoints={[]} />,
    );

    // Should show instruction to select a polygon
    expect(screen.getByText('1. Click on a polygon to select it for slicing')).toBeInTheDocument();

    // Test slice mode with selection but no start point
    rerender(<CanvasV2 {...mockProps} editMode={EditMode.Slice} selectedPolygonId="polygon-1" tempPoints={[]} />);

    // Should show instruction to set start point
    expect(screen.getByText('2. Click to set the start point of the slice')).toBeInTheDocument();

    // Test slice mode with start point set
    rerender(
      <CanvasV2
        {...mockProps}
        editMode={EditMode.Slice}
        selectedPolygonId="polygon-1"
        tempPoints={[{ x: 100, y: 100 }]}
      />,
    );

    // Should show instruction to complete the slice
    expect(screen.getByText('3. Click to set the end point and complete the slice')).toBeInTheDocument();
  });

  it('renders different states in create polygon mode based on temp points', () => {
    // Test create polygon mode with no points
    const { rerender } = render(<CanvasV2 {...mockProps} editMode={EditMode.CreatePolygon} tempPoints={[]} />);

    // Should show instruction to start creating
    expect(screen.getByText('1. Click to start creating a polygon')).toBeInTheDocument();

    // Test with 1-2 points (not enough to close)
    rerender(
      <CanvasV2
        {...mockProps}
        editMode={EditMode.CreatePolygon}
        tempPoints={[
          { x: 100, y: 100 },
          { x: 200, y: 100 },
        ]}
      />,
    );

    // Should show instruction to add more points
    expect(screen.getByText('2. Continue clicking to add more points (at least 3 needed)')).toBeInTheDocument();

    // Test with 3+ points (enough to close)
    rerender(
      <CanvasV2
        {...mockProps}
        editMode={EditMode.CreatePolygon}
        tempPoints={[
          { x: 100, y: 100 },
          { x: 200, y: 100 },
          { x: 200, y: 200 },
        ]}
      />,
    );

    // Should show instruction about closing the polygon
    expect(
      screen.getByText('3. Continue adding points or click near the first point to close the polygon'),
    ).toBeInTheDocument();
  });

  it('applies custom transform to all rendered elements', () => {
    const customTransform = {
      zoom: 2,
      translateX: 100,
      translateY: 50,
    };

    render(<CanvasV2 {...mockProps} transform={customTransform} />);

    // The transform should be applied to the g element
    const gElement = document.querySelector('g');
    expect(gElement).toHaveAttribute('transform', 'translate(100 50) scale(2)');
  });

  it('adjusts vertex radius based on zoom level', () => {
    // With higher zoom, vertices should appear smaller
    const highZoomProps = {
      ...mockProps,
      transform: {
        zoom: 2,
        translateX: 0,
        translateY: 0,
      },
      editMode: EditMode.EditVertices,
      selectedPolygonId: 'polygon-1',
    };

    // With lower zoom, vertices should appear larger
    const lowZoomProps = {
      ...mockProps,
      transform: {
        zoom: 0.5,
        translateX: 0,
        translateY: 0,
      },
      editMode: EditMode.EditVertices,
      selectedPolygonId: 'polygon-1',
    };

    // Render with high zoom
    const { rerender } = render(<CanvasV2 {...highZoomProps} />);

    // Get all vertices
    let vertices = document.querySelectorAll('circle');

    // With zoom=2, radius should be 5/2 = 2.5
    expect(parseFloat(vertices[0].getAttribute('r') || '0')).toBeCloseTo(2.5, 1);

    // Rerender with low zoom
    rerender(<CanvasV2 {...lowZoomProps} />);

    // Get all vertices again
    vertices = document.querySelectorAll('circle');

    // With zoom=0.5, radius should be 5/0.5 = 10
    expect(parseFloat(vertices[0].getAttribute('r') || '0')).toBeCloseTo(10, 1);
  });

  it('correctly formats polygon points', () => {
    render(<CanvasV2 {...mockProps} />);

    // The formatPoints function is internal, but we can test its output by checking the polygon attributes
    const polygonElements = document.querySelectorAll('polygon');

    // First polygon should have properly formatted points
    expect(polygonElements[0]).toHaveAttribute('points', '100,100 200,100 200,200 100,200');
  });

  it('applies different styles to selected vs non-selected polygons', () => {
    // Render with a selected polygon
    render(<CanvasV2 {...mockProps} selectedPolygonId="polygon-1" />);

    // Get all polygons
    const polygonElements = document.querySelectorAll('polygon');

    // We can't directly check computed styles with JSDOM, but we can verify that:
    // 1. There are two distinct style attributes
    const firstStyle = polygonElements[0].getAttribute('style');
    const secondStyle = polygonElements[1].getAttribute('style');

    // The styles should be different since one is selected and the other isn't
    expect(firstStyle).not.toBe(secondStyle);
  });
});
