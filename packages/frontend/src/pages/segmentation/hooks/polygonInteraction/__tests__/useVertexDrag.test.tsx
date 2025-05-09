import { renderHook, act } from '@testing-library/react';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import { useVertexDrag } from '../useVertexDrag';
// Create a test segmentation for testing
const createTestSegmentation = (count: number = 3) => {
  const createTestPolygon = (id: string, numPoints: number = 4) => {
    const points = [];
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      points.push({
        x: 100 + Math.cos(angle) * 50,
        y: 100 + Math.sin(angle) * 50
      });
    }
    return {
      id,
      points,
      type: 'external',
      color: '#FF0000'
    };
  };

  const polygons = [];
  for (let i = 0; i < count; i++) {
    polygons.push(createTestPolygon(`polygon-${i}`, 3 + i));
  }

  return {
    id: 'test-segmentation',
    polygons
  };
};


// Mock dependencies
vi.mock('../useVertexDetection', () => ({
  useVertexDetection: () => ({
    isNearVertex: vi.fn().mockImplementation((canvasX, canvasY, point, threshold) => {
      // For testing, simulate a vertex being near if canvasX and canvasY are both 50
      return canvasX === 50 && canvasY === 50;
    })
  })
}));

vi.mock('../useCoordinateTransform', () => ({
  useCoordinateTransform: () => ({
    getImageCoordinates: vi.fn().mockImplementation((screenX, screenY) => ({
      imageX: screenX / 2,
      imageY: screenY / 2
    }))
  })
}));

describe('useVertexDrag Hook', () => {
  const mockSegmentation = createTestSegmentation(1);
  const mockSetSegmentation = vi.fn();
  const mockSetSelectedPolygonId = vi.fn();
  const mockVertexDragState = { current: { isDragging: false, polygonId: null, vertexIndex: null } };
  const mockContainerElement = {
    getBoundingClientRect: vi.fn().mockReturnValue({ left: 0, top: 0 }),
    style: { cursor: '' }
  } as unknown as HTMLElement;
  
  beforeEach(() => {
    vi.clearAllMocks();
    mockVertexDragState.current = { isDragging: false, polygonId: null, vertexIndex: null };
    mockContainerElement.style.cursor = '';
  });
  
  it('should initialize with correct return values', () => {
    const { result } = renderHook(() => 
      useVertexDrag(
        1, 
        { x: 0, y: 0 }, 
        mockSegmentation, 
        mockSetSegmentation, 
        mockSetSelectedPolygonId, 
        mockVertexDragState
      )
    );
    
    expect(result.current).toHaveProperty('handleVertexDrag');
    expect(result.current).toHaveProperty('handleVertexClick');
    expect(result.current).toHaveProperty('initialVertexPosition');
    expect(typeof result.current.handleVertexDrag).toBe('function');
    expect(typeof result.current.handleVertexClick).toBe('function');
    expect(result.current.initialVertexPosition.current).toBe(null);
  });
  
  it('should detect vertex click and update drag state', () => {
    const { result } = renderHook(() => 
      useVertexDrag(
        1, 
        { x: 0, y: 0 }, 
        mockSegmentation, 
        mockSetSegmentation, 
        mockSetSelectedPolygonId, 
        mockVertexDragState
      )
    );
    
    // Call handleVertexClick with coordinates that will trigger isNearVertex to return true
    const wasHandled = result.current.handleVertexClick(50, 50, mockContainerElement);
    
    expect(wasHandled).toBe(true);
    expect(mockSetSelectedPolygonId).toHaveBeenCalledWith(mockSegmentation.polygons[0].id);
    expect(mockVertexDragState.current.isDragging).toBe(true);
    expect(mockVertexDragState.current.polygonId).toBe(mockSegmentation.polygons[0].id);
    expect(mockContainerElement.style.cursor).toBe('grabbing');
  });
  
  it('should not detect vertex click with wrong coordinates', () => {
    const { result } = renderHook(() => 
      useVertexDrag(
        1, 
        { x: 0, y: 0 }, 
        mockSegmentation, 
        mockSetSegmentation, 
        mockSetSelectedPolygonId, 
        mockVertexDragState
      )
    );
    
    // Call handleVertexClick with coordinates that will NOT trigger isNearVertex
    const wasHandled = result.current.handleVertexClick(100, 100, mockContainerElement);
    
    expect(wasHandled).toBe(false);
    expect(mockSetSelectedPolygonId).not.toHaveBeenCalled();
    expect(mockVertexDragState.current.isDragging).toBe(false);
    expect(mockVertexDragState.current.polygonId).toBe(null);
  });
  
  it('should handle vertex drag and update segmentation', () => {
    const { result } = renderHook(() => 
      useVertexDrag(
        1, 
        { x: 0, y: 0 }, 
        mockSegmentation, 
        mockSetSegmentation, 
        mockSetSelectedPolygonId, 
        mockVertexDragState
      )
    );
    
    // Setup drag state
    mockVertexDragState.current = {
      isDragging: true,
      polygonId: mockSegmentation.polygons[0].id,
      vertexIndex: 0
    };
    
    // Mock mouse event
    const mockEvent = {
      clientX: 100,
      clientY: 100
    } as React.MouseEvent;
    
    // Call handleVertexDrag
    const wasHandled = result.current.handleVertexDrag(mockEvent, mockContainerElement);
    
    expect(wasHandled).toBe(true);
    expect(mockSetSegmentation).toHaveBeenCalled();
    
    // Check that the first argument to mockSetSegmentation has updated the polygon points
    const updatedSegmentation = mockSetSegmentation.mock.calls[0][0];
    expect(updatedSegmentation).toBeDefined();
    expect(updatedSegmentation.polygons[0].points[0]).toEqual({ x: 100, y: 100 });
    expect(mockContainerElement.style.cursor).toBe('grabbing');
  });
  
  it('should not handle drag when not dragging', () => {
    const { result } = renderHook(() => 
      useVertexDrag(
        1, 
        { x: 0, y: 0 }, 
        mockSegmentation, 
        mockSetSegmentation, 
        mockSetSelectedPolygonId, 
        mockVertexDragState
      )
    );
    
    // Ensure drag state is not active
    mockVertexDragState.current = {
      isDragging: false,
      polygonId: null,
      vertexIndex: null
    };
    
    // Mock mouse event
    const mockEvent = {
      clientX: 100,
      clientY: 100
    } as React.MouseEvent;
    
    // Call handleVertexDrag
    const wasHandled = result.current.handleVertexDrag(mockEvent, mockContainerElement);
    
    expect(wasHandled).toBe(false);
    expect(mockSetSegmentation).not.toHaveBeenCalled();
  });
  
  it('should handle null segmentation gracefully', () => {
    const { result } = renderHook(() => 
      useVertexDrag(
        1, 
        { x: 0, y: 0 }, 
        null, 
        mockSetSegmentation, 
        mockSetSelectedPolygonId, 
        mockVertexDragState
      )
    );
    
    // Call handleVertexClick
    const wasClickHandled = result.current.handleVertexClick(50, 50, mockContainerElement);
    expect(wasClickHandled).toBe(false);
    
    // Setup drag state
    mockVertexDragState.current = {
      isDragging: true,
      polygonId: 'polygon-1',
      vertexIndex: 0
    };
    
    // Mock mouse event
    const mockEvent = {
      clientX: 100,
      clientY: 100
    } as React.MouseEvent;
    
    // Call handleVertexDrag
    const wasDragHandled = result.current.handleVertexDrag(mockEvent, mockContainerElement);
    expect(wasDragHandled).toBe(false);
  });
});