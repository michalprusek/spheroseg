import { renderHook } from '@testing-library/react';
import { useSlicing } from '../useSlicing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { toast } from 'sonner';
import { EditMode } from '../segmentation';

// Mock dependencies
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: { [key: string]: string } = {
        'segmentation.polygonNotFound': 'Polygon not found',
        'segmentation.polygonSliced': 'Polygon sliced successfully',
        'segmentation.sliceFailed': 'Failed to slice polygon',
      };
      return translations[key] || key;
    },
  }),
}));

// Mock slicePolygon utility
vi.mock('../utils/slicePolygon', () => ({
  slicePolygon: vi.fn(),
}));

import { slicePolygon } from '../utils/slicePolygon';

describe('useSlicing hook', () => {
  // Reset mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Common test data
  const mockPolygon = {
    id: 'test-polygon-1',
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ],
    color: '#FF0000',
    label: 'Test Polygon',
  };

  const mockSegmentationData = {
    polygons: [mockPolygon],
  };

  // Create mock props
  const createMockProps = () => ({
    segmentationData: mockSegmentationData,
    setSegmentationData: vi.fn(),
    selectedPolygonId: mockPolygon.id,
    setSelectedPolygonId: vi.fn(),
    tempPoints: [
      { x: 0, y: 5 },
      { x: 10, y: 5 },
    ],
    setTempPoints: vi.fn(),
    setInteractionState: vi.fn(),
    setEditMode: vi.fn(),
  });

  it('should return false when required data is missing', () => {
    // Create props with missing data
    const props = createMockProps();
    props.tempPoints = []; // Empty temp points

    const { result } = renderHook(() => useSlicing(props));

    const success = result.current.handleSliceAction();

    expect(success).toBe(false);
  });

  it('should return false when polygon is not found', () => {
    // Create props with non-existent polygon ID
    const props = createMockProps();
    props.selectedPolygonId = 'non-existent-id';

    const { result } = renderHook(() => useSlicing(props));

    const success = result.current.handleSliceAction();

    expect(success).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Polygon not found');
  });

  it('should handle slice failure correctly', () => {
    // Mock the slicePolygon utility to return null (slice failure)
    vi.mocked(slicePolygon).mockReturnValueOnce(null);

    const props = createMockProps();

    const { result } = renderHook(() => useSlicing(props));

    const success = result.current.handleSliceAction();

    expect(success).toBe(false);
    expect(slicePolygon).toHaveBeenCalledWith(mockPolygon, props.tempPoints[0], props.tempPoints[1]);
    expect(toast.error).toHaveBeenCalledWith('Failed to slice polygon');
    expect(props.setTempPoints).toHaveBeenCalledWith([]);
    expect(props.setInteractionState).toHaveBeenCalled();
  });

  it('should slice polygon successfully', () => {
    // Mock the slicePolygon utility to return two new polygons
    const newPolygon1 = {
      id: 'new-polygon-1',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 5 },
        { x: 0, y: 5 },
      ],
      color: '#FF0000',
      label: 'Test Polygon Part 1',
    };

    const newPolygon2 = {
      id: 'new-polygon-2',
      points: [
        { x: 0, y: 5 },
        { x: 10, y: 5 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
      color: '#FF0000',
      label: 'Test Polygon Part 2',
    };

    vi.mocked(slicePolygon).mockReturnValueOnce([newPolygon1, newPolygon2]);

    const props = createMockProps();

    const { result } = renderHook(() => useSlicing(props));

    const success = result.current.handleSliceAction();

    expect(success).toBe(true);
    expect(slicePolygon).toHaveBeenCalledWith(mockPolygon, props.tempPoints[0], props.tempPoints[1]);

    // Should update segmentation data with the two new polygons
    expect(props.setSegmentationData).toHaveBeenCalledWith(
      {
        polygons: [newPolygon1, newPolygon2],
      },
      false,
    );

    // Should clear selection
    expect(props.setSelectedPolygonId).toHaveBeenCalledWith(null);

    // Should show success message
    expect(toast.success).toHaveBeenCalledWith('Polygon sliced successfully');

    // Should clear temporary points
    expect(props.setTempPoints).toHaveBeenCalledWith([]);

    // Should reset interaction state
    expect(props.setInteractionState).toHaveBeenCalled();

    // Should reset edit mode
    expect(props.setEditMode).toHaveBeenCalledWith(EditMode.View);
  });

  it('should work correctly without setEditMode provided', () => {
    // Mock the slicePolygon utility to return two new polygons
    const newPolygon1 = {
      id: 'new-polygon-1',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 5 },
        { x: 0, y: 5 },
      ],
      color: '#FF0000',
      label: 'Test Polygon Part 1',
    };

    const newPolygon2 = {
      id: 'new-polygon-2',
      points: [
        { x: 0, y: 5 },
        { x: 10, y: 5 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
      color: '#FF0000',
      label: 'Test Polygon Part 2',
    };

    vi.mocked(slicePolygon).mockReturnValueOnce([newPolygon1, newPolygon2]);

    // Create props without setEditMode
    const props = createMockProps();
    delete props.setEditMode;

    const { result } = renderHook(() => useSlicing(props));

    const success = result.current.handleSliceAction();

    expect(success).toBe(true);

    // All other expectations remain the same except for setEditMode
    expect(props.setSegmentationData).toHaveBeenCalled();
    expect(props.setSelectedPolygonId).toHaveBeenCalledWith(null);
    expect(toast.success).toHaveBeenCalledWith('Polygon sliced successfully');
    expect(props.setTempPoints).toHaveBeenCalledWith([]);
    expect(props.setInteractionState).toHaveBeenCalled();
  });
});
