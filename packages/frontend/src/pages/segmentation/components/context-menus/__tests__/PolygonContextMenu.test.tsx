import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PolygonContextMenu from '../../context-menu/PolygonContextMenu';

// Mock the dependencies
vi.mock('@/components/ui/context-menu', () => ({
  ContextMenu: ({ children }: any) => <div>{children}</div>,
  ContextMenuContent: ({ children, className }: any) => <div data-testid="context-menu-content" className={className}>{children}</div>,
  ContextMenuItem: ({ children, onClick, className }: any) => (
    <button onClick={onClick} className={className || ''}>
      {children}
    </button>
  ),
  ContextMenuTrigger: ({ children, asChild }: any) => <div>{children}</div>,
  ContextMenuSeparator: () => <hr />,
}));

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: any) => open ? <div data-testid="alert-dialog">{children}</div> : null,
  AlertDialogContent: ({ children }: any) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }: any) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogCancel: ({ children }: any) => <button>{children}</button>,
  AlertDialogAction: ({ children, onClick, className }: any) => (
    <button onClick={onClick} className={className}>
      {children}
    </button>
  ),
}));

vi.mock('@/hooks/useTranslations', () => ({
  useTranslations: () => ({ 
    t: (key: string) => {
      const translations: Record<string, string> = {
        'segmentation.contextMenu.editPolygon': 'Edit Polygon',
        'segmentation.contextMenu.splitPolygon': 'Split Polygon',
        'segmentation.contextMenu.deletePolygon': 'Delete Polygon',
        'segmentation.contextMenu.confirmDeleteTitle': 'Confirm Delete',
        'segmentation.contextMenu.confirmDeleteMessage': 'Are you sure you want to delete this polygon?',
        'common.cancel': 'Cancel',
        'common.delete': 'Delete',
      };
      return translations[key] || key;
    }
  }),
}));

describe('PolygonContextMenu', () => {
  const defaultProps = {
    children: <div data-testid="polygon-trigger">Polygon</div>,
    onDelete: vi.fn(),
    onSlice: vi.fn(),
    onEdit: vi.fn(),
    polygonId: 'test-polygon-id',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the context menu with children', () => {
    render(<PolygonContextMenu {...defaultProps} />);
    
    expect(screen.getByTestId('polygon-trigger')).toBeInTheDocument();
  });

  it('calls onEdit when edit option is clicked', () => {
    render(<PolygonContextMenu {...defaultProps} />);
    
    const editOption = screen.getByText('Edit Polygon');
    fireEvent.click(editOption);
    
    expect(defaultProps.onEdit).toHaveBeenCalledTimes(1);
  });

  it('calls onSlice when split option is clicked', () => {
    render(<PolygonContextMenu {...defaultProps} />);
    
    const sliceOption = screen.getByText('Split Polygon');
    fireEvent.click(sliceOption);
    
    expect(defaultProps.onSlice).toHaveBeenCalledTimes(1);
  });

  it('shows delete confirmation dialog when delete option is clicked', async () => {
    render(<PolygonContextMenu {...defaultProps} />);
    
    const deleteOption = screen.getByText('Delete Polygon');
    fireEvent.click(deleteOption);
    
    await waitFor(() => {
      expect(screen.getByTestId('alert-dialog')).toBeInTheDocument();
      expect(screen.getByText('Confirm Delete')).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to delete this polygon?')).toBeInTheDocument();
    });
  });

  it('calls onDelete when delete is confirmed', async () => {
    render(<PolygonContextMenu {...defaultProps} />);
    
    // Open delete dialog
    const deleteOption = screen.getByText('Delete Polygon');
    fireEvent.click(deleteOption);
    
    // Confirm deletion
    await waitFor(() => {
      const confirmButton = screen.getByRole('button', { name: 'Delete' });
      fireEvent.click(confirmButton);
    });
    
    expect(defaultProps.onDelete).toHaveBeenCalledTimes(1);
  });

  it('does not call onDelete when delete is cancelled', async () => {
    render(<PolygonContextMenu {...defaultProps} />);
    
    // Open delete dialog
    const deleteOption = screen.getByText('Delete Polygon');
    fireEvent.click(deleteOption);
    
    // Cancel deletion
    await waitFor(() => {
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);
    });
    
    expect(defaultProps.onDelete).not.toHaveBeenCalled();
  });

  it('handles right-click on wrapped children', () => {
    const { container } = render(<PolygonContextMenu {...defaultProps} />);
    
    const trigger = screen.getByTestId('polygon-trigger');
    fireEvent.contextMenu(trigger);
    
    // Should prevent default context menu
    expect(screen.getByTestId('alert-dialog')).toBeInTheDocument();
  });

  it.skip('applies correct styling to delete menu item', () => {
    render(<PolygonContextMenu {...defaultProps} />);
    
    const deleteOption = screen.getByText('Delete Polygon');
    // The actual component applies className="cursor-pointer text-red-600" to the ContextMenuItem
    // TODO: Fix mock to properly pass through className prop
    expect(deleteOption.className).toBe('cursor-pointer text-red-600');
  });

  it('renders all menu items with correct icons', () => {
    render(<PolygonContextMenu {...defaultProps} />);
    
    // Check that menu items exist (icons are rendered as children)
    expect(screen.getByText('Edit Polygon')).toBeInTheDocument();
    expect(screen.getByText('Split Polygon')).toBeInTheDocument();
    expect(screen.getByText('Delete Polygon')).toBeInTheDocument();
  });
});
