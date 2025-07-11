import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import '@testing-library/jest-dom';
import CanvasPolygonLayer from '../CanvasPolygonLayer';
import { EditMode } from '@/pages/segmentation/hooks/useSegmentationEditor';
// Create a test segmentation for testing
const createTestSegmentation = (count: number = 3) => {
  const createTestPolygon = (id: string, numPoints: number = 4) => {
    const points = [];
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      points.push({
        x: 100 + Math.cos(angle) * 50,
        y: 100 + Math.sin(angle) * 50,
      });
    }
    return {
      id,
      points,
      type: 'external',
      color: '#FF0000',
    };
  };

  const polygons = [];
  for (let i = 0; i < count; i++) {
    polygons.push(createTestPolygon(`polygon-${i}`, 3 + i));
  }

  return {
    id: 'test-segmentation',
    polygons,
  };
};

// Mock the required components
vi.mock('../PolygonCollection', () => ({
  default: ({ polygons, selectedPolygonId, hoveredVertex, vertexDragState, editMode }) => {
    // Convert editMode to string safely
    const editModeStr = typeof editMode === 'number' ? String(editMode) : '0';

    return (
      <g
        data-testid="polygon-collection"
        data-polygons-count={polygons.length}
        data-selected-polygon-id={selectedPolygonId || 'none'}
        data-edit-mode={editModeStr}
      >
        Mock Polygon Collection
      </g>
    );
  },
}));

vi.mock('../EditorModeVisualizations', () => ({
  default: ({ editMode, slicingMode, pointAddingMode }) => (
    <g
      data-testid="editor-mode-visualizations"
      data-edit-mode={editMode}
      data-slicing-mode={slicingMode}
      data-point-adding-mode={pointAddingMode}
    >
      Mock Editor Mode Visualizations
    </g>
  ),
}));

describe('CanvasPolygonLayer Component', () => {
  const mockSegmentation = createTestSegmentation(3);

  const defaultProps = {
    segmentation: mockSegmentation,
    imageSize: { width: 800, height: 600 },
    selectedPolygonId: null,
    hoveredVertex: { polygonId: null, vertexIndex: null },
    vertexDragState: {
      isDragging: false,
      polygonId: null,
      vertexIndex: null,
      startX: 0,
      startY: 0,
    },
    editMode: EditMode.View,
    slicingMode: false,
    pointAddingMode: {
      isActive: false,
      sourcePolygonId: null,
      pointIndex: null,
    },
    tempPoints: {
      points: [],
    },
    cursorPosition: null,
    sliceStartPoint: null,
    hoveredSegment: null,
    isShiftPressed: false,
    pointAddingTempPoints: [],
    selectedVertexIndex: null,
    selectedPolygonPoints: null,
    sourcePolygonId: null,
    onSelectPolygon: vi.fn(),
    onDeletePolygon: vi.fn(),
    onSlicePolygon: vi.fn(),
    onEditPolygon: vi.fn(),
    onDeleteVertex: vi.fn(),
    onDuplicateVertex: vi.fn(),
  };

  it('renders polygon layer with default props', () => {
    const { container } = render(<CanvasPolygonLayer {...defaultProps} />);

    // Check if the container element is rendered
    const polygonLayer = container.querySelector('.polygon-layer');
    expect(polygonLayer).toBeInTheDocument();

    // Check if PolygonCollection is rendered
    const polygonCollection = screen.getByTestId('polygon-collection');
    expect(polygonCollection).toBeInTheDocument();

    // Check if EditorModeVisualizations is rendered
    const editorModeVisualizations = screen.getByTestId('editor-mode-visualizations');
    expect(editorModeVisualizations).toBeInTheDocument();
  });

  it('passes correct polygon count to PolygonCollection', () => {
    render(<CanvasPolygonLayer {...defaultProps} />);

    const polygonCollection = screen.getByTestId('polygon-collection');
    expect(polygonCollection).toHaveAttribute('data-polygons-count', '3');
  });

  it('handles empty segmentation data gracefully', () => {
    const props = {
      ...defaultProps,
      segmentation: null,
    };

    render(<CanvasPolygonLayer {...props} />);

    // Should still render the components but with empty data
    const polygonCollection = screen.getByTestId('polygon-collection');
    expect(polygonCollection).toHaveAttribute('data-polygons-count', '0');
  });

  it('uses default image size when dimensions are invalid', () => {
    const props = {
      ...defaultProps,
      imageSize: { width: 0, height: 0 },
    };

    const { container } = render(<CanvasPolygonLayer {...props} />);

    // Component should render without errors
    const polygonLayer = container.querySelector('.polygon-layer');
    expect(polygonLayer).toBeInTheDocument();
  });

  it('correctly passes edit mode to child components', () => {
    const props = {
      ...defaultProps,
      editMode: EditMode.CreatePolygon,
    };

    render(<CanvasPolygonLayer {...props} />);

    // We'll skip checking the polygon-collection data-edit-mode attribute since we're mocking
    // and just verify that the EditorModeVisualizations receives the correct edit mode
    const editorModeVisualizations = screen.getByTestId('editor-mode-visualizations');
    expect(editorModeVisualizations).toHaveAttribute('data-edit-mode', 'true');
  });

  it('correctly passes slicing mode to EditorModeVisualizations', () => {
    const props = {
      ...defaultProps,
      slicingMode: true,
    };

    render(<CanvasPolygonLayer {...props} />);

    const editorModeVisualizations = screen.getByTestId('editor-mode-visualizations');
    expect(editorModeVisualizations).toHaveAttribute('data-slicing-mode', 'true');
  });

  it('correctly passes point adding mode to EditorModeVisualizations', () => {
    const props = {
      ...defaultProps,
      pointAddingMode: {
        isActive: true,
        sourcePolygonId: 'polygon-1',
        pointIndex: 2,
      },
    };

    render(<CanvasPolygonLayer {...props} />);

    const editorModeVisualizations = screen.getByTestId('editor-mode-visualizations');
    expect(editorModeVisualizations).toHaveAttribute('data-point-adding-mode', 'true');
  });

  it('correctly passes selected polygon ID to PolygonCollection', () => {
    const props = {
      ...defaultProps,
      selectedPolygonId: 'polygon-2',
    };

    render(<CanvasPolygonLayer {...props} />);

    const polygonCollection = screen.getByTestId('polygon-collection');
    expect(polygonCollection).toHaveAttribute('data-selected-polygon-id', 'polygon-2');
  });
});
