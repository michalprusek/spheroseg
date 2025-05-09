import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { SegmentationEditor } from '../../pages/segmentation/SegmentationEditor';
import { AuthProvider } from '../../contexts/AuthContext';
import { SegmentationProvider } from '../../contexts/SegmentationContext';
import { ProjectProvider } from '../../contexts/ProjectContext';
import { NotificationProvider } from '../../contexts/NotificationContext';

// Setup MSW server for API mocking
const server = setupServer(
  // Mock GET segmentation data endpoint
  rest.get('/api/segmentation/:id', (req, res, ctx) => {
    return res(
      ctx.json({
        id: req.params.id,
        polygons: [
          {
            id: 'polygon-1',
            type: 'external',
            points: [
              [100, 100],
              [200, 100],
              [200, 200],
              [100, 200],
              [100, 100]
            ],
            properties: {
              color: '#ff0000',
              label: 'Test Polygon'
            }
          }
        ],
        imageInfo: {
          id: 'image-1',
          width: 800,
          height: 600,
          url: '/uploads/test-image.jpg'
        },
        status: 'completed'
      })
    );
  }),
  
  // Mock POST to save segmentation
  rest.post('/api/segmentation/:id', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        id: req.params.id,
        message: 'Segmentation saved successfully'
      })
    );
  }),
  
  // Mock POST to auto-segment
  rest.post('/api/segmentation/:id/auto', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        message: 'Auto-segmentation started',
        taskId: 'task-123'
      })
    );
  }),
  
  // Mock GET for segmentation task status
  rest.get('/api/segmentation/task/:taskId', (req, res, ctx) => {
    return res(
      ctx.json({
        status: 'completed',
        progress: 100,
        result: {
          polygons: [
            {
              id: 'auto-polygon-1',
              type: 'external',
              points: [
                [300, 300],
                [400, 300],
                [400, 400],
                [300, 400],
                [300, 300]
              ]
            }
          ]
        }
      })
    );
  }),
  
  // Mock project endpoint for context
  rest.get('/api/projects/:projectId', (req, res, ctx) => {
    return res(
      ctx.json({
        id: req.params.projectId,
        name: 'Test Project',
        description: 'Project for testing'
      })
    );
  }),
  
  // Mock the auth endpoint
  rest.get('/api/auth/me', (req, res, ctx) => {
    return res(
      ctx.json({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User'
      })
    );
  })
);

// Start MSW server before tests
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Mock WebSocket events
const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn()
};

// Mock the useSocket hook
jest.mock('../../hooks/useSocket', () => ({
  useSocket: () => ({
    socket: mockSocket,
    isConnected: true
  })
}));

// Skip actual canvas rendering which is hard to test
jest.mock('../../components/Canvas', () => ({
  Canvas: jest.fn(() => <div data-testid="mock-canvas">Canvas Mock</div>)
}));

// Test the integration between frontend components and backend API
describe('Polygon API Integration Tests', () => {
  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <AuthProvider>
        <ProjectProvider>
          <NotificationProvider>
            <SegmentationProvider>
              {ui}
            </SegmentationProvider>
          </NotificationProvider>
        </ProjectProvider>
      </AuthProvider>
    );
  };
  
  it('should load and display segmentation data from the API', async () => {
    // Render the segmentation editor with providers
    renderWithProviders(
      <SegmentationEditor 
        match={{ params: { id: 'segmentation-123', projectId: 'project-123' } }} 
      />
    );
    
    // Wait for the API data to load
    await waitFor(() => {
      expect(screen.getByTestId('mock-canvas')).toBeInTheDocument();
    });
    
    // Verify polygon data was loaded
    expect(screen.getByText(/Test Polygon/i)).toBeInTheDocument();
  });
  
  it('should save segmentation data to the API', async () => {
    // Create a spy to monitor API calls
    const saveApiSpy = jest.fn();
    server.use(
      rest.post('/api/segmentation/:id', (req, res, ctx) => {
        saveApiSpy(req.body);
        return res(ctx.json({ success: true }));
      })
    );
    
    // Render the segmentation editor
    renderWithProviders(
      <SegmentationEditor 
        match={{ params: { id: 'segmentation-123', projectId: 'project-123' } }} 
      />
    );
    
    // Wait for the component to load
    await waitFor(() => {
      expect(screen.getByTestId('mock-canvas')).toBeInTheDocument();
    });
    
    // Click the save button
    const saveButton = screen.getByRole('button', { name: /save/i });
    userEvent.click(saveButton);
    
    // Verify API was called with correct data
    await waitFor(() => {
      expect(saveApiSpy).toHaveBeenCalled();
      expect(saveApiSpy.mock.calls[0][0]).toHaveProperty('polygons');
    });
  });
  
  it('should handle auto-segmentation API flow', async () => {
    // Spy on the auto-segment API call
    const autoSegmentSpy = jest.fn();
    server.use(
      rest.post('/api/segmentation/:id/auto', (req, res, ctx) => {
        autoSegmentSpy(req.body);
        return res(
          ctx.json({
            success: true,
            message: 'Auto-segmentation started',
            taskId: 'task-123'
          })
        );
      })
    );
    
    // Render the segmentation editor
    renderWithProviders(
      <SegmentationEditor 
        match={{ params: { id: 'segmentation-123', projectId: 'project-123' } }} 
      />
    );
    
    // Wait for the component to load
    await waitFor(() => {
      expect(screen.getByTestId('mock-canvas')).toBeInTheDocument();
    });
    
    // Click the auto-segment button
    const autoSegmentButton = screen.getByRole('button', { name: /auto[- ]?segment/i });
    userEvent.click(autoSegmentButton);
    
    // Confirm the auto-segmentation in the modal
    const confirmButton = await screen.findByRole('button', { name: /confirm/i });
    userEvent.click(confirmButton);
    
    // Verify the API was called
    await waitFor(() => {
      expect(autoSegmentSpy).toHaveBeenCalled();
    });
    
    // Simulate WebSocket event for segmentation completion
    const segmentationUpdateHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'segmentation_update'
    )[1];
    
    segmentationUpdateHandler({
      imageId: 'image-1',
      status: 'completed',
      resultPath: '/uploads/segmentations/result.json'
    });
    
    // Verify the UI was updated with success notification
    await waitFor(() => {
      expect(screen.getByText(/segmentation.*completed/i)).toBeInTheDocument();
    });
  });
  
  it('should handle API errors gracefully', async () => {
    // Mock API error
    server.use(
      rest.get('/api/segmentation/:id', (req, res, ctx) => {
        return res(
          ctx.status(500),
          ctx.json({
            error: 'Internal server error',
            message: 'Failed to load segmentation data'
          })
        );
      })
    );
    
    // Render the segmentation editor
    renderWithProviders(
      <SegmentationEditor 
        match={{ params: { id: 'segmentation-123', projectId: 'project-123' } }} 
      />
    );
    
    // Verify error message is displayed
    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });
  
  it('should synchronize polygon selection between frontend and backend', async () => {
    // Spy on API calls with selection data
    const selectionApiSpy = jest.fn();
    server.use(
      rest.post('/api/segmentation/:id/selection', (req, res, ctx) => {
        selectionApiSpy(req.body);
        return res(ctx.json({ success: true }));
      })
    );
    
    // Render the segmentation editor
    renderWithProviders(
      <SegmentationEditor 
        match={{ params: { id: 'segmentation-123', projectId: 'project-123' } }} 
      />
    );
    
    // Wait for the component to load
    await waitFor(() => {
      expect(screen.getByTestId('mock-canvas')).toBeInTheDocument();
    });
    
    // Trigger polygon selection (since we can't directly interact with mocked canvas)
    // We'll use the SegmentationContext to simulate selection
    const selectPolygonButton = screen.getByRole('button', { name: /select/i });
    userEvent.click(selectPolygonButton);
    
    // Click on specific polygon in the list
    const polygonItem = await screen.findByText(/Test Polygon/i);
    userEvent.click(polygonItem);
    
    // Verify API was called with selection data
    await waitFor(() => {
      expect(selectionApiSpy).toHaveBeenCalled();
      expect(selectionApiSpy.mock.calls[0][0]).toHaveProperty('selectedPolygonIds');
      expect(selectionApiSpy.mock.calls[0][0].selectedPolygonIds).toContain('polygon-1');
    });
  });
});