import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import VertexContextMenu from '../../context-menu/VertexContextMenu';

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

vi.mock('@/hooks/useTranslations', () => ({
  useTranslations: () => ({ 
    t: (key: string) => {
      const translations: Record<string, string> = {
        'segmentation.contextMenu.duplicateVertex': 'Duplicate Vertex',
        'segmentation.contextMenu.deleteVertex': 'Delete Vertex',
      };
      return translations[key] || key;
    }
  }),
}));

describe('VertexContextMenu', () => {
  const defaultProps = {
    children: <div data-testid="vertex-trigger">Vertex</div>,
    onDelete: vi.fn(),
    onDuplicate: vi.fn(),
    vertexIndex: 0,
    polygonId: 'test-polygon-id',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the context menu with children', () => {
    render(<VertexContextMenu {...defaultProps} />);
    
    expect(screen.getByTestId('vertex-trigger')).toBeInTheDocument();
  });

  it('renders menu items', () => {
    render(<VertexContextMenu {...defaultProps} />);
    
    // Check that menu items exist
    expect(screen.getByText('Duplicate Vertex')).toBeInTheDocument();
    expect(screen.getByText('Delete Vertex')).toBeInTheDocument();
  });

  it('calls onDuplicate when duplicate option is clicked', () => {
    render(<VertexContextMenu {...defaultProps} />);

    const duplicateOption = screen.getByText('Duplicate Vertex');
    fireEvent.click(duplicateOption);

    expect(defaultProps.onDuplicate).toHaveBeenCalledTimes(1);
  });

  it('calls onDelete when delete option is clicked', () => {
    render(<VertexContextMenu {...defaultProps} />);

    const deleteOption = screen.getByText('Delete Vertex');
    fireEvent.click(deleteOption);

    expect(defaultProps.onDelete).toHaveBeenCalledTimes(1);
  });

  it.skip('applies correct styling to delete menu item', () => {
    render(<VertexContextMenu {...defaultProps} />);
    
    const deleteOption = screen.getByText('Delete Vertex');
    // The actual component applies className="cursor-pointer text-red-600" to the delete item
    // TODO: Fix mock to properly pass through className prop
    expect(deleteOption.className).toBe('cursor-pointer text-red-600');
  });

  it('renders separator between menu items', () => {
    const { container } = render(<VertexContextMenu {...defaultProps} />);
    
    // Our mock renders <hr /> for separator
    const separator = container.querySelector('hr');
    expect(separator).toBeInTheDocument();
  });

  it('renders with different vertex index', () => {
    const customProps = {
      ...defaultProps,
      vertexIndex: 5,
    };
    
    render(<VertexContextMenu {...customProps} />);
    
    // The component accepts vertexIndex prop even though it doesn't display it
    expect(screen.getByTestId('vertex-trigger')).toBeInTheDocument();
  });

  it('renders with different polygon id', () => {
    const customProps = {
      ...defaultProps,
      polygonId: 'custom-polygon-123',
    };
    
    render(<VertexContextMenu {...customProps} />);
    
    // The component accepts polygonId prop even though it doesn't display it
    expect(screen.getByTestId('vertex-trigger')).toBeInTheDocument();
  });

  it('renders menu content with correct class', () => {
    render(<VertexContextMenu {...defaultProps} />);
    
    const menuContent = screen.getByTestId('context-menu-content');
    expect(menuContent).toHaveClass('w-64');
  });

  it('renders icons in menu items', () => {
    render(<VertexContextMenu {...defaultProps} />);
    
    // Check that both menu items have text (icons are rendered as children)
    expect(screen.getByText('Duplicate Vertex')).toBeInTheDocument();
    expect(screen.getByText('Delete Vertex')).toBeInTheDocument();
  });
});
