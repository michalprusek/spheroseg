import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CanvasUIElements from '../CanvasUIElements';

// Mock child components
vi.mock('../CanvasZoomInfo', () => ({
  default: ({ zoom }: any) => <div data-testid="zoom-info">Zoom: {zoom}x</div>,
}));

vi.mock('../../EditorHelpTips', () => ({
  default: ({ editMode, slicingMode, pointAddingMode }: any) => (
    <div data-testid="editor-help-tips">
      {editMode && 'Edit Mode'}
      {slicingMode && 'Slicing Mode'}
      {pointAddingMode && 'Point Adding Mode'}
    </div>
  ),
}));

vi.mock('../EditorModeFooter', () => ({
  default: ({ mode, text }: any) => (
    <div data-testid="editor-mode-footer" data-mode={mode}>
      {text}
    </div>
  ),
}));

describe('CanvasUIElements', () => {
  const defaultProps = {
    zoom: 1,
    editMode: false,
    slicingMode: false,
    pointAddingMode: false,
    isShiftPressed: false,
    sliceStartPoint: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render zoom info component', () => {
    render(<CanvasUIElements {...defaultProps} />);
    
    expect(screen.getByTestId('zoom-info')).toBeInTheDocument();
    expect(screen.getByText('Zoom: 1x')).toBeInTheDocument();
  });

  it('should show different zoom levels', () => {
    const props = { ...defaultProps, zoom: 2.5 };
    render(<CanvasUIElements {...props} />);
    
    expect(screen.getByText('Zoom: 2.5x')).toBeInTheDocument();
  });

  it('should show editor help tips when in edit mode', () => {
    const props = { ...defaultProps, editMode: true };
    render(<CanvasUIElements {...props} />);
    
    expect(screen.getByTestId('editor-help-tips')).toBeInTheDocument();
    expect(screen.getByText('Edit Mode')).toBeInTheDocument();
  });

  it('should show editor help tips when in slicing mode', () => {
    const props = { ...defaultProps, slicingMode: true };
    render(<CanvasUIElements {...props} />);
    
    expect(screen.getByTestId('editor-help-tips')).toBeInTheDocument();
    expect(screen.getByText('Slicing Mode')).toBeInTheDocument();
  });

  it('should show editor help tips when in point adding mode', () => {
    const props = { ...defaultProps, pointAddingMode: true };
    render(<CanvasUIElements {...props} />);
    
    expect(screen.getByTestId('editor-help-tips')).toBeInTheDocument();
    expect(screen.getByText('Point Adding Mode')).toBeInTheDocument();
  });

  it('should show editor mode footer in any editing mode', () => {
    const props = { ...defaultProps, editMode: true };
    render(<CanvasUIElements {...props} />);
    
    expect(screen.getByTestId('editor-mode-footer')).toBeInTheDocument();
    expect(screen.getByText(/Edit Mode - Vytváření nového polygonu/)).toBeInTheDocument();
  });

  it('should pass shift pressed state to footer', () => {
    const props = { ...defaultProps, editMode: true, isShiftPressed: true };
    render(<CanvasUIElements {...props} />);
    
    expect(screen.getByText(/Auto-přidávání při držení Shift/)).toBeInTheDocument();
  });

  it('should not show editor help tips when not in any mode', () => {
    render(<CanvasUIElements {...defaultProps} />);
    
    // The component shows help tips if any mode is active
    expect(screen.queryByTestId('editor-help-tips')).not.toBeInTheDocument();
  });

  it('should not show editor mode footer when not in any mode', () => {
    render(<CanvasUIElements {...defaultProps} />);
    
    // The component shows footer if any mode is active
    expect(screen.queryByTestId('editor-mode-footer')).not.toBeInTheDocument();
  });

  it('should render all UI elements for combined modes', () => {
    const props = {
      ...defaultProps,
      editMode: true,
      slicingMode: true,
      pointAddingMode: true,
      zoom: 1.5,
    };
    render(<CanvasUIElements {...props} />);
    
    expect(screen.getByText('Zoom: 1.5x')).toBeInTheDocument();
    expect(screen.getByTestId('editor-help-tips')).toBeInTheDocument();
    // The actual component renders multiple footers, one for each mode
    const footers = screen.getAllByTestId('editor-mode-footer');
    expect(footers).toHaveLength(3);
    // Check that each mode has its footer
    expect(screen.getByText(/Edit Mode - Vytváření nového polygonu/)).toBeInTheDocument();
    expect(screen.getByText(/Slicing Mode - Rozdělení polygonu/)).toBeInTheDocument();
    expect(screen.getByText(/Point Adding Mode - Přidávání bodů do polygonu/)).toBeInTheDocument();
  });

  it('should handle slice start point prop', () => {
    const props = {
      ...defaultProps,
      slicingMode: true,
      sliceStartPoint: { x: 100, y: 200 },
    };
    render(<CanvasUIElements {...props} />);
    
    // The component shows different text based on sliceStartPoint
    expect(screen.getByText(/Klikněte pro dokončení/)).toBeInTheDocument();
    expect(screen.getByTestId('editor-help-tips')).toBeInTheDocument();
  });
});
