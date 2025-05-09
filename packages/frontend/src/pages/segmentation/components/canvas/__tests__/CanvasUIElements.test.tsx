import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CanvasUIElements } from '../CanvasUIElements';
import { EditMode, Point } from '@spheroseg/types';

// Mock custom hooks
vi.mock('../../../hooks/useCanvasContext', () => ({
  useCanvasContext: () => ({
    editMode: EditMode.VIEW,
    scale: 1,
    panOffset: { x: 0, y: 0 },
    canvasSize: { width: 800, height: 600 },
    canvasBounds: { left: 0, top: 0, right: 800, bottom: 600 }
  })
}));

describe('CanvasUIElements', () => {
  const defaultProps = {
    polygons: [
      {
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 100 },
          { x: 200, y: 200 },
          { x: 100, y: 200 }
        ],
        closed: true,
        color: '#FF0000'
      },
      {
        points: [
          { x: 300, y: 300 },
          { x: 400, y: 300 },
          { x: 350, y: 400 }
        ],
        closed: true,
        color: '#00FF00'
      }
    ],
    selectedPolygonIndex: -1,
    hoveredPolygonIndex: -1,
    hoveredVertexInfo: null,
    temporaryPoints: [] as Point[],
    isCreatingPolygon: false,
    onPolygonClick: vi.fn(),
    onVertexClick: vi.fn(),
    onVertexDrag: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<CanvasUIElements {...defaultProps} />);
    // Basic assertion to ensure component renders
    expect(screen.getByTestId('canvas-ui-elements')).toBeInTheDocument();
  });

  it('renders polygons correctly', () => {
    render(<CanvasUIElements {...defaultProps} />);
    
    // Check for polygon paths
    const polygonPaths = screen.getAllByTestId(/polygon-path/);
    expect(polygonPaths).toHaveLength(2);
  });

  it('highlights selected polygon', () => {
    const selectedProps = {
      ...defaultProps,
      selectedPolygonIndex: 0
    };
    
    render(<CanvasUIElements {...selectedProps} />);
    
    // Selected polygon should have the selected class
    const selectedPolygon = screen.getByTestId('polygon-path-0');
    expect(selectedPolygon).toHaveClass('selected');
    
    // Non-selected polygon should not have the selected class
    const nonSelectedPolygon = screen.getByTestId('polygon-path-1');
    expect(nonSelectedPolygon).not.toHaveClass('selected');
  });

  it('highlights hovered polygon', () => {
    const hoveredProps = {
      ...defaultProps,
      hoveredPolygonIndex: 1
    };
    
    render(<CanvasUIElements {...hoveredProps} />);
    
    // Hovered polygon should have the hovered class
    const hoveredPolygon = screen.getByTestId('polygon-path-1');
    expect(hoveredPolygon).toHaveClass('hovered');
    
    // Non-hovered polygon should not have the hovered class
    const nonHoveredPolygon = screen.getByTestId('polygon-path-0');
    expect(nonHoveredPolygon).not.toHaveClass('hovered');
  });

  it('renders vertices when a polygon is selected', () => {
    const selectedProps = {
      ...defaultProps,
      selectedPolygonIndex: 0,
      editMode: EditMode.EDIT
    };
    
    render(<CanvasUIElements {...selectedProps} />);
    
    // Should render vertices for the selected polygon
    const vertices = screen.getAllByTestId(/vertex-/);
    expect(vertices).toHaveLength(4); // First polygon has 4 points
  });

  it('renders temporary points when creating a polygon', () => {
    const creatingProps = {
      ...defaultProps,
      temporaryPoints: [
        { x: 500, y: 500 },
        { x: 600, y: 500 },
        { x: 600, y: 600 }
      ],
      isCreatingPolygon: true
    };
    
    render(<CanvasUIElements {...creatingProps} />);
    
    // Should render temporary path and vertices
    const tempPath = screen.getByTestId('temporary-path');
    expect(tempPath).toBeInTheDocument();
    
    // Should render vertices for temporary points
    const tempVertices = screen.getAllByTestId(/temp-vertex-/);
    expect(tempVertices).toHaveLength(3);
  });

  it('renders differently based on edit mode', () => {
    // Mocking different edit modes
    vi.mocked(useCanvasContext).mockReturnValue({
      editMode: EditMode.CREATE,
      scale: 1,
      panOffset: { x: 0, y: 0 },
      canvasSize: { width: 800, height: 600 },
      canvasBounds: { left: 0, top: 0, right: 800, bottom: 600 }
    });
    
    render(<CanvasUIElements {...defaultProps} />);
    
    // In CREATE mode, the canvas should have different styling
    const canvasElement = screen.getByTestId('canvas-ui-elements');
    expect(canvasElement).toHaveClass('create-mode');
  });

  it('handles zoomed state correctly', () => {
    // Mocking zoomed state
    vi.mocked(useCanvasContext).mockReturnValue({
      editMode: EditMode.VIEW,
      scale: 2,
      panOffset: { x: 100, y: 100 },
      canvasSize: { width: 800, height: 600 },
      canvasBounds: { left: 0, top: 0, right: 800, bottom: 600 }
    });
    
    render(<CanvasUIElements {...defaultProps} />);
    
    // The SVG should have transform style with scale and translate
    const svgElement = screen.getByTestId('canvas-ui-elements');
    expect(svgElement).toHaveStyle('transform: scale(2) translate(100px, 100px)');
  });

  it('renders hovered vertex with special styling', () => {
    const hoveredVertexProps = {
      ...defaultProps,
      selectedPolygonIndex: 0,
      hoveredVertexInfo: {
        polygonIndex: 0,
        vertexIndex: 1
      }
    };
    
    render(<CanvasUIElements {...hoveredVertexProps} />);
    
    // Should render vertices for the selected polygon
    const vertices = screen.getAllByTestId(/vertex-/);
    const hoveredVertex = screen.getByTestId('vertex-0-1');
    
    // Hovered vertex should have the hovered class
    expect(hoveredVertex).toHaveClass('hovered');
    
    // Other vertices should not have the hovered class
    expect(vertices[0]).not.toHaveClass('hovered');
    expect(vertices[2]).not.toHaveClass('hovered');
    expect(vertices[3]).not.toHaveClass('hovered');
  });
});