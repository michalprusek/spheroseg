import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@/test-utils';
import { SegmentationCanvas } from './SegmentationCanvas';
import { testImages, testSegmentations, testCells } from '@/test-utils/fixtures';
import { 
  CanvasMock, 
  createImageMock,
  mockTimers,
  createKeyboardEvent,
} from '@/test-utils/mocks';
import {
  expectToBeVisible,
  expectAriaAttributes,
  expectToastNotification,
} from '@/test-utils';

// Mock canvas
beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => new CanvasMock().getContext('2d'));
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,mock');
});

describe('SegmentationCanvas', () => {
  const mockOnUpdate = vi.fn();
  const defaultProps = {
    image: testImages.cancerCell1,
    segmentation: testSegmentations.completed,
    onUpdate: mockOnUpdate,
    editable: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders canvas with correct dimensions', () => {
    render(<SegmentationCanvas {...defaultProps} />);
    
    const canvas = screen.getByRole('img', { name: /segmentation canvas/i });
    expect(canvas).toBeInTheDocument();
    expectToBeVisible(canvas);
    
    // Check canvas attributes
    expect(canvas).toHaveAttribute('width', String(defaultProps.image.width));
    expect(canvas).toHaveAttribute('height', String(defaultProps.image.height));
  });

  it('loads and displays image', async () => {
    const mockImage = createImageMock(defaultProps.image.width, defaultProps.image.height);
    global.Image = vi.fn(() => mockImage) as any;
    
    render(<SegmentationCanvas {...defaultProps} />);
    
    await waitFor(() => {
      const ctx = (screen.getByRole('img') as HTMLCanvasElement).getContext('2d');
      expect(ctx?.drawImage).toHaveBeenCalledWith(
        mockImage,
        0,
        0,
        defaultProps.image.width,
        defaultProps.image.height
      );
    });
  });

  it('draws segmentation cells', async () => {
    render(<SegmentationCanvas {...defaultProps} />);
    
    await waitFor(() => {
      const ctx = (screen.getByRole('img') as HTMLCanvasElement).getContext('2d');
      
      // Should draw each cell
      defaultProps.segmentation.cells.forEach(cell => {
        expect(ctx?.beginPath).toHaveBeenCalled();
        expect(ctx?.moveTo).toHaveBeenCalled();
        expect(ctx?.closePath).toHaveBeenCalled();
        expect(ctx?.stroke).toHaveBeenCalled();
      });
    });
  });

  it('highlights cell on hover', async () => {
    const { user } = render(<SegmentationCanvas {...defaultProps} />);
    
    const canvas = screen.getByRole('img');
    
    // Simulate mouse move over a cell
    await user.pointer([
      { target: canvas, coords: { x: 125, y: 125 } }, // Center of first cell
    ]);
    
    await waitFor(() => {
      expect(screen.getByText(/cell #1/i)).toBeInTheDocument();
      expect(screen.getByText(/area: 2500/i)).toBeInTheDocument();
    });
  });

  it('selects cell on click when editable', async () => {
    const { user } = render(<SegmentationCanvas {...defaultProps} />);
    
    const canvas = screen.getByRole('img');
    
    // Click on a cell
    await user.click(canvas, { coords: { x: 125, y: 125 } });
    
    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          cells: expect.arrayContaining([
            expect.objectContaining({
              id: testCells.healthyCell.id,
              selected: true,
            }),
          ]),
        })
      );
    });
  });

  it('does not allow selection when not editable', async () => {
    const { user } = render(<SegmentationCanvas {...defaultProps} editable={false} />);
    
    const canvas = screen.getByRole('img');
    
    await user.click(canvas, { coords: { x: 125, y: 125 } });
    
    expect(mockOnUpdate).not.toHaveBeenCalled();
  });

  it('supports multi-selection with Ctrl/Cmd key', async () => {
    const { user } = render(<SegmentationCanvas {...defaultProps} />);
    
    const canvas = screen.getByRole('img');
    
    // Select first cell
    await user.click(canvas, { coords: { x: 125, y: 125 } });
    
    // Select second cell with Ctrl held
    await user.keyboard('[ControlLeft>]');
    await user.click(canvas, { coords: { x: 245, y: 235 } });
    await user.keyboard('[/ControlLeft]');
    
    await waitFor(() => {
      const lastCall = mockOnUpdate.mock.calls[mockOnUpdate.mock.calls.length - 1][0];
      const selectedCells = lastCall.cells.filter((c: any) => c.selected);
      expect(selectedCells).toHaveLength(2);
    });
  });

  it('deletes selected cells with Delete key', async () => {
    const { user } = render(<SegmentationCanvas {...defaultProps} />);
    
    const canvas = screen.getByRole('img');
    
    // Select a cell
    await user.click(canvas, { coords: { x: 125, y: 125 } });
    
    // Press Delete
    await user.keyboard('[Delete]');
    
    await waitFor(() => {
      expectToastNotification(/1 cell deleted/i, 'info');
      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          cells: expect.not.arrayContaining([
            expect.objectContaining({
              id: testCells.healthyCell.id,
            }),
          ]),
        })
      );
    });
  });

  it('supports zoom with mouse wheel', async () => {
    const { user } = render(<SegmentationCanvas {...defaultProps} />);
    
    const canvas = screen.getByRole('img');
    
    // Zoom in
    await user.pointer([
      { target: canvas, keys: '[MouseWheel>]', coords: { x: 500, y: 500 } },
    ]);
    
    await waitFor(() => {
      const ctx = canvas.getContext('2d');
      expect(ctx?.setTransform).toHaveBeenCalledWith(
        expect.any(Number), 0, 0, expect.any(Number), expect.any(Number), expect.any(Number)
      );
    });
  });

  it('supports pan with mouse drag', async () => {
    const { user } = render(<SegmentationCanvas {...defaultProps} />);
    
    const canvas = screen.getByRole('img');
    
    // Pan
    await user.pointer([
      { target: canvas, keys: '[MouseLeft>]', coords: { x: 500, y: 500 } },
      { coords: { x: 600, y: 600 } },
      { keys: '[/MouseLeft]' },
    ]);
    
    await waitFor(() => {
      const ctx = canvas.getContext('2d');
      expect(ctx?.setTransform).toHaveBeenCalled();
    });
  });

  it('shows cell properties panel for selected cell', async () => {
    const { user } = render(<SegmentationCanvas {...defaultProps} />);
    
    const canvas = screen.getByRole('img');
    
    // Select a cell
    await user.click(canvas, { coords: { x: 125, y: 125 } });
    
    await waitFor(() => {
      const panel = screen.getByTestId('cell-properties-panel');
      expect(panel).toBeInTheDocument();
      
      // Check cell properties are displayed
      expect(within(panel).getByText(/area/i)).toBeInTheDocument();
      expect(within(panel).getByText(/2500/)).toBeInTheDocument();
      expect(within(panel).getByText(/classification/i)).toBeInTheDocument();
      expect(within(panel).getByText(/healthy/i)).toBeInTheDocument();
    });
  });

  it('exports canvas as image', async () => {
    const { user } = render(<SegmentationCanvas {...defaultProps} showControls />);
    
    const exportButton = screen.getByRole('button', { name: /export image/i });
    await user.click(exportButton);
    
    await waitFor(() => {
      // Check download was triggered
      const link = document.createElement('a');
      expect(link.download).toMatch(/segmentation.*\.png/);
    });
  });

  it('toggles cell labels visibility', async () => {
    const { user } = render(<SegmentationCanvas {...defaultProps} showControls />);
    
    const toggleButton = screen.getByRole('button', { name: /toggle labels/i });
    await user.click(toggleButton);
    
    await waitFor(() => {
      const ctx = (screen.getByRole('img') as HTMLCanvasElement).getContext('2d');
      // Labels should be drawn
      expect(ctx?.fillText).toHaveBeenCalled();
    });
    
    // Toggle off
    await user.click(toggleButton);
    
    await waitFor(() => {
      const ctx = (screen.getByRole('img') as HTMLCanvasElement).getContext('2d');
      // Clear previous calls
      (ctx?.fillText as any).mockClear();
      // Trigger redraw
      canvas.dispatchEvent(new Event('redraw'));
      // Labels should not be drawn
      expect(ctx?.fillText).not.toHaveBeenCalled();
    });
  });

  it('filters cells by classification', async () => {
    const { user } = render(<SegmentationCanvas {...defaultProps} showControls />);
    
    const filterSelect = screen.getByRole('combobox', { name: /filter by type/i });
    await user.click(filterSelect);
    await user.click(screen.getByRole('option', { name: /cancer/i }));
    
    await waitFor(() => {
      const ctx = (screen.getByRole('img') as HTMLCanvasElement).getContext('2d');
      // Should only draw cancer cells
      expect(ctx?.beginPath).toHaveBeenCalledTimes(1); // Only cancer cell
    });
  });

  it('shows measurement tool', async () => {
    const { user } = render(<SegmentationCanvas {...defaultProps} showControls />);
    
    const measureButton = screen.getByRole('button', { name: /measure/i });
    await user.click(measureButton);
    
    const canvas = screen.getByRole('img');
    
    // Draw measurement line
    await user.pointer([
      { target: canvas, keys: '[MouseLeft>]', coords: { x: 100, y: 100 } },
      { coords: { x: 200, y: 200 } },
      { keys: '[/MouseLeft]' },
    ]);
    
    await waitFor(() => {
      // Should show measurement
      expect(screen.getByText(/141\.4 px/i)).toBeInTheDocument(); // Distance calculation
    });
  });

  it('supports undo/redo for edits', async () => {
    const timers = mockTimers();
    const { user } = render(<SegmentationCanvas {...defaultProps} />);
    
    const canvas = screen.getByRole('img');
    
    // Make an edit (delete a cell)
    await user.click(canvas, { coords: { x: 125, y: 125 } });
    await user.keyboard('[Delete]');
    
    timers.advance(100);
    
    // Undo
    await user.keyboard('[ControlLeft>]z[/ControlLeft]');
    
    await waitFor(() => {
      // Cell should be restored
      expect(mockOnUpdate).toHaveBeenLastCalledWith(
        expect.objectContaining({
          cells: expect.arrayContaining([
            expect.objectContaining({
              id: testCells.healthyCell.id,
            }),
          ]),
        })
      );
    });
    
    // Redo
    await user.keyboard('[ControlLeft>]y[/ControlLeft]');
    
    await waitFor(() => {
      // Cell should be deleted again
      expect(mockOnUpdate).toHaveBeenLastCalledWith(
        expect.objectContaining({
          cells: expect.not.arrayContaining([
            expect.objectContaining({
              id: testCells.healthyCell.id,
            }),
          ]),
        })
      );
    });
    
    timers.restore();
  });

  it('handles keyboard shortcuts', async () => {
    const { user } = render(<SegmentationCanvas {...defaultProps} />);
    
    const canvas = screen.getByRole('img');
    canvas.focus();
    
    // Select all (Ctrl+A)
    await user.keyboard('[ControlLeft>]a[/ControlLeft]');
    
    await waitFor(() => {
      const lastCall = mockOnUpdate.mock.calls[mockOnUpdate.mock.calls.length - 1][0];
      const selectedCells = lastCall.cells.filter((c: any) => c.selected);
      expect(selectedCells).toHaveLength(defaultProps.segmentation.cells.length);
    });
    
    // Deselect all (Escape)
    await user.keyboard('[Escape]');
    
    await waitFor(() => {
      const lastCall = mockOnUpdate.mock.calls[mockOnUpdate.mock.calls.length - 1][0];
      const selectedCells = lastCall.cells.filter((c: any) => c.selected);
      expect(selectedCells).toHaveLength(0);
    });
  });

  it('displays performance metrics', async () => {
    render(<SegmentationCanvas {...defaultProps} showDebug />);
    
    await waitFor(() => {
      expect(screen.getByText(/fps:/i)).toBeInTheDocument();
      expect(screen.getByText(/cells:/i)).toBeInTheDocument();
      expect(screen.getByText(/render time:/i)).toBeInTheDocument();
    });
  });

  it('handles touch gestures on mobile', async () => {
    const { user } = render(<SegmentationCanvas {...defaultProps} />);
    
    const canvas = screen.getByRole('img');
    
    // Pinch to zoom
    await user.pointer([
      { target: canvas, keys: '[TouchA>]', coords: { x: 400, y: 400 } },
      { keys: '[TouchB>]', coords: { x: 600, y: 600 } },
      { keys: '[TouchA]', coords: { x: 300, y: 300 } },
      { keys: '[TouchB]', coords: { x: 700, y: 700 } },
      { keys: '[/TouchA][/TouchB]' },
    ]);
    
    await waitFor(() => {
      const ctx = canvas.getContext('2d');
      expect(ctx?.setTransform).toHaveBeenCalled();
    });
  });
});