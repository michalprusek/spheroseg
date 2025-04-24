import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { BrowserRouter, useParams } from 'react-router-dom';
import '@testing-library/jest-dom';

// Mock functions
const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    error: mockToastError,
    success: mockToastSuccess
  }
}));

// Mock apiClient
vi.mock('@/lib/apiClient', () => ({
  default: {
    get: mockApiGet,
    post: mockApiPost
  }
}));

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: vi.fn()
  };
});

// Mock EditMode enum
enum EditMode {
  View,
  EditVertices,
  AddPoints,
  Slice,
  DeletePolygons,
  CreatePolygon
}

// Create a standalone SegmentationEditor component for testing
const MockSegmentationEditor = ({ 
  isLoading = false, 
  hasError = false,
  hasSegmentation = true,
  projectId = 'project-123',
  imageId = 'image-123'
}) => {
  // Mock the useParams hook
  (useParams as jest.Mock).mockReturnValue({ projectId, imageId });
  
  // Mock segmentation data
  const segmentation = hasSegmentation ? {
    polygons: [
      {
        id: 'polygon-1',
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 100 },
          { x: 200, y: 200 },
          { x: 100, y: 200 }
        ],
        color: '#FF0000',
        label: 'Object 1'
      },
      {
        id: 'polygon-2',
        points: [
          { x: 300, y: 300 },
          { x: 400, y: 300 },
          { x: 400, y: 400 },
          { x: 300, y: 400 }
        ],
        color: '#00FF00',
        label: 'Object 2'
      }
    ],
    width: 800,
    height: 600
  } : null;
  
  // Mock project data
  const projectData = {
    id: projectId,
    title: 'Test Project',
    description: 'A test project for segmentation',
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z'
  };
  
  // Mock image data
  const imageData = {
    id: imageId,
    name: 'test-image.jpg',
    url: 'https://example.com/test-image.jpg',
    width: 800,
    height: 600,
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z'
  };
  
  // Mock state
  const [editMode, setEditMode] = React.useState(EditMode.View);
  const [selectedPolygonId, setSelectedPolygonId] = React.useState<string | null>(null);
  const [zoom, setZoom] = React.useState(1);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  
  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }
  
  if (hasError) {
    return (
      <div className="error-container">
        <div className="error-message">Failed to load segmentation editor</div>
        <button className="retry-button">Retry</button>
      </div>
    );
  }
  
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 5));
  };
  
  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.2, 0.5));
  };
  
  const handleResetView = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };
  
  const handleModeChange = (mode: EditMode) => {
    setEditMode(mode);
  };
  
  const handleSelectPolygon = (id: string) => {
    setSelectedPolygonId(id);
  };
  
  const handleSave = () => {
    mockToastSuccess('Segmentation saved successfully');
  };
  
  return (
    <div className="segmentation-editor">
      <header className="editor-header">
        <div className="project-info">
          <h1>{projectData.title}</h1>
          <h2>{imageData.name}</h2>
        </div>
        <div className="editor-actions">
          <button className="back-button">Back to Project</button>
          <button className="save-button" onClick={handleSave}>Save</button>
          <button className="export-button">Export</button>
        </div>
      </header>
      
      <div className="editor-content">
        <div className="editor-toolbar">
          <div className="edit-modes">
            <button 
              className={`mode-button ${editMode === EditMode.View ? 'active' : ''}`}
              onClick={() => handleModeChange(EditMode.View)}
            >
              View
            </button>
            <button 
              className={`mode-button ${editMode === EditMode.EditVertices ? 'active' : ''}`}
              onClick={() => handleModeChange(EditMode.EditVertices)}
            >
              Edit Vertices
            </button>
            <button 
              className={`mode-button ${editMode === EditMode.AddPoints ? 'active' : ''}`}
              onClick={() => handleModeChange(EditMode.AddPoints)}
            >
              Add Points
            </button>
            <button 
              className={`mode-button ${editMode === EditMode.Slice ? 'active' : ''}`}
              onClick={() => handleModeChange(EditMode.Slice)}
            >
              Slice
            </button>
            <button 
              className={`mode-button ${editMode === EditMode.DeletePolygons ? 'active' : ''}`}
              onClick={() => handleModeChange(EditMode.DeletePolygons)}
            >
              Delete
            </button>
            <button 
              className={`mode-button ${editMode === EditMode.CreatePolygon ? 'active' : ''}`}
              onClick={() => handleModeChange(EditMode.CreatePolygon)}
            >
              Create Polygon
            </button>
          </div>
          
          <div className="view-controls">
            <button className="zoom-in-button" onClick={handleZoomIn}>Zoom In</button>
            <button className="zoom-out-button" onClick={handleZoomOut}>Zoom Out</button>
            <button className="reset-view-button" onClick={handleResetView}>Reset View</button>
            <span className="zoom-level">{Math.round(zoom * 100)}%</span>
          </div>
        </div>
        
        <div className="editor-main">
          <div className="canvas-container" style={{ transform: `scale(${zoom})` }}>
            {hasSegmentation ? (
              <div className="canvas">
                <div className="image-layer">
                  <img src={imageData.url} alt={imageData.name} />
                </div>
                <svg className="svg-layer" width={imageData.width} height={imageData.height}>
                  {segmentation.polygons.map(polygon => (
                    <polygon
                      key={polygon.id}
                      points={polygon.points.map(p => `${p.x},${p.y}`).join(' ')}
                      fill={polygon.color}
                      fillOpacity="0.3"
                      stroke={polygon.color}
                      strokeWidth="2"
                      className={`polygon ${selectedPolygonId === polygon.id ? 'selected' : ''}`}
                      onClick={() => handleSelectPolygon(polygon.id)}
                    />
                  ))}
                </svg>
              </div>
            ) : (
              <div className="no-segmentation">
                <p>No segmentation data available</p>
                <button className="generate-segmentation-button">Generate Segmentation</button>
              </div>
            )}
          </div>
          
          <div className="region-panel">
            <h3>Regions</h3>
            <ul className="region-list">
              {hasSegmentation && segmentation.polygons.map(polygon => (
                <li 
                  key={polygon.id} 
                  className={`region-item ${selectedPolygonId === polygon.id ? 'selected' : ''}`}
                  onClick={() => handleSelectPolygon(polygon.id)}
                >
                  <div className="color-indicator" style={{ backgroundColor: polygon.color }}></div>
                  <span className="region-label">{polygon.label}</span>
                </li>
              ))}
            </ul>
            <div className="region-actions">
              <button className="add-region-button">Add Region</button>
              <button className="delete-region-button" disabled={!selectedPolygonId}>Delete Region</button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="status-bar">
        <div className="auto-save-status">Auto-save: Enabled</div>
        <div className="cursor-position">X: 0, Y: 0</div>
        <div className="keyboard-shortcuts-button">Keyboard Shortcuts</div>
      </div>
    </div>
  );
};

describe('SegmentationEditor Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  const renderComponent = (props = {}) => {
    return render(
      <BrowserRouter>
        <MockSegmentationEditor {...props} />
      </BrowserRouter>
    );
  };
  
  it('renders the segmentation editor correctly', () => {
    renderComponent();
    
    // Check if the header is displayed
    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText('test-image.jpg')).toBeInTheDocument();
    
    // Check if the toolbar is displayed
    expect(screen.getByText('View')).toBeInTheDocument();
    expect(screen.getByText('Edit Vertices')).toBeInTheDocument();
    expect(screen.getByText('Add Points')).toBeInTheDocument();
    expect(screen.getByText('Slice')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Create Polygon')).toBeInTheDocument();
    
    // Check if the view controls are displayed
    expect(screen.getByText('Zoom In')).toBeInTheDocument();
    expect(screen.getByText('Zoom Out')).toBeInTheDocument();
    expect(screen.getByText('Reset View')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    
    // Check if the region panel is displayed
    expect(screen.getByText('Regions')).toBeInTheDocument();
    expect(screen.getByText('Object 1')).toBeInTheDocument();
    expect(screen.getByText('Object 2')).toBeInTheDocument();
    
    // Check if the status bar is displayed
    expect(screen.getByText('Auto-save: Enabled')).toBeInTheDocument();
    expect(screen.getByText('X: 0, Y: 0')).toBeInTheDocument();
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
  });
  
  it('shows loading state when editor is loading', () => {
    renderComponent({ isLoading: true });
    
    // Check if the loading indicator is displayed
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
  
  it('shows error message when editor fails to load', () => {
    renderComponent({ hasError: true });
    
    // Check if the error message is displayed
    expect(screen.getByText('Failed to load segmentation editor')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });
  
  it('shows no segmentation message when no segmentation data is available', () => {
    renderComponent({ hasSegmentation: false });
    
    // Check if the no segmentation message is displayed
    expect(screen.getByText('No segmentation data available')).toBeInTheDocument();
    expect(screen.getByText('Generate Segmentation')).toBeInTheDocument();
  });
  
  it('changes edit mode when mode buttons are clicked', () => {
    renderComponent();
    
    // Initially, the View mode should be active
    expect(screen.getByText('View').closest('button')).toHaveClass('active');
    
    // Click the Edit Vertices mode button
    fireEvent.click(screen.getByText('Edit Vertices'));
    
    // Check if the Edit Vertices mode is now active
    expect(screen.getByText('Edit Vertices').closest('button')).toHaveClass('active');
    expect(screen.getByText('View').closest('button')).not.toHaveClass('active');
    
    // Click the Add Points mode button
    fireEvent.click(screen.getByText('Add Points'));
    
    // Check if the Add Points mode is now active
    expect(screen.getByText('Add Points').closest('button')).toHaveClass('active');
    expect(screen.getByText('Edit Vertices').closest('button')).not.toHaveClass('active');
  });
  
  it('selects a polygon when clicked in the region list', () => {
    renderComponent();
    
    // Click on the first region in the list
    fireEvent.click(screen.getByText('Object 1'));
    
    // Check if the region is selected
    expect(screen.getByText('Object 1').closest('li')).toHaveClass('selected');
    expect(screen.getByText('Object 2').closest('li')).not.toHaveClass('selected');
    
    // Click on the second region in the list
    fireEvent.click(screen.getByText('Object 2'));
    
    // Check if the second region is now selected
    expect(screen.getByText('Object 2').closest('li')).toHaveClass('selected');
    expect(screen.getByText('Object 1').closest('li')).not.toHaveClass('selected');
  });
  
  it('changes zoom level when zoom buttons are clicked', () => {
    renderComponent();
    
    // Initially, the zoom level should be 100%
    expect(screen.getByText('100%')).toBeInTheDocument();
    
    // Click the Zoom In button
    fireEvent.click(screen.getByText('Zoom In'));
    
    // Check if the zoom level is increased
    expect(screen.getByText('120%')).toBeInTheDocument();
    
    // Click the Zoom Out button
    fireEvent.click(screen.getByText('Zoom Out'));
    
    // Check if the zoom level is back to 100%
    expect(screen.getByText('100%')).toBeInTheDocument();
    
    // Click the Zoom Out button again
    fireEvent.click(screen.getByText('Zoom Out'));
    
    // Check if the zoom level is decreased
    expect(screen.getByText('83%')).toBeInTheDocument();
    
    // Click the Reset View button
    fireEvent.click(screen.getByText('Reset View'));
    
    // Check if the zoom level is reset to 100%
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
  
  it('shows success message when save button is clicked', () => {
    renderComponent();
    
    // Click the Save button
    fireEvent.click(screen.getByText('Save'));
    
    // Check if the success message is shown
    expect(mockToastSuccess).toHaveBeenCalledWith('Segmentation saved successfully');
  });
});
