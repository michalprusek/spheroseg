import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CanvasContainer from '../CanvasContainer';

describe('CanvasContainer', () => {
  const mockOnMouseDown = vi.fn();
  const mockOnMouseMove = vi.fn();
  const mockOnMouseUp = vi.fn();
  const mockOnMouseLeave = vi.fn();

  const defaultProps = {
    onMouseDown: mockOnMouseDown,
    onMouseMove: mockOnMouseMove,
    onMouseUp: mockOnMouseUp,
    onMouseLeave: mockOnMouseLeave,
    loading: false,
    children: <div data-testid="canvas-child">Canvas Content</div>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<CanvasContainer {...defaultProps} />);

    // Check for main component renders
    expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-child')).toBeInTheDocument();
  });

  it('has the correct CSS classes', () => {
    render(<CanvasContainer {...defaultProps} />);
    
    const container = screen.getByTestId('canvas-container');
    expect(container).toHaveClass('flex-1');
    expect(container).toHaveClass('overflow-hidden');
    expect(container).toHaveClass('relative');
    expect(container).toHaveClass('rounded-lg');
  });

  it('has cursor style set to move', () => {
    render(<CanvasContainer {...defaultProps} />);
    
    const container = screen.getByTestId('canvas-container');
    expect(container).toHaveStyle({ cursor: 'move' });
  });

  it('handles mouse down events', () => {
    render(<CanvasContainer {...defaultProps} />);

    const container = screen.getByTestId('canvas-container');
    const mockEvent = { clientX: 100, clientY: 100 };
    
    fireEvent.mouseDown(container, mockEvent);
    
    expect(mockOnMouseDown).toHaveBeenCalledTimes(1);
    expect(mockOnMouseDown).toHaveBeenCalledWith(expect.objectContaining({
      clientX: 100,
      clientY: 100,
    }));
  });

  it('handles mouse move events', () => {
    render(<CanvasContainer {...defaultProps} />);

    const container = screen.getByTestId('canvas-container');
    const mockEvent = { clientX: 150, clientY: 150 };
    
    fireEvent.mouseMove(container, mockEvent);
    
    expect(mockOnMouseMove).toHaveBeenCalledTimes(1);
    expect(mockOnMouseMove).toHaveBeenCalledWith(expect.objectContaining({
      clientX: 150,
      clientY: 150,
    }));
  });

  it('handles mouse up events', () => {
    render(<CanvasContainer {...defaultProps} />);

    const container = screen.getByTestId('canvas-container');
    const mockEvent = { clientX: 200, clientY: 200 };
    
    fireEvent.mouseUp(container, mockEvent);
    
    expect(mockOnMouseUp).toHaveBeenCalledTimes(1);
    expect(mockOnMouseUp).toHaveBeenCalledWith(expect.objectContaining({
      clientX: 200,
      clientY: 200,
    }));
  });

  it('handles mouse leave events', () => {
    render(<CanvasContainer {...defaultProps} />);

    const container = screen.getByTestId('canvas-container');
    
    fireEvent.mouseLeave(container);
    
    expect(mockOnMouseLeave).toHaveBeenCalledTimes(1);
  });

  it('uses onMouseUp as fallback when onMouseLeave is not provided', () => {
    const { onMouseLeave, ...propsWithoutMouseLeave } = defaultProps;
    render(<CanvasContainer {...propsWithoutMouseLeave} />);

    const container = screen.getByTestId('canvas-container');
    
    fireEvent.mouseLeave(container);
    
    expect(mockOnMouseUp).toHaveBeenCalledTimes(1);
  });

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<CanvasContainer {...defaultProps} ref={ref} />);
    
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toHaveAttribute('data-testid', 'canvas-container');
  });
});
