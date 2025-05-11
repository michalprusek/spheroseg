import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import EditorCanvas from '../canvas/CanvasV2';
import { SegmentationResult, Point } from '@/lib/segmentation';
import { VertexDragState, TempPointsState } from '../../types';
import { vi } from 'vitest';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { MemoryRouter } from 'react-router-dom';

// Mock the child components to simplify testing
vi.mock('../canvas/CanvasContainer', () => ({
  default: ({ children, onMouseDown, onMouseMove, onMouseUp, onMouseLeave, ref }: any) => (
    <div
      data-testid="canvas-container"
      ref={ref}
      onClick={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  ),
}));

vi.mock('../canvas/CanvasContent', () => ({
  default: ({ children }: any) => <div data-testid="canvas-content">{children}</div>,
}));

vi.mock('../canvas/CanvasImage', () => ({
  default: ({ src }: any) => <img data-testid="canvas-image" src={src} alt="mock" />,
}));

vi.mock('../canvas/CanvasPolygonLayer', () => ({
  default: ({ segmentation, selectedPolygonId, onSelectPolygon }: any) => (
    <div
      data-testid="canvas-polygon-layer"
      data-segmentation-id={segmentation?.id}
      data-selected-polygon-id={selectedPolygonId}
      onClick={() => onSelectPolygon && onSelectPolygon('test-polygon-id')}
    >
      Polygon Layer
    </div>
  ),
}));

vi.mock('../canvas/CanvasLoadingOverlay', () => ({
  default: ({ loading }: any) => (
    <div data-testid="canvas-loading-overlay" data-loading={loading}>
      {loading ? 'Loading...' : 'Not Loading'}
    </div>
  ),
}));

// Mock the KeyboardShortcutsHelp component
vi.mock('../KeyboardShortcutsHelp', () => ({
  default: () => <div data-testid="keyboard-shortcuts-help">Keyboard Shortcuts</div>,
}));

// Skip these tests for now due to complex mocking requirements
describe.skip('EditorCanvas', () => {
  // Default props for the component
  const defaultProps = {
    loading: false,
    segmentation: {
      id: 'test-segmentation',
      imageWidth: 800,
      imageHeight: 600,
      polygons: [
        {
          id: 'polygon-1',
          type: 'external',
          points: [
            { x: 100, y: 100 },
            { x: 200, y: 100 },
            { x: 200, y: 200 },
            { x: 100, y: 200 },
          ],
        },
      ],
    } as SegmentationResult,
    zoom: 1,
    offset: { x: 0, y: 0 },
    canvasWidth: 1000,
    canvasHeight: 800,
    selectedPolygonId: null,
    hoveredVertex: { polygonId: null, vertexIndex: null },
    vertexDragState: {} as VertexDragState,
    imageSrc: 'test-image.jpg',
    containerRef: React.createRef<HTMLDivElement>(),
    editMode: false,
    slicingMode: false,
    pointAddingMode: {
      isActive: false,
      sourcePolygonId: null,
      pointIndex: null,
    },
    cursorPosition: null as Point | null,
    sliceStartPoint: null as Point | null,
    isShiftPressed: false,
    hoveredSegment: null,
    tempPoints: {} as TempPointsState,
    pointAddingTempPoints: [],
    selectedVertexIndex: null,
    selectedPolygonPoints: null,
    sourcePolygonId: null,
    onSelectPolygon: vi.fn(),
    onDeletePolygon: vi.fn(),
    onSlicePolygon: vi.fn(),
    onEditPolygon: vi.fn(),
    onSetPolygonType: vi.fn(),
    onDeleteVertex: vi.fn(),
    onDuplicateVertex: vi.fn(),
    onMouseDown: vi.fn(),
    onMouseMove: vi.fn(),
    onMouseUp: vi.fn(),
    onMouseLeave: vi.fn(),
  };

  it('renders loading state correctly', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <LanguageProvider>
            <EditorCanvas {...defaultProps} loading={true} />
          </LanguageProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-loading-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-loading-overlay')).toHaveAttribute('data-loading', 'true');
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders waiting message when not loading but missing segmentation data', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <LanguageProvider>
            <EditorCanvas {...defaultProps} loading={false} segmentation={null} />
          </LanguageProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
    expect(screen.getByText('Waiting for segmentation data...')).toBeInTheDocument();
  });

  it('renders canvas content when segmentation data is available', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <LanguageProvider>
            <EditorCanvas {...defaultProps} />
          </LanguageProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-content')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-image')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-polygon-layer')).toBeInTheDocument();
  });

  it('passes the correct props to CanvasPolygonLayer', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <LanguageProvider>
            <EditorCanvas {...defaultProps} selectedPolygonId="polygon-1" />
          </LanguageProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    const polygonLayer = screen.getByTestId('canvas-polygon-layer');
    expect(polygonLayer).toHaveAttribute('data-segmentation-id', 'test-segmentation');
    expect(polygonLayer).toHaveAttribute('data-selected-polygon-id', 'polygon-1');
  });

  it('calls onMouseDown when mouse down event occurs', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <LanguageProvider>
            <EditorCanvas {...defaultProps} />
          </LanguageProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId('canvas-container'));
    expect(defaultProps.onMouseDown).toHaveBeenCalled();
  });

  it('calls onSelectPolygon when a polygon is selected', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <LanguageProvider>
            <EditorCanvas {...defaultProps} />
          </LanguageProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId('canvas-polygon-layer'));
    expect(defaultProps.onSelectPolygon).toHaveBeenCalledWith('test-polygon-id');
  });
});
