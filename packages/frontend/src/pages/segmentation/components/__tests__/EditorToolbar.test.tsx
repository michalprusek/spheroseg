import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import EditorToolbar from '../EditorToolbar';
import {
  resetAllMocks,
  defaultEditorToolbarProps,
  renderEditorComponent,
} from './editorTestUtils';

// Mock modules
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    language: 'en',
  }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('lucide-react', () => ({
  ZoomIn: () => <div data-testid="zoom-in-icon" />,
  ZoomOut: () => <div data-testid="zoom-out-icon" />,
  Maximize2: () => <div data-testid="maximize-icon" />,
  Pencil: () => <div data-testid="pencil-icon" />,
  Scissors: () => <div data-testid="scissors-icon" />,
  PlusCircle: () => <div data-testid="plus-circle-icon" />,
  Undo2: () => <div data-testid="undo-icon" />,
  Redo2: () => <div data-testid="redo-icon" />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <>{children}</>,
  TooltipProvider: ({ children }: any) => <>{children}</>,
  TooltipTrigger: ({ children }: any) => <>{children}</>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

vi.mock('../EditorToolbarButton', () => ({
  default: ({ onClick, testId, disabled, children, icon, isActive, activeVariant }: any) => (
    <button 
      onClick={onClick} 
      data-testid={testId} 
      disabled={disabled}
      variant={isActive ? activeVariant : 'ghost'}
    >
      {icon}
    </button>
  ),
}));

// Helper function to verify button state
function verifyModeButtonState(button: HTMLElement, isActive: boolean, activeClass: string) {
  if (isActive) {
    expect(button).toHaveClass(activeClass);
  } else {
    expect(button).not.toHaveClass(activeClass);
  }
}

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
    expect(screen.getByTestId('slice-mode-button')).toBeInTheDocument();
    expect(screen.getByTestId('add-points-button')).toBeInTheDocument();
    expect(screen.getByTestId('undo-button')).toBeInTheDocument();
    expect(screen.getByTestId('redo-button')).toBeInTheDocument();
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
    const slicingModeButton = screen.getByTestId('slice-mode-button');
    const pointAddingModeButton = screen.getByTestId('add-points-button');

    // Edit mode button should have default variant when active (no bg-primary class)
    expect(editModeButton).toHaveAttribute('variant', 'default');
    expect(slicingModeButton).toHaveAttribute('variant', 'ghost');
    expect(pointAddingModeButton).toHaveAttribute('variant', 'ghost');
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
    const slicingModeButton = screen.getByTestId('slice-mode-button');
    const pointAddingModeButton = screen.getByTestId('add-points-button');

    fireEvent.click(editModeButton);
    expect(mockToggleEditMode).toHaveBeenCalledTimes(1);

    fireEvent.click(slicingModeButton);
    expect(mockToggleSlicingMode).toHaveBeenCalledTimes(1);

    fireEvent.click(pointAddingModeButton);
    expect(mockTogglePointAddingMode).toHaveBeenCalledTimes(1);
  });
});
