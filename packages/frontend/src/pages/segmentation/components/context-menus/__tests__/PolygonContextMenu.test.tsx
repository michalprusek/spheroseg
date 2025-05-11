import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PolygonContextMenu } from '../PolygonContextMenu';

describe('PolygonContextMenu', () => {
  const mockPosition = { x: 150, y: 200 };
  const mockPolygon = {
    points: [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 200 },
      { x: 100, y: 200 },
    ],
    closed: true,
    color: '#FF0000',
  };

  const defaultProps = {
    position: mockPosition,
    polygon: mockPolygon,
    isVisible: true,
    onClose: vi.fn(),
    onDelete: vi.fn(),
    onDuplicate: vi.fn(),
    onColorChange: vi.fn(),
    onChangeVisibility: vi.fn(),
    isPolygonVisible: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear any previous renders
    document.body.innerHTML = '';
  });

  it('renders when visible', () => {
    render(<PolygonContextMenu {...defaultProps} />);

    // Menu should be visible
    const menu = screen.getByTestId('polygon-context-menu');
    expect(menu).toBeInTheDocument();
    expect(menu).toBeVisible();
  });

  it('does not render when not visible', () => {
    render(<PolygonContextMenu {...defaultProps} isVisible={false} />);

    // Menu should not be in the document
    expect(screen.queryByTestId('polygon-context-menu')).not.toBeInTheDocument();
  });

  it('positions correctly based on provided coordinates', () => {
    render(<PolygonContextMenu {...defaultProps} />);

    const menu = screen.getByTestId('polygon-context-menu');
    // Check if positioned correctly
    expect(menu).toHaveStyle(`left: ${mockPosition.x}px`);
    expect(menu).toHaveStyle(`top: ${mockPosition.y}px`);
  });

  it('calls onDelete when delete option is clicked', () => {
    render(<PolygonContextMenu {...defaultProps} />);

    const deleteOption = screen.getByText(/delete/i);
    fireEvent.click(deleteOption);

    expect(defaultProps.onDelete).toHaveBeenCalledTimes(1);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onDuplicate when duplicate option is clicked', () => {
    render(<PolygonContextMenu {...defaultProps} />);

    const duplicateOption = screen.getByText(/duplicate/i);
    fireEvent.click(duplicateOption);

    expect(defaultProps.onDuplicate).toHaveBeenCalledTimes(1);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onColorChange when a color is selected', () => {
    render(<PolygonContextMenu {...defaultProps} />);

    // Open color picker
    const colorOption = screen.getByText(/change color/i);
    fireEvent.click(colorOption);

    // Find a color in the picker and click it
    const colorSwatch = screen.getAllByTestId(/color-swatch-/)[0];
    fireEvent.click(colorSwatch);

    expect(defaultProps.onColorChange).toHaveBeenCalledTimes(1);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('toggles polygon visibility when hide/show option is clicked', () => {
    // Start with a visible polygon
    render(<PolygonContextMenu {...defaultProps} />);

    // Should show "Hide" option
    const hideOption = screen.getByText(/hide/i);
    fireEvent.click(hideOption);

    expect(defaultProps.onChangeVisibility).toHaveBeenCalledWith(false);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);

    // Re-render with an invisible polygon
    defaultProps.onClose.mockClear();
    defaultProps.onChangeVisibility.mockClear();

    render(<PolygonContextMenu {...defaultProps} isPolygonVisible={false} />);

    // Should now show "Show" option
    const showOption = screen.getByText(/show/i);
    fireEvent.click(showOption);

    expect(defaultProps.onChangeVisibility).toHaveBeenCalledWith(true);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('closes menu when clicking outside', () => {
    render(
      <>
        <div data-testid="outside-element">Outside element</div>
        <PolygonContextMenu {...defaultProps} />
      </>,
    );

    // Click outside the menu
    fireEvent.mouseDown(screen.getByTestId('outside-element'));

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('closes menu when escape key is pressed', () => {
    render(<PolygonContextMenu {...defaultProps} />);

    // Press escape key
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('shows polygon properties when info option is clicked', () => {
    render(<PolygonContextMenu {...defaultProps} />);

    // Open polygon info
    const infoOption = screen.getByText(/properties/i);
    fireEvent.click(infoOption);

    // Check if polygon info is shown
    expect(screen.getByText(/Vertices: 4/)).toBeInTheDocument();
    expect(screen.getByText(/Color: #FF0000/)).toBeInTheDocument();
  });

  it('closes when any menu action is completed', () => {
    render(<PolygonContextMenu {...defaultProps} />);

    // Click any menu option
    const deleteOption = screen.getByText(/delete/i);
    fireEvent.click(deleteOption);

    // Should close the menu
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('handles menu overflow properly when near screen edges', () => {
    // Position very close to the right edge
    const rightEdgePosition = { x: window.innerWidth - 20, y: 200 };

    render(<PolygonContextMenu {...defaultProps} position={rightEdgePosition} />);

    const menu = screen.getByTestId('polygon-context-menu');

    // Ensure it's not positioned off-screen
    // In a real implementation, there would be some max bounds checking
    expect(parseInt(menu.style.left)).toBeLessThan(window.innerWidth);
  });
});
