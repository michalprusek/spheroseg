import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ToolbarV2 } from '../ToolbarV2';
import '@testing-library/jest-dom';
import { EditMode } from '../../../hooks/segmentation';

// Mock the useLanguage hook
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key, // Return the key as is for testing
    language: 'en',
  }),
}));

// Mock the Lucide React icons
vi.mock('lucide-react', () => ({
  ZoomIn: () => <div data-testid="icon-zoom-in">ZoomIn</div>,
  ZoomOut: () => <div data-testid="icon-zoom-out">ZoomOut</div>,
  Expand: () => <div data-testid="icon-expand">Expand</div>,
  Eye: () => <div data-testid="icon-eye">Eye</div>,
  Edit: () => <div data-testid="icon-edit">Edit</div>,
  PlusSquare: () => <div data-testid="icon-plus-square">PlusSquare</div>,
  Share2: () => <div data-testid="icon-share2">Share2</div>,
  Trash2: () => <div data-testid="icon-trash2">Trash2</div>,
  Undo2: () => <div data-testid="icon-undo2">Undo2</div>,
  Redo2: () => <div data-testid="icon-redo2">Redo2</div>,
  Save: () => <div data-testid="icon-save">Save</div>,
  MousePointer: () => <div data-testid="icon-mouse-pointer">MousePointer</div>,
  Scissors: () => <div data-testid="icon-scissors">Scissors</div>,
  RefreshCw: () => <div data-testid="icon-refresh-cw">RefreshCw</div>,
}));

describe('ToolbarV2 Component', () => {
  // Default props for testing
  const defaultProps = {
    editMode: EditMode.View,
    setEditMode: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onResetView: vi.fn(),
    onSave: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onResegment: vi.fn(),
    canUndo: true,
    canRedo: true,
    isSaving: false,
    isResegmenting: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all toolbar buttons correctly', () => {
    render(<ToolbarV2 {...defaultProps} />);

    // Check if all buttons are rendered
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(12); // Should have 12 buttons in total

    // Check if all icon elements are present
    expect(screen.getByTestId('icon-zoom-in')).toBeInTheDocument();
    expect(screen.getByTestId('icon-zoom-out')).toBeInTheDocument();
    expect(screen.getByTestId('icon-expand')).toBeInTheDocument();
    expect(screen.getByTestId('icon-mouse-pointer')).toBeInTheDocument();
    expect(screen.getByTestId('icon-share2')).toBeInTheDocument();
    expect(screen.getByTestId('icon-plus-square')).toBeInTheDocument();
    expect(screen.getByTestId('icon-scissors')).toBeInTheDocument();
    expect(screen.getByTestId('icon-trash2')).toBeInTheDocument();
    expect(screen.getByTestId('icon-undo2')).toBeInTheDocument();
    expect(screen.getByTestId('icon-redo2')).toBeInTheDocument();
    expect(screen.getByTestId('icon-save')).toBeInTheDocument();
    expect(screen.getByTestId('icon-refresh-cw')).toBeInTheDocument();
  });

  it('calls the appropriate callbacks when buttons are clicked', () => {
    render(<ToolbarV2 {...defaultProps} />);

    const buttons = screen.getAllByRole('button');

    // Test zoom in button
    fireEvent.click(buttons[0]);
    expect(defaultProps.onZoomIn).toHaveBeenCalledTimes(1);

    // Test zoom out button
    fireEvent.click(buttons[1]);
    expect(defaultProps.onZoomOut).toHaveBeenCalledTimes(1);

    // Test reset view button
    fireEvent.click(buttons[2]);
    expect(defaultProps.onResetView).toHaveBeenCalledTimes(1);

    // Test view mode button
    fireEvent.click(buttons[3]);
    expect(defaultProps.setEditMode).toHaveBeenCalledWith(EditMode.View);

    // Test add points button
    fireEvent.click(buttons[4]);
    expect(defaultProps.setEditMode).toHaveBeenCalledWith(EditMode.AddPoints);

    // Test create polygon button
    fireEvent.click(buttons[5]);
    expect(defaultProps.setEditMode).toHaveBeenCalledWith(EditMode.CreatePolygon);

    // Test slice button
    fireEvent.click(buttons[6]);
    expect(defaultProps.setEditMode).toHaveBeenCalledWith(EditMode.Slice);

    // Test delete polygon button
    fireEvent.click(buttons[7]);
    expect(defaultProps.setEditMode).toHaveBeenCalledWith(EditMode.DeletePolygon);

    // Test undo button
    fireEvent.click(buttons[8]);
    expect(defaultProps.onUndo).toHaveBeenCalledTimes(1);

    // Test redo button
    fireEvent.click(buttons[9]);
    expect(defaultProps.onRedo).toHaveBeenCalledTimes(1);

    // Test save button
    fireEvent.click(buttons[10]);
    expect(defaultProps.onSave).toHaveBeenCalledTimes(1);

    // Test resegment button
    fireEvent.click(buttons[11]);
    expect(defaultProps.onResegment).toHaveBeenCalledTimes(1);
  });

  it('applies active classes to the current edit mode button', () => {
    // Test with view mode
    const { rerender } = render(<ToolbarV2 {...defaultProps} editMode={EditMode.View} />);

    const buttons = screen.getAllByRole('button');

    // View mode button should have active classes
    expect(buttons[3]).toHaveClass('bg-primary/20');
    expect(buttons[3]).toHaveClass('text-primary');
    expect(buttons[3]).toHaveClass('border-l-4');

    // Other mode buttons should not have active classes
    expect(buttons[4]).not.toHaveClass('bg-primary/20');
    expect(buttons[5]).not.toHaveClass('bg-primary/20');

    // Rerender with a different mode
    rerender(<ToolbarV2 {...defaultProps} editMode={EditMode.CreatePolygon} />);

    // Now create polygon button should have active classes
    expect(buttons[5]).toHaveClass('bg-primary/20');
    expect(buttons[5]).toHaveClass('text-green-400');

    // And view mode button should not have active classes
    expect(buttons[3]).not.toHaveClass('bg-primary/20');
  });

  it('applies special colors to different edit modes', () => {
    // Test each edit mode and verify the color class is applied
    const modes = [
      { mode: EditMode.View, buttonIndex: 3, colorClass: '' },
      { mode: EditMode.AddPoints, buttonIndex: 4, colorClass: 'text-blue-400' },
      {
        mode: EditMode.CreatePolygon,
        buttonIndex: 5,
        colorClass: 'text-green-400',
      },
      { mode: EditMode.Slice, buttonIndex: 6, colorClass: 'text-yellow-400' },
      {
        mode: EditMode.DeletePolygon,
        buttonIndex: 7,
        colorClass: 'text-red-400',
      },
    ];

    for (const { mode, buttonIndex, colorClass } of modes) {
      const { unmount } = render(<ToolbarV2 {...defaultProps} editMode={mode} />);

      const buttons = screen.getAllByRole('button');
      if (colorClass) {
        expect(buttons[buttonIndex]).toHaveClass(colorClass);
      }

      unmount();
    }
  });

  it('disables buttons when appropriate', () => {
    // Test with canUndo = false, canRedo = false
    render(<ToolbarV2 {...defaultProps} canUndo={false} canRedo={false} isSaving={true} isResegmenting={true} />);

    const buttons = screen.getAllByRole('button');

    // Undo button should be disabled
    expect(buttons[8]).toHaveClass('opacity-50');
    expect(buttons[8]).toHaveClass('cursor-not-allowed');

    // Redo button should be disabled
    expect(buttons[9]).toHaveClass('opacity-50');
    expect(buttons[9]).toHaveClass('cursor-not-allowed');

    // Save button should be disabled during saving
    expect(buttons[10]).toHaveClass('opacity-50');
    expect(buttons[10]).toHaveClass('cursor-not-allowed');

    // Resegment button should be disabled during resegmentation
    expect(buttons[11]).toHaveClass('opacity-50');
    expect(buttons[11]).toHaveClass('cursor-not-allowed');
  });

  it('enables buttons when appropriate', () => {
    // Test with canUndo = true, canRedo = true
    render(<ToolbarV2 {...defaultProps} canUndo={true} canRedo={true} isSaving={false} isResegmenting={false} />);

    const buttons = screen.getAllByRole('button');

    // Undo button should be enabled
    expect(buttons[8]).not.toHaveClass('opacity-50');
    expect(buttons[8]).not.toHaveClass('cursor-not-allowed');

    // Redo button should be enabled
    expect(buttons[9]).not.toHaveClass('opacity-50');
    expect(buttons[9]).not.toHaveClass('cursor-not-allowed');

    // Save button should be enabled
    expect(buttons[10]).not.toHaveClass('opacity-50');
    expect(buttons[10]).not.toHaveClass('cursor-not-allowed');

    // Resegment button should be enabled
    expect(buttons[11]).not.toHaveClass('opacity-50');
    expect(buttons[11]).not.toHaveClass('cursor-not-allowed');
  });

  it('shows spinning animation for resegment button when isResegmenting is true', () => {
    render(<ToolbarV2 {...defaultProps} isResegmenting={true} />);

    // The refresh icon should have the animate-spin class
    const refreshIcon = screen.getByTestId('icon-refresh-cw');
    expect(refreshIcon.parentElement).toHaveClass('animate-spin');
  });

  it('does not show spinning animation for resegment button when isResegmenting is false', () => {
    render(<ToolbarV2 {...defaultProps} isResegmenting={false} />);

    // The refresh icon should not have the animate-spin class
    const refreshIcon = screen.getByTestId('icon-refresh-cw');
    expect(refreshIcon.parentElement).not.toHaveClass('animate-spin');
  });

  it('handles missing onResegment callback gracefully', () => {
    // Remove the onResegment callback from props
    const { onResegment, ...propsWithoutResegment } = defaultProps;

    // Spy on console.warn
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(<ToolbarV2 {...propsWithoutResegment} />);

    const buttons = screen.getAllByRole('button');

    // Resegment button should be rendered but disabled
    expect(buttons[11]).toBeInTheDocument();
    expect(buttons[11]).toHaveClass('opacity-50');
    expect(buttons[11]).toHaveClass('cursor-not-allowed');

    // Clicking the button should not cause errors but should log a warning
    fireEvent.click(buttons[11]);
    expect(consoleSpy).toHaveBeenCalledWith('Resegment callback not provided');

    // Clean up
    consoleSpy.mockRestore();
  });

  it('renders with custom title texts from translations', () => {
    // Override the useLanguage mock for this test
    vi.mocked(require('@/contexts/LanguageContext').useLanguage).mockReturnValueOnce({
      t: (key: string) => {
        const translations: { [key: string]: string } = {
          'tools.zoomIn': 'Custom Zoom In',
          'tools.zoomOut': 'Custom Zoom Out',
          'tools.resetView': 'Custom Reset View',
          'segmentation.modes.view': 'Custom View Mode',
          'segmentation.modes.addPoints': 'Custom Add Points',
          'segmentation.modes.createPolygon': 'Custom Create Polygon',
          'segmentation.modes.slice': 'Custom Slice',
          'segmentation.modes.deletePolygon': 'Custom Delete',
          'shortcuts.undo': 'Custom Undo',
          'shortcuts.redo': 'Custom Redo',
          'shortcuts.save': 'Custom Save',
          'segmentation.resegmentButtonTooltip': 'Custom Resegment',
        };
        return translations[key] || key;
      },
      language: 'en',
    });

    render(<ToolbarV2 {...defaultProps} />);

    const buttons = screen.getAllByRole('button');

    // Check if buttons have custom titles
    expect(buttons[0]).toHaveAttribute('title', 'Custom Zoom In');
    expect(buttons[1]).toHaveAttribute('title', 'Custom Zoom Out');
    expect(buttons[2]).toHaveAttribute('title', 'Custom Reset View');
    expect(buttons[3]).toHaveAttribute('title', 'Custom View Mode');
    expect(buttons[4]).toHaveAttribute('title', 'Custom Add Points');
    expect(buttons[5]).toHaveAttribute('title', 'Custom Create Polygon');
    expect(buttons[6]).toHaveAttribute('title', 'Custom Slice');
    expect(buttons[7]).toHaveAttribute('title', 'Custom Delete');
    expect(buttons[8]).toHaveAttribute('title', 'Custom Undo');
    expect(buttons[9]).toHaveAttribute('title', 'Custom Redo');
    expect(buttons[10]).toHaveAttribute('title', 'Custom Save');
    expect(buttons[11]).toHaveAttribute('title', 'Custom Resegment');
  });
});
