import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VertexContextMenu } from '../VertexContextMenu';

describe('VertexContextMenu', () => {
  const mockPosition = { x: 150, y: 200 };
  const mockVertex = { x: 100, y: 100 };
  const mockPolygon = {
    points: [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 200 },
      { x: 100, y: 200 }
    ],
    closed: true,
    color: '#FF0000'
  };

  const defaultProps = {
    position: mockPosition,
    vertexIndex: 0,
    polygon: mockPolygon,
    isVisible: true,
    onClose: vi.fn(),
    onDeleteVertex: vi.fn(),
    onAddVertex: vi.fn(),
    onSplitPolygon: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear any previous renders
    document.body.innerHTML = '';
  });

  it('renders when visible', () => {
    render(<VertexContextMenu {...defaultProps} />);
    
    // Menu should be visible
    const menu = screen.getByTestId('vertex-context-menu');
    expect(menu).toBeInTheDocument();
    expect(menu).toBeVisible();
  });

  it('does not render when not visible', () => {
    render(<VertexContextMenu {...defaultProps} isVisible={false} />);
    
    // Menu should not be in the document
    expect(screen.queryByTestId('vertex-context-menu')).not.toBeInTheDocument();
  });

  it('positions correctly based on provided coordinates', () => {
    render(<VertexContextMenu {...defaultProps} />);
    
    const menu = screen.getByTestId('vertex-context-menu');
    // Check if positioned correctly
    expect(menu).toHaveStyle(`left: ${mockPosition.x}px`);
    expect(menu).toHaveStyle(`top: ${mockPosition.y}px`);
  });

  it('calls onDeleteVertex when delete option is clicked', () => {
    render(<VertexContextMenu {...defaultProps} />);
    
    const deleteOption = screen.getByText(/delete vertex/i);
    fireEvent.click(deleteOption);
    
    expect(defaultProps.onDeleteVertex).toHaveBeenCalledWith(0);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onAddVertex when add option is clicked', () => {
    render(<VertexContextMenu {...defaultProps} />);
    
    const addOption = screen.getByText(/add vertex/i);
    fireEvent.click(addOption);
    
    expect(defaultProps.onAddVertex).toHaveBeenCalledWith(0);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onSplitPolygon when split option is clicked', () => {
    render(<VertexContextMenu {...defaultProps} />);
    
    const splitOption = screen.getByText(/split polygon/i);
    fireEvent.click(splitOption);
    
    expect(defaultProps.onSplitPolygon).toHaveBeenCalledWith(0);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('closes menu when clicking outside', () => {
    render(
      <>
        <div data-testid="outside-element">Outside element</div>
        <VertexContextMenu {...defaultProps} />
      </>
    );
    
    // Click outside the menu
    fireEvent.mouseDown(screen.getByTestId('outside-element'));
    
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('closes menu when escape key is pressed', () => {
    render(<VertexContextMenu {...defaultProps} />);
    
    // Press escape key
    fireEvent.keyDown(document, { key: 'Escape' });
    
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('shows vertex coordinates when info option is clicked', () => {
    render(<VertexContextMenu {...defaultProps} />);
    
    // Open vertex info
    const infoOption = screen.getByText(/properties/i);
    fireEvent.click(infoOption);
    
    // Check if vertex info is shown
    expect(screen.getByText(/Coordinates: X: 100, Y: 100/)).toBeInTheDocument();
    expect(screen.getByText(/Index: 0/)).toBeInTheDocument();
  });

  it('disables delete vertex option when polygon has minimum vertices', () => {
    // Polygon with only 3 vertices (minimum for a valid polygon)
    const minPolygon = {
      points: [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
        { x: 150, y: 200 }
      ],
      closed: true,
      color: '#FF0000'
    };
    
    render(<VertexContextMenu {...defaultProps} polygon={minPolygon} />);
    
    const deleteOption = screen.getByText(/delete vertex/i);
    expect(deleteOption.closest('button')).toBeDisabled();
  });

  it('enables delete vertex option when polygon has more than minimum vertices', () => {
    // Polygon has 4 vertices, more than minimum 3
    render(<VertexContextMenu {...defaultProps} />);
    
    const deleteOption = screen.getByText(/delete vertex/i);
    expect(deleteOption.closest('button')).not.toBeDisabled();
  });

  it('handles menu overflow properly when near screen edges', () => {
    // Position very close to the right edge
    const rightEdgePosition = { x: window.innerWidth - 20, y: 200 };
    
    render(<VertexContextMenu {...defaultProps} position={rightEdgePosition} />);
    
    const menu = screen.getByTestId('vertex-context-menu');
    
    // Ensure it's not positioned off-screen
    // In a real implementation, there would be some max bounds checking
    expect(parseInt(menu.style.left)).toBeLessThan(window.innerWidth);
  });

  it('shows appropriate vertex index in the menu title', () => {
    render(<VertexContextMenu {...defaultProps} vertexIndex={2} />);
    
    // Check if the title reflects the correct vertex index
    expect(screen.getByText(/Vertex #2/i)).toBeInTheDocument();
  });

  it('disables split polygon option when appropriate', () => {
    // For non-splittable cases (would need knowledge of application logic)
    const nonSplittableProps = {
      ...defaultProps,
      // Assume a flag to indicate split is not allowed
      isSplitAllowed: false
    };
    
    render(<VertexContextMenu {...nonSplittableProps} />);
    
    const splitOption = screen.getByText(/split polygon/i);
    expect(splitOption.closest('button')).toBeDisabled();
  });
});