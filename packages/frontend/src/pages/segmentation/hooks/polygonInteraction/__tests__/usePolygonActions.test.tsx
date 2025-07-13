import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePolygonActions } from '../usePolygonActions';
import { EditMode } from '../hooks/segmentation/types';

// Mock hooks used within usePolygonActions
vi.mock('../../useCanvasContext', () => ({
  useCanvasContext: () => ({
    editMode: EditMode.EDIT,
    scale: 1,
    panOffset: { x: 0, y: 0 },
    canvasSize: { width: 800, height: 600 },
  }),
}));

vi.mock('../../usePolygonWasm', () => ({
  usePolygonWasm: () => ({
    isPointInPolygon: vi.fn((polygon, point) => {
      // Simple mock implementation
      const xPoints = polygon.points.map((p) => p.x);
      const yPoints = polygon.points.map((p) => p.y);
      const minX = Math.min(...xPoints);
      const maxX = Math.max(...xPoints);
      const minY = Math.min(...yPoints);
      const maxY = Math.max(...yPoints);

      return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
    }),
    detectSelfIntersections: vi.fn(() => []),
    simplifyPolygon: vi.fn((polygon) => polygon),
    calculatePolygonArea: vi.fn(() => 10000),
    combinePolygons: vi.fn((poly1, poly2) => ({
      ...poly1,
      points: [...poly1.points, ...poly2.points],
    })),
    loading: false,
    error: null,
    wasmModule: {},
  }),
}));

describe('usePolygonActions', () => {
  const mockPolygons: Polygon[] = [
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
    {
      points: [
        { x: 300, y: 300 },
        { x: 400, y: 300 },
        { x: 350, y: 400 },
      ],
      closed: true,
      color: '#00FF00',
    },
  ];

  const mockHandlePolygonsChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with correct state', () => {
    const { result } = renderHook(() => usePolygonActions(mockPolygons, -1, mockHandlePolygonsChange));

    expect(result.current.hoveredPolygonIndex).toBe(-1);
    expect(result.current.hoveredVertexInfo).toBeNull();
    expect(result.current.isDragging).toBe(false);
    expect(result.current.temporaryPoints).toEqual([]);
  });

  it('selects a polygon when clicked', () => {
    const mockOnPolygonSelect = vi.fn();

    const { result } = renderHook(() =>
      usePolygonActions(mockPolygons, -1, mockHandlePolygonsChange, mockOnPolygonSelect),
    );

    // Simulate clicking on the first polygon
    act(() => {
      result.current.handleCanvasClick({ x: 150, y: 150 });
    });

    // Should select polygon at index 0
    expect(mockOnPolygonSelect).toHaveBeenCalledWith(0);
  });

  it('creates a new polygon in CREATE mode', () => {
    // Override the editMode in the useCanvasContext mock
    vi.mocked(useCanvasContext).mockReturnValue({
      editMode: EditMode.CREATE,
      scale: 1,
      panOffset: { x: 0, y: 0 },
      canvasSize: { width: 800, height: 600 },
    });

    const { result } = renderHook(() => usePolygonActions(mockPolygons, -1, mockHandlePolygonsChange));

    // Start creating a new polygon by adding points
    act(() => {
      result.current.handleCanvasClick({ x: 500, y: 100 });
    });

    // Should have one temporary point
    expect(result.current.temporaryPoints).toHaveLength(1);
    expect(result.current.temporaryPoints[0]).toEqual({ x: 500, y: 100 });

    // Add more points
    act(() => {
      result.current.handleCanvasClick({ x: 600, y: 100 });
      result.current.handleCanvasClick({ x: 600, y: 200 });
    });

    // Should have three temporary points
    expect(result.current.temporaryPoints).toHaveLength(3);

    // Close the polygon by clicking near the first point
    act(() => {
      result.current.handleCanvasClick({ x: 500, y: 100 });
    });

    // Should create a new polygon and reset temporary points
    expect(mockHandlePolygonsChange).toHaveBeenCalled();
    expect(result.current.temporaryPoints).toHaveLength(0);
  });

  it('moves a polygon vertex in EDIT mode', () => {
    const selectedPolygonIndex = 0;

    const { result } = renderHook(() =>
      usePolygonActions(mockPolygons, selectedPolygonIndex, mockHandlePolygonsChange),
    );

    // Simulate clicking on a vertex
    act(() => {
      result.current.handleVertexMouseDown(0, 0, {
        preventDefault: vi.fn(),
      } as unknown as React.MouseEvent);
    });

    // Should start dragging
    expect(result.current.isDragging).toBe(true);

    // Simulate moving the mouse
    act(() => {
      result.current.handleCanvasMouseMove({ x: 150, y: 150 });
    });

    // Simulate releasing the mouse
    act(() => {
      result.current.handleCanvasMouseUp();
    });

    // Should update the polygon and stop dragging
    expect(mockHandlePolygonsChange).toHaveBeenCalled();
    expect(result.current.isDragging).toBe(false);
  });

  it('adds a vertex to a polygon', () => {
    const selectedPolygonIndex = 0;

    const { result } = renderHook(() =>
      usePolygonActions(mockPolygons, selectedPolygonIndex, mockHandlePolygonsChange),
    );

    // Add a vertex between existing ones
    act(() => {
      result.current.handleAddVertex(0);
    });

    // Should call handlePolygonsChange with updated polygons
    expect(mockHandlePolygonsChange).toHaveBeenCalled();
  });

  it('deletes a vertex from a polygon', () => {
    const selectedPolygonIndex = 0;

    const { result } = renderHook(() =>
      usePolygonActions(mockPolygons, selectedPolygonIndex, mockHandlePolygonsChange),
    );

    // Delete a vertex
    act(() => {
      result.current.handleDeleteVertex(1);
    });

    // Should call handlePolygonsChange with updated polygons
    expect(mockHandlePolygonsChange).toHaveBeenCalled();
  });

  it('deletes a polygon', () => {
    const selectedPolygonIndex = 1;

    const { result } = renderHook(() =>
      usePolygonActions(mockPolygons, selectedPolygonIndex, mockHandlePolygonsChange),
    );

    // Delete the selected polygon
    act(() => {
      result.current.handleDeletePolygon();
    });

    // Should call handlePolygonsChange with polygon removed
    expect(mockHandlePolygonsChange).toHaveBeenCalled();
    const updatedPolygons = mockHandlePolygonsChange.mock.calls[0][0];
    expect(updatedPolygons).toHaveLength(mockPolygons.length - 1);
  });

  it('duplicates a polygon', () => {
    const selectedPolygonIndex = 0;

    const { result } = renderHook(() =>
      usePolygonActions(mockPolygons, selectedPolygonIndex, mockHandlePolygonsChange),
    );

    // Duplicate the selected polygon
    act(() => {
      result.current.handleDuplicatePolygon();
    });

    // Should call handlePolygonsChange with duplicated polygon
    expect(mockHandlePolygonsChange).toHaveBeenCalled();
    const updatedPolygons = mockHandlePolygonsChange.mock.calls[0][0];
    expect(updatedPolygons).toHaveLength(mockPolygons.length + 1);
  });

  it('changes polygon color', () => {
    const selectedPolygonIndex = 0;
    const newColor = '#0000FF';

    const { result } = renderHook(() =>
      usePolygonActions(mockPolygons, selectedPolygonIndex, mockHandlePolygonsChange),
    );

    // Change polygon color
    act(() => {
      result.current.handlePolygonColorChange(newColor);
    });

    // Should call handlePolygonsChange with updated color
    expect(mockHandlePolygonsChange).toHaveBeenCalled();
    const updatedPolygons = mockHandlePolygonsChange.mock.calls[0][0];
    expect(updatedPolygons[selectedPolygonIndex].color).toBe(newColor);
  });

  it('changes polygon visibility', () => {
    const selectedPolygonIndex = 0;

    // Create mock polygons with visibility flag
    const polygonsWithVisibility = mockPolygons.map((p) => ({
      ...p,
      visible: true,
    }));

    const { result } = renderHook(() =>
      usePolygonActions(polygonsWithVisibility, selectedPolygonIndex, mockHandlePolygonsChange),
    );

    // Toggle visibility
    act(() => {
      result.current.handlePolygonVisibilityChange(false);
    });

    // Should call handlePolygonsChange with updated visibility
    expect(mockHandlePolygonsChange).toHaveBeenCalled();
    const updatedPolygons = mockHandlePolygonsChange.mock.calls[0][0];
    expect(updatedPolygons[selectedPolygonIndex].visible).toBe(false);
  });

  it('clears temporary points when escaping create mode', () => {
    // Set up in CREATE mode with temporary points
    vi.mocked(useCanvasContext).mockReturnValue({
      editMode: EditMode.CREATE,
      scale: 1,
      panOffset: { x: 0, y: 0 },
      canvasSize: { width: 800, height: 600 },
    });

    const { result } = renderHook(() => usePolygonActions(mockPolygons, -1, mockHandlePolygonsChange));

    // Add some temporary points
    act(() => {
      result.current.handleCanvasClick({ x: 500, y: 100 });
      result.current.handleCanvasClick({ x: 600, y: 100 });
    });

    // Should have temporary points
    expect(result.current.temporaryPoints).toHaveLength(2);

    // Escape creating polygon
    act(() => {
      result.current.handleEscapeKey();
    });

    // Should clear temporary points
    expect(result.current.temporaryPoints).toHaveLength(0);
  });

  it('handles split polygon operation', () => {
    const selectedPolygonIndex = 0;

    const { result } = renderHook(() =>
      usePolygonActions(mockPolygons, selectedPolygonIndex, mockHandlePolygonsChange),
    );

    // Split polygon at vertex 0
    act(() => {
      result.current.handleSplitPolygon(0);
    });

    // Should call handlePolygonsChange
    expect(mockHandlePolygonsChange).toHaveBeenCalled();
  });

  it('handles mouse hover over polygons', () => {
    const { result } = renderHook(() => usePolygonActions(mockPolygons, -1, mockHandlePolygonsChange));

    // Move mouse over first polygon
    act(() => {
      result.current.handleCanvasMouseMove({ x: 150, y: 150 });
    });

    // Should set hoveredPolygonIndex
    expect(result.current.hoveredPolygonIndex).toBe(0);

    // Move mouse out of any polygon
    act(() => {
      result.current.handleCanvasMouseMove({ x: 250, y: 250 });
    });

    // Should reset hoveredPolygonIndex
    expect(result.current.hoveredPolygonIndex).toBe(-1);
  });

  it('handles mouse hover over vertices', () => {
    const selectedPolygonIndex = 0;

    const { result } = renderHook(() =>
      usePolygonActions(mockPolygons, selectedPolygonIndex, mockHandlePolygonsChange),
    );

    // Move mouse over a vertex
    act(() => {
      // Simulate hovering near first vertex
      result.current.handleVertexHover(0, true);
    });

    // Should set hoveredVertexInfo
    expect(result.current.hoveredVertexInfo).toEqual({
      polygonIndex: selectedPolygonIndex,
      vertexIndex: 0,
    });

    // Move mouse away from vertex
    act(() => {
      result.current.handleVertexHover(0, false);
    });

    // Should reset hoveredVertexInfo
    expect(result.current.hoveredVertexInfo).toBeNull();
  });
});
