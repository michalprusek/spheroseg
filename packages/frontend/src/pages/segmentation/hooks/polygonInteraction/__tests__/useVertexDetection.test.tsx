import { renderHook } from '@testing-library/react-hooks';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useVertexDetection } from '../useVertexDetection';
import { screenToImageCoordinates, imageToScreenCoordinates } from '../coordinateUtils';

// Mock the coordinate utilities
vi.mock('../coordinateUtils', () => ({
  screenToImageCoordinates: vi.fn(),
  imageToScreenCoordinates: vi.fn()
}));

describe('useVertexDetection Hook', () => {
  let zoom: number;
  let offset: { x: number; y: number };
  
  beforeEach(() => {
    zoom = 1;
    offset = { x: 0, y: 0 };
    vi.clearAllMocks();
    
    // Setup default mock implementations for coordinate transforms
    (screenToImageCoordinates as ReturnType<typeof vi.fn>).mockImplementation(
      (screenPoint, zoom, offset) => ({
        x: (screenPoint.x - offset.x) / zoom,
        y: (screenPoint.y - offset.y) / zoom,
      })
    );
    
    (imageToScreenCoordinates as ReturnType<typeof vi.fn>).mockImplementation(
      (imagePoint, zoom, offset) => ({
        x: imagePoint.x * zoom + offset.x,
        y: imagePoint.y * zoom + offset.y,
      })
    );
  });
  
  it('should detect a point near a vertex with default detection radius', () => {
    const { result } = renderHook(() => useVertexDetection(zoom, offset));
    
    // Point at exact location should be detected
    expect(result.current.isNearVertex(100, 100, { x: 100, y: 100 })).toBe(true);
    
    // Point within detection radius should be detected
    expect(result.current.isNearVertex(105, 105, { x: 100, y: 100 })).toBe(true);
    
    // Point outside detection radius should not be detected
    expect(result.current.isNearVertex(120, 120, { x: 100, y: 100 })).toBe(false);
    
    // Check coordinate transformations were called correctly
    expect(screenToImageCoordinates).toHaveBeenCalledWith({ x: 100, y: 100 }, 1, { x: 0, y: 0 });
    expect(imageToScreenCoordinates).toHaveBeenCalledWith({ x: 100, y: 100 }, 1, { x: 0, y: 0 });
  });
  
  it('should detect a point near a vertex with custom detection radius', () => {
    const { result } = renderHook(() => useVertexDetection(zoom, offset));
    
    // Test with custom larger detection radius (20px)
    expect(result.current.isNearVertex(115, 115, { x: 100, y: 100 }, 20)).toBe(true);
    expect(result.current.isNearVertex(125, 125, { x: 100, y: 100 }, 20)).toBe(false);
  });
  
  it('should adjust detection radius based on zoom', () => {
    // Test with zoom > 4 (extreme zoom in)
    zoom = 5;
    const { result: highZoomResult } = renderHook(() => useVertexDetection(zoom, offset));
    
    // Since zoom is high, the detection radius is smaller in screen space
    // adjustedRadius = (10 * 2) / 5 = 4
    expect(highZoomResult.current.isNearVertex(103, 103, { x: 100, y: 100 })).toBe(true);
    expect(highZoomResult.current.isNearVertex(106, 106, { x: 100, y: 100 })).toBe(false);
    
    // Test with zoom > 3 but < 4 (high zoom in)
    zoom = 3.5;
    const { result: mediumHighZoomResult } = renderHook(() => useVertexDetection(zoom, offset));
    
    // adjustedRadius = (10 * 1.5) / 3.5 ≈ 4.3
    expect(mediumHighZoomResult.current.isNearVertex(104, 104, { x: 100, y: 100 })).toBe(true);
    expect(mediumHighZoomResult.current.isNearVertex(107, 107, { x: 100, y: 100 })).toBe(false);
    
    // Test with zoom < 0.5 (extreme zoom out)
    zoom = 0.3;
    const { result: lowZoomResult } = renderHook(() => useVertexDetection(zoom, offset));
    
    // adjustedRadius = (10 * 0.6) / 0.3 = 20
    expect(lowZoomResult.current.isNearVertex(115, 115, { x: 100, y: 100 })).toBe(true);
    expect(lowZoomResult.current.isNearVertex(125, 125, { x: 100, y: 100 })).toBe(false);
    
    // Test with zoom < 0.7 but > 0.5 (moderate zoom out)
    zoom = 0.6;
    const { result: moderateZoomResult } = renderHook(() => useVertexDetection(zoom, offset));
    
    // adjustedRadius = (10 * 0.8) / 0.6 ≈ 13.3
    expect(moderateZoomResult.current.isNearVertex(110, 110, { x: 100, y: 100 })).toBe(true);
    expect(moderateZoomResult.current.isNearVertex(120, 120, { x: 100, y: 100 })).toBe(false);
    
    // Test with normal zoom (0.7 <= zoom <= 4)
    zoom = 1;
    const { result: normalZoomResult } = renderHook(() => useVertexDetection(zoom, offset));
    
    // adjustedRadius = 10 / 1 = 10
    expect(normalZoomResult.current.isNearVertex(105, 105, { x: 100, y: 100 })).toBe(true);
    expect(normalZoomResult.current.isNearVertex(115, 115, { x: 100, y: 100 })).toBe(false);
  });
  
  it('should handle offset correctly', () => {
    offset = { x: 50, y: 50 };
    const { result } = renderHook(() => useVertexDetection(zoom, offset));
    
    // With offset, the screen coordinate 150,150 should be near image coordinate 100,100
    expect(result.current.isNearVertex(150, 150, { x: 100, y: 100 })).toBe(true);
    expect(result.current.isNearVertex(165, 165, { x: 100, y: 100 })).toBe(false);
    
    // Verify coordinate transformations were called with correct offset
    expect(screenToImageCoordinates).toHaveBeenCalledWith({ x: 150, y: 150 }, 1, { x: 50, y: 50 });
    expect(imageToScreenCoordinates).toHaveBeenCalledWith({ x: 100, y: 100 }, 1, { x: 50, y: 50 });
  });
  
  it('should handle zoom and offset together correctly', () => {
    zoom = 2;
    offset = { x: 50, y: 50 };
    const { result } = renderHook(() => useVertexDetection(zoom, offset));
    
    // Image point (100,100) would be at screen (250,250) with zoom=2 and offset=(50,50)
    // Detection radius would be 10/2 = 5px in screen space
    expect(result.current.isNearVertex(250, 250, { x: 100, y: 100 })).toBe(true);
    expect(result.current.isNearVertex(252, 252, { x: 100, y: 100 })).toBe(true); // Within 5px
    expect(result.current.isNearVertex(260, 260, { x: 100, y: 100 })).toBe(false); // Outside 5px
  });

  it('should handle edge cases with validation', () => {
    const { result } = renderHook(() => useVertexDetection(zoom, offset));
    
    // Test with negative coordinates
    expect(result.current.isNearVertex(-5, -5, { x: -10, y: -10 })).toBe(true);
    expect(result.current.isNearVertex(-25, -25, { x: -10, y: -10 })).toBe(false);
    
    // Test with zero zoom (should not cause division by zero)
    zoom = 0;
    const { result: zeroZoomResult } = renderHook(() => useVertexDetection(zoom, offset));
    
    // This would normally cause division by zero, but our implementation should handle it
    expect(() => zeroZoomResult.current.isNearVertex(100, 100, { x: 100, y: 100 })).not.toThrow();
  });
});