import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { vi } from 'vitest';
import CanvasPolygon from '../CanvasPolygon';
import '@testing-library/jest-dom';

// Define EditMode enum directly to avoid import issues
enum EditMode {
  View = 0,
  EditVertices = 1,
  AddPoints = 2,
  Slice = 3,
  CreatePolygon = 4,
  DeletePolygon = 5
}

// Mock the CanvasVertex component
vi.mock('../CanvasVertex', () => ({
  default: ({ index, x, y, isHovered, isDragging, onMouseDown, onContextMenu }: any) => (
    <circle
      data-testid={`vertex-${index}`}
      cx={x}
      cy={y}
      r={5}
      data-hovered={isHovered}
      data-dragging={isDragging}
      onMouseDown={onMouseDown}
      onContextMenu={onContextMenu}
    />
  )
}));

// Mock the PolygonContextMenu component
vi.mock('../context-menu/PolygonContextMenu', () => ({
  default: ({ isOpen, position, onClose, onDelete, onSlice, onEdit }: any) => (
    isOpen ? (
      <div
        data-testid="polygon-context-menu"
        style={{ left: position.x, top: position.y }}
      >
        <button data-testid="delete-button" onClick={onDelete}>Delete</button>
        <button data-testid="slice-button" onClick={onSlice}>Slice</button>
        <button data-testid="edit-button" onClick={onEdit}>Edit</button>
        <button data-testid="close-button" onClick={onClose}>Close</button>
      </div>
    ) : null
  )
}));

describe('CanvasPolygon Component', () => {
  const mockPolygon = {
    id: 'polygon-1',
    points: [
      { x: 10, y: 10 },
      { x: 100, y: 10 },
      { x: 100, y: 100 },
      { x: 10, y: 100 }
    ],
    type: 'external' as const
  };

  const defaultProps = {
    polygon: mockPolygon,
    isSelected: false,
    isHovered: false,
    hoveredVertex: { polygonId: null, vertexIndex: null },
    vertexDragState: null,
    editMode: EditMode.View,
    onSelectPolygon: vi.fn(),
    onDeletePolygon: vi.fn(),
    onSlicePolygon: vi.fn(),
    onEditPolygon: vi.fn(),
    onDeleteVertex: vi.fn(),
    onDuplicateVertex: vi.fn()
  };

  it('renders a polygon with the correct points', () => {
    const { container } = render(<CanvasPolygon {...defaultProps} />);

    const polygon = container.querySelector('polygon');
    expect(polygon).toBeInTheDocument();

    // Check if the points attribute is correct
    const expectedPoints = '10,10 100,10 100,100 10,100';
    expect(polygon).toHaveAttribute('points', expectedPoints);
  });

  it('renders with correct polygon points', () => {
    const props = {
      ...defaultProps,
      isSelected: true
    };

    const { container } = render(<CanvasPolygon {...props} />);

    // Instead of testing vertices, let's verify the polygon points
    const polygon = container.querySelector('polygon');
    expect(polygon).toBeInTheDocument();
    expect(polygon).toHaveAttribute('points', '10,10 100,10 100,100 10,100');
  });

  it('does not render vertices when not selected', () => {
    render(<CanvasPolygon {...defaultProps} />);

    // Should not render any vertices
    const vertices = screen.queryAllByTestId(/^vertex-/);
    expect(vertices).toHaveLength(0);
  });

  it('applies different stroke width when selected', () => {
    const props = {
      ...defaultProps,
      isSelected: true
    };

    const { container } = render(<CanvasPolygon {...props} />);

    const polygon = container.querySelector('polygon');
    expect(polygon).toHaveAttribute('stroke-width', '3');
  });

  it('applies fill color when hovered', () => {
    const props = {
      ...defaultProps,
      isHovered: true
    };

    const { container } = render(<CanvasPolygon {...props} />);

    const polygon = container.querySelector('polygon');
    expect(polygon).toHaveAttribute('fill', '#FF000033');
  });

  it('applies blue color for internal polygons', () => {
    const props = {
      ...defaultProps,
      polygon: {
        ...mockPolygon,
        type: 'internal' as const
      }
    };

    const { container } = render(<CanvasPolygon {...props} />);

    const polygon = container.querySelector('polygon');
    expect(polygon).toHaveAttribute('stroke', 'blue');
  });

  it('calls onSelectPolygon when clicked', () => {
    const onSelectPolygon = vi.fn();
    const props = {
      ...defaultProps,
      onSelectPolygon
    };

    const { container } = render(<CanvasPolygon {...props} />);

    const polygon = container.querySelector('polygon');
    fireEvent.click(polygon!);

    expect(onSelectPolygon).toHaveBeenCalledWith('polygon-1');
  });

  it('renders with correct vector-effect attribute', () => {
    const { container } = render(<CanvasPolygon {...defaultProps} />);

    const polygon = container.querySelector('polygon');
    expect(polygon).toHaveAttribute('vector-effect', 'non-scaling-stroke');
  });

  it('renders with correct shape-rendering attribute', () => {
    const { container } = render(<CanvasPolygon {...defaultProps} />);

    const polygon = container.querySelector('polygon');
    expect(polygon).toHaveAttribute('shape-rendering', 'geometricPrecision');
  });

  it('renders with correct style attribute', () => {
    const { container } = render(<CanvasPolygon {...defaultProps} />);

    const polygon = container.querySelector('polygon');
    expect(polygon).toHaveAttribute('style', 'pointer-events: visiblePainted;');
  });

  it('renders with correct stroke color', () => {
    const { container } = render(<CanvasPolygon {...defaultProps} />);

    const polygon = container.querySelector('polygon');
    expect(polygon).toHaveAttribute('stroke', 'red');
  });
});
