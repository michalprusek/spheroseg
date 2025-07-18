import { screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import '@testing-library/jest-dom';
import EditorToolbar from '../EditorToolbar';
import {
  resetAllMocks,
  renderEditorComponent,
  defaultEditorToolbarProps,
  verifyModeButtonState,
} from '../../../../../shared/test-utils/componentTestUtils';

// Import shared mock setup
import { setupEditorMocks } from '../../../../../shared/test-utils/mock-contexts';

// Setup all mocks
setupEditorMocks();

describe('EditorToolbar Component', () => {
  const renderComponent = (props = {}) => {
    return renderEditorComponent(<EditorToolbar {...defaultEditorToolbarProps} {...props} />);
  };

  beforeEach(() => {
    resetAllMocks();
  });

  it('renders all toolbar buttons', () => {
    renderComponent();

    // Check if all toolbar buttons are rendered
    expect(screen.getByTestId('zoom-in-button')).toBeInTheDocument();
    expect(screen.getByTestId('zoom-out-button')).toBeInTheDocument();
    expect(screen.getByTestId('reset-view-button')).toBeInTheDocument();
    expect(screen.getByTestId('edit-mode-button')).toBeInTheDocument();
    expect(screen.getByTestId('slicing-mode-button')).toBeInTheDocument();
    expect(screen.getByTestId('point-adding-mode-button')).toBeInTheDocument();
    expect(screen.getByTestId('undo-button')).toBeInTheDocument();
    expect(screen.getByTestId('redo-button')).toBeInTheDocument();
    expect(screen.getByTestId('save-button')).toBeInTheDocument();
  });

  it('calls zoom functions when zoom buttons are clicked', () => {
    const mockOnZoomIn = vi.fn();
    const mockOnZoomOut = vi.fn();
    const mockOnResetView = vi.fn();

    renderComponent({
      onZoomIn: mockOnZoomIn,
      onZoomOut: mockOnZoomOut,
      onResetView: mockOnResetView,
    });

    const zoomInButton = screen.getByTestId('zoom-in-button');
    const zoomOutButton = screen.getByTestId('zoom-out-button');
    const resetViewButton = screen.getByTestId('reset-view-button');

    fireEvent.click(zoomInButton);
    expect(mockOnZoomIn).toHaveBeenCalledTimes(1);

    fireEvent.click(zoomOutButton);
    expect(mockOnZoomOut).toHaveBeenCalledTimes(1);

    fireEvent.click(resetViewButton);
    expect(mockOnResetView).toHaveBeenCalledTimes(1);
  });

  it('shows correct active state for edit mode buttons', () => {
    renderComponent({
      editMode: true,
      slicingMode: false,
      pointAddingMode: false,
    });

    const editModeButton = screen.getByTestId('edit-mode-button');
    const slicingModeButton = screen.getByTestId('slicing-mode-button');
    const pointAddingModeButton = screen.getByTestId('point-adding-mode-button');

    verifyModeButtonState(editModeButton, true, 'bg-primary');
    verifyModeButtonState(slicingModeButton, false, 'bg-primary');
    verifyModeButtonState(pointAddingModeButton, false, 'bg-primary');
  });

  it('disables undo/redo buttons based on history state', () => {
    renderComponent({
      canUndo: false,
      canRedo: false,
    });

    const undoButton = screen.getByTestId('undo-button');
    const redoButton = screen.getByTestId('redo-button');

    expect(undoButton).toBeDisabled();
    expect(redoButton).toBeDisabled();
  });

  it('calls toggle functions when mode buttons are clicked', () => {
    const mockToggleEditMode = vi.fn();
    const mockToggleSlicingMode = vi.fn();
    const mockTogglePointAddingMode = vi.fn();

    renderComponent({
      onToggleEditMode: mockToggleEditMode,
      onToggleSlicingMode: mockToggleSlicingMode,
      onTogglePointAddingMode: mockTogglePointAddingMode,
    });

    const editModeButton = screen.getByTestId('edit-mode-button');
    const slicingModeButton = screen.getByTestId('slicing-mode-button');
    const pointAddingModeButton = screen.getByTestId('point-adding-mode-button');

    fireEvent.click(editModeButton);
    expect(mockToggleEditMode).toHaveBeenCalledTimes(1);

    fireEvent.click(slicingModeButton);
    expect(mockToggleSlicingMode).toHaveBeenCalledTimes(1);

    fireEvent.click(pointAddingModeButton);
    expect(mockTogglePointAddingMode).toHaveBeenCalledTimes(1);
  });
});
