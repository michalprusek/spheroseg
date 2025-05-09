import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SegmentationEditorV2 } from '../../components/SegmentationEditorV2';
import { Point, EditMode } from '@spheroseg/types';
import { MockApiClientProvider } from '../../../../lib/__mocks__/enhanced/apiClient';
import { createTestPolygonSet, createMockImageData } from '../../../../__tests__/fixtures/polygonFixtures';

// Mocking browser APIs and libraries
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ projectId: 'project-1', imageId: 'image-1' }),
    useNavigate: () => vi.fn()
  };
});

// Mock canvas
const originalCreateElement = document.createElement.bind(document);
document.createElement = (tagName: string, options?: ElementCreationOptions) => {
  if (tagName.toLowerCase() === 'canvas') {
    const canvas = originalCreateElement(tagName, options);
    // Mock canvas methods
    canvas.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillRect: vi.fn(),
      rect: vi.fn(),
      arc: vi.fn(),
      ellipse: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 10 }),
      setTransform: vi.fn()
    });
    return canvas;
  }
  return originalCreateElement(tagName, options);
};

// Helper function to simulate canvas events
function createCanvasEvent(
  canvas: HTMLElement,
  eventType: string,
  x: number,
  y: number,
  options: any = {}
) {
  const rect = { left: 0, top: 0, width: 1024, height: 768 };
  
  // Create a synthetic event
  const event = new MouseEvent(eventType, {
    bubbles: true,
    cancelable: true,
    clientX: rect.left + x,
    clientY: rect.top + y,
    ...options
  });
  
  // Override getBoundingClientRect for the canvas element
  const originalGetBoundingClientRect = canvas.getBoundingClientRect;
  canvas.getBoundingClientRect = () => rect as DOMRect;
  
  // Fire the event
  fireEvent(canvas, event);
  
  // Restore original method
  canvas.getBoundingClientRect = originalGetBoundingClientRect;
  
  return event;
}

describe('SegmentationEditorV2 Edge Cases', () => {
  const mockImageData = createMockImageData();
  const mockPolygons = createTestPolygonSet();
  
  beforeEach(() => {
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });
  
  describe('Empty Segmentation', () => {
    it('should handle images with no segmentation data', async () => {
      render(
        <MockApiClientProvider
          mockResponses={{
            getSegmentation: {
              data: { polygons: [] },
              status: 200
            }
          }}
        >
          <SegmentationEditorV2 />
        </MockApiClientProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByText(/no segmentation data/i)).toBeInTheDocument();
      });
      
      // Verify the create button is enabled
      const createButton = screen.getByRole('button', { name: /create/i });
      expect(createButton).toBeEnabled();
    });
  });
  
  describe('Very Large Segmentation', () => {
    it('should handle images with an extremely large number of polygons', async () => {
      // Create a large number of polygons (would be slow in real app)
      const largePolygonSet = Array(1000).fill(null).map(() => ({
        points: [
          { x: Math.random() * 1000, y: Math.random() * 700 },
          { x: Math.random() * 1000, y: Math.random() * 700 },
          { x: Math.random() * 1000, y: Math.random() * 700 },
          { x: Math.random() * 1000, y: Math.random() * 700 }
        ],
        closed: true,
        color: '#FF0000'
      }));
      
      render(
        <MockApiClientProvider
          mockResponses={{
            getSegmentation: {
              data: { polygons: largePolygonSet },
              status: 200
            }
          }}
        >
          <SegmentationEditorV2 />
        </MockApiClientProvider>
      );
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
      
      // Check that polygon count is displayed correctly
      expect(screen.getByText(/1000 polygons/i)).toBeInTheDocument();
    });
  });
  
  describe('Invalid Polygon Data', () => {
    it('should handle polygons with invalid coordinates', async () => {
      const invalidPolygons = [
        {
          points: [
            { x: NaN, y: 100 },
            { x: 200, y: 100 },
            { x: 200, y: 200 },
            { x: 100, y: 200 }
          ],
          closed: true,
          color: '#FF0000'
        },
        {
          points: [
            { x: Infinity, y: 300 },
            { x: 400, y: 300 },
            { x: 350, y: 400 }
          ],
          closed: true,
          color: '#00FF00'
        }
      ];
      
      render(
        <MockApiClientProvider
          mockResponses={{
            getSegmentation: {
              data: { polygons: invalidPolygons },
              status: 200
            }
          }}
        >
          <SegmentationEditorV2 />
        </MockApiClientProvider>
      );
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
      
      // Should show error message about invalid data
      expect(screen.getByText(/invalid polygon data/i)).toBeInTheDocument();
    });
    
    it('should handle polygons with too few points', async () => {
      const invalidPolygons = [
        {
          points: [
            { x: 100, y: 100 }
          ],
          closed: true,
          color: '#FF0000'
        },
        {
          points: [
            { x: 300, y: 300 },
            { x: 400, y: 300 }
          ],
          closed: true,
          color: '#00FF00'
        }
      ];
      
      render(
        <MockApiClientProvider
          mockResponses={{
            getSegmentation: {
              data: { polygons: invalidPolygons },
              status: 200
            }
          }}
        >
          <SegmentationEditorV2 />
        </MockApiClientProvider>
      );
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
      
      // Should show error message about invalid polygons
      expect(screen.getByText(/invalid polygon data/i)).toBeInTheDocument();
    });
  });
  
  describe('Network Failures', () => {
    it('should handle failure to load segmentation data', async () => {
      render(
        <MockApiClientProvider
          mockResponses={{
            getSegmentation: {
              error: new Error('Network error'),
              status: 500
            }
          }}
        >
          <SegmentationEditorV2 />
        </MockApiClientProvider>
      );
      
      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/failed to load segmentation data/i)).toBeInTheDocument();
      });
      
      // Should show retry button
      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
      
      // Mock successful response for retry
      MockApiClientProvider.setMockResponse('getSegmentation', {
        data: { polygons: mockPolygons },
        status: 200
      });
      
      // Click retry
      fireEvent.click(retryButton);
      
      // Should now load successfully
      await waitFor(() => {
        expect(screen.queryByText(/failed to load/i)).not.toBeInTheDocument();
      });
    });
    
    it('should handle failure to save segmentation data', async () => {
      render(
        <MockApiClientProvider
          mockResponses={{
            getSegmentation: {
              data: { polygons: mockPolygons },
              status: 200
            },
            saveSegmentation: {
              error: new Error('Network error'),
              status: 500
            }
          }}
        >
          <SegmentationEditorV2 />
        </MockApiClientProvider>
      );
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
      
      // Click save button
      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);
      
      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/failed to save/i)).toBeInTheDocument();
      });
      
      // Should show retry save button
      const retrySaveButton = screen.getByRole('button', { name: /retry save/i });
      expect(retrySaveButton).toBeInTheDocument();
      
      // Mock successful response for retry
      MockApiClientProvider.setMockResponse('saveSegmentation', {
        data: { success: true },
        status: 200
      });
      
      // Click retry save
      fireEvent.click(retrySaveButton);
      
      // Should now save successfully
      await waitFor(() => {
        expect(screen.getByText(/saved successfully/i)).toBeInTheDocument();
      });
    });
  });
  
  describe('Canvas Interaction Edge Cases', () => {
    it('should handle rapid creation of multiple points', async () => {
      render(
        <MockApiClientProvider
          mockResponses={{
            getSegmentation: {
              data: { polygons: [] },
              status: 200
            }
          }}
        >
          <SegmentationEditorV2 />
        </MockApiClientProvider>
      );
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
      
      // Switch to create mode
      const createButton = screen.getByRole('button', { name: /create/i });
      fireEvent.click(createButton);
      
      // Get canvas element
      const canvas = screen.getByTestId('segmentation-canvas');
      
      // Rapidly create multiple points
      const points = [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
        { x: 200, y: 200 },
        { x: 100, y: 200 },
        { x: 100, y: 100 } // Close the polygon
      ];
      
      for (const point of points) {
        createCanvasEvent(canvas, 'mousedown', point.x, point.y);
        createCanvasEvent(canvas, 'mouseup', point.x, point.y);
      }
      
      // Should have created a polygon
      expect(screen.getByText(/1 polygon/i)).toBeInTheDocument();
    });
    
    it('should handle attempt to create self-intersecting polygon', async () => {
      render(
        <MockApiClientProvider
          mockResponses={{
            getSegmentation: {
              data: { polygons: [] },
              status: 200
            }
          }}
        >
          <SegmentationEditorV2 />
        </MockApiClientProvider>
      );
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
      
      // Switch to create mode
      const createButton = screen.getByRole('button', { name: /create/i });
      fireEvent.click(createButton);
      
      // Get canvas element
      const canvas = screen.getByTestId('segmentation-canvas');
      
      // Create a self-intersecting polygon
      const points = [
        { x: 100, y: 100 },
        { x: 300, y: 100 },
        { x: 100, y: 300 },
        { x: 300, y: 300 },
        { x: 100, y: 100 } // Close the polygon
      ];
      
      for (const point of points) {
        createCanvasEvent(canvas, 'mousedown', point.x, point.y);
        createCanvasEvent(canvas, 'mouseup', point.x, point.y);
      }
      
      // Should show warning about self-intersection
      expect(screen.getByText(/self-intersecting polygon/i)).toBeInTheDocument();
    });
    
    it('should handle extremely large image scales', async () => {
      render(
        <MockApiClientProvider
          mockResponses={{
            getSegmentation: {
              data: { polygons: mockPolygons },
              status: 200
            }
          }}
        >
          <SegmentationEditorV2 />
        </MockApiClientProvider>
      );
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
      
      // Get zoom in button
      const zoomInButton = screen.getByRole('button', { name: /zoom in/i });
      
      // Zoom in multiple times to reach very high scale
      for (let i = 0; i < 10; i++) {
        fireEvent.click(zoomInButton);
      }
      
      // Verify zoom level is displayed correctly
      expect(screen.getByText(/zoom: 1000%/i)).toBeInTheDocument();
    });
    
    it('should handle extremely small image scales', async () => {
      render(
        <MockApiClientProvider
          mockResponses={{
            getSegmentation: {
              data: { polygons: mockPolygons },
              status: 200
            }
          }}
        >
          <SegmentationEditorV2 />
        </MockApiClientProvider>
      );
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
      
      // Get zoom out button
      const zoomOutButton = screen.getByRole('button', { name: /zoom out/i });
      
      // Zoom out multiple times to reach very low scale
      for (let i = 0; i < 10; i++) {
        fireEvent.click(zoomOutButton);
      }
      
      // Verify zoom level is displayed correctly
      expect(screen.getByText(/zoom: 10%/i)).toBeInTheDocument();
    });
  });
  
  describe('Undo/Redo Functionality', () => {
    it('should handle complex undo/redo operations', async () => {
      render(
        <MockApiClientProvider
          mockResponses={{
            getSegmentation: {
              data: { polygons: mockPolygons },
              status: 200
            }
          }}
        >
          <SegmentationEditorV2 />
        </MockApiClientProvider>
      );
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
      
      // Initial count
      expect(screen.getByText(/3 polygons/i)).toBeInTheDocument();
      
      // Delete a polygon
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);
      
      // Should now have 2 polygons
      expect(screen.getByText(/2 polygons/i)).toBeInTheDocument();
      
      // Undo deletion
      const undoButton = screen.getByRole('button', { name: /undo/i });
      fireEvent.click(undoButton);
      
      // Should be back to 3 polygons
      expect(screen.getByText(/3 polygons/i)).toBeInTheDocument();
      
      // Redo deletion
      const redoButton = screen.getByRole('button', { name: /redo/i });
      fireEvent.click(redoButton);
      
      // Should be back to 2 polygons
      expect(screen.getByText(/2 polygons/i)).toBeInTheDocument();
      
      // Switch to create mode
      const createButton = screen.getByRole('button', { name: /create/i });
      fireEvent.click(createButton);
      
      // Create a new polygon
      const canvas = screen.getByTestId('segmentation-canvas');
      const points = [
        { x: 400, y: 400 },
        { x: 500, y: 400 },
        { x: 500, y: 500 },
        { x: 400, y: 500 },
        { x: 400, y: 400 } // Close the polygon
      ];
      
      for (const point of points) {
        createCanvasEvent(canvas, 'mousedown', point.x, point.y);
        createCanvasEvent(canvas, 'mouseup', point.x, point.y);
      }
      
      // Should have 3 polygons again
      expect(screen.getByText(/3 polygons/i)).toBeInTheDocument();
      
      // Multiple undos
      fireEvent.click(undoButton); // Undo create
      fireEvent.click(undoButton); // Undo deletion
      
      // Should be back to 3 original polygons
      expect(screen.getByText(/3 polygons/i)).toBeInTheDocument();
      
      // Multiple redos
      fireEvent.click(redoButton); // Redo deletion
      fireEvent.click(redoButton); // Redo create
      
      // Should have 3 polygons (2 original + 1 new)
      expect(screen.getByText(/3 polygons/i)).toBeInTheDocument();
    });
    
    it('should maintain proper undo/redo stack limits', async () => {
      render(
        <MockApiClientProvider
          mockResponses={{
            getSegmentation: {
              data: { polygons: [] },
              status: 200
            }
          }}
        >
          <SegmentationEditorV2 />
        </MockApiClientProvider>
      );
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
      
      // Switch to create mode
      const createButton = screen.getByRole('button', { name: /create/i });
      fireEvent.click(createButton);
      
      // Create many polygons to exceed typical undo stack limit
      const canvas = screen.getByTestId('segmentation-canvas');
      
      // Create 50 simple polygons
      for (let i = 0; i < 50; i++) {
        const offsetX = (i % 10) * 100;
        const offsetY = Math.floor(i / 10) * 100;
        
        const points = [
          { x: offsetX, y: offsetY },
          { x: offsetX + 50, y: offsetY },
          { x: offsetX + 50, y: offsetY + 50 },
          { x: offsetX, y: offsetY + 50 },
          { x: offsetX, y: offsetY } // Close the polygon
        ];
        
        for (const point of points) {
          createCanvasEvent(canvas, 'mousedown', point.x, point.y);
          createCanvasEvent(canvas, 'mouseup', point.x, point.y);
        }
      }
      
      // Should have 50 polygons
      expect(screen.getByText(/50 polygons/i)).toBeInTheDocument();
      
      const undoButton = screen.getByRole('button', { name: /undo/i });
      
      // Try to undo all 50 actions
      for (let i = 0; i < 50; i++) {
        fireEvent.click(undoButton);
      }
      
      // Should have 0 polygons after all undos
      expect(screen.getByText(/0 polygons/i)).toBeInTheDocument();
    });
  });
  
  describe('Keyboard Shortcuts', () => {
    it('should handle keyboard shortcuts even during rapid typing', async () => {
      const user = userEvent.setup({ delay: 1 });
      
      render(
        <MockApiClientProvider
          mockResponses={{
            getSegmentation: {
              data: { polygons: mockPolygons },
              status: 200
            }
          }}
        >
          <SegmentationEditorV2 />
        </MockApiClientProvider>
      );
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
      
      // Rapidly press keys
      await user.keyboard('{Ctrl>}z{/Ctrl}'); // Undo
      await user.keyboard('{Ctrl>}y{/Ctrl}'); // Redo
      await user.keyboard('v'); // View mode
      await user.keyboard('c'); // Create mode
      await user.keyboard('e'); // Edit mode
      await user.keyboard('{Delete}'); // Delete polygon
      
      // Test that keyboard shortcuts worked
      expect(screen.getByText(/edit mode/i)).toBeInTheDocument();
    });
  });
  
  describe('Multiple Operations', () => {
    it('should handle multiple operations in rapid succession', async () => {
      render(
        <MockApiClientProvider
          mockResponses={{
            getSegmentation: {
              data: { polygons: mockPolygons },
              status: 200
            }
          }}
        >
          <SegmentationEditorV2 />
        </MockApiClientProvider>
      );
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
      
      // Get UI elements
      const canvas = screen.getByTestId('segmentation-canvas');
      const createButton = screen.getByRole('button', { name: /create/i });
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      const undoButton = screen.getByRole('button', { name: /undo/i });
      
      // Perform rapid operations
      fireEvent.click(createButton); // Switch to create
      
      // Create a polygon
      const points = [
        { x: 400, y: 400 },
        { x: 500, y: 400 },
        { x: 500, y: 500 },
        { x: 400, y: 500 },
        { x: 400, y: 400 } // Close the polygon
      ];
      
      for (const point of points) {
        createCanvasEvent(canvas, 'mousedown', point.x, point.y);
        createCanvasEvent(canvas, 'mouseup', point.x, point.y);
      }
      
      // Select and delete
      createCanvasEvent(canvas, 'mousedown', 450, 450);
      createCanvasEvent(canvas, 'mouseup', 450, 450);
      fireEvent.click(deleteButton);
      
      // Undo deletion
      fireEvent.click(undoButton);
      
      // Should still have 4 polygons (3 original + 1 newly created)
      expect(screen.getByText(/4 polygons/i)).toBeInTheDocument();
    });
  });
});