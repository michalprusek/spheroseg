import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { ProjectDashboard } from '../../pages/project/ProjectDashboard';
import { AuthProvider } from '../../contexts/AuthContext';
import { ProjectProvider } from '../../contexts/ProjectContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { MemoryRouter, Route } from 'react-router-dom';

// Setup MSW server for API mocking
const server = setupServer(
  // Mock GET project endpoint
  rest.get('/api/projects/:projectId', (req, res, ctx) => {
    return res(
      ctx.json({
        id: req.params.projectId,
        name: 'Test Project',
        description: 'This is a test project',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-02T00:00:00.000Z',
        thumbnailUrl: '/uploads/thumbnail.jpg',
      }),
    );
  }),

  // Mock GET project images endpoint
  rest.get('/api/projects/:projectId/images', (req, res, ctx) => {
    return res(
      ctx.json([
        {
          id: 'image-1',
          name: 'Test Image 1',
          thumbnailPath: '/uploads/thumbnails/image1.jpg',
          width: 800,
          height: 600,
          status: 'completed',
          segmentationStatus: 'completed',
          createdAt: '2023-01-01T12:00:00.000Z',
        },
        {
          id: 'image-2',
          name: 'Test Image 2',
          thumbnailPath: '/uploads/thumbnails/image2.jpg',
          width: 1024,
          height: 768,
          status: 'completed',
          segmentationStatus: 'pending',
          createdAt: '2023-01-02T12:00:00.000Z',
        },
      ]),
    );
  }),

  // Mock POST to upload image
  rest.post('/api/projects/:projectId/images', (req, res, ctx) => {
    return res(
      ctx.json({
        id: 'new-image-id',
        name: 'Uploaded Image',
        thumbnailPath: '/uploads/thumbnails/new-image.jpg',
        status: 'completed',
      }),
    );
  }),

  // Mock DELETE image endpoint
  rest.delete('/api/images/:imageId', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        message: 'Image deleted successfully',
      }),
    );
  }),

  // Mock GET project stats endpoint
  rest.get('/api/projects/:projectId/stats', (req, res, ctx) => {
    return res(
      ctx.json({
        imageCount: 2,
        segmentedImageCount: 1,
        totalPolygonCount: 15,
        averagePolygonsPerImage: 7.5,
      }),
    );
  }),

  // Mock the auth endpoint
  rest.get('/api/auth/me', (req, res, ctx) => {
    return res(
      ctx.json({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
      }),
    );
  }),
);

// Start MSW server before tests
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Test the integration between frontend project components and backend API
describe('Project API Integration Tests', () => {
  const renderWithProviders = (ui: React.ReactElement, { route = '/projects/project-123' } = {}) => {
    return render(
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>
          <NotificationProvider>
            <ProjectProvider>
              <Route path="/projects/:projectId">{ui}</Route>
            </ProjectProvider>
          </NotificationProvider>
        </AuthProvider>
      </MemoryRouter>,
    );
  };

  it('should load and display project data from the API', async () => {
    // Render the project dashboard with providers
    renderWithProviders(<ProjectDashboard />);

    // Wait for the API data to load
    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    // Verify project description is displayed
    expect(screen.getByText('This is a test project')).toBeInTheDocument();

    // Verify images are displayed
    expect(screen.getByText('Test Image 1')).toBeInTheDocument();
    expect(screen.getByText('Test Image 2')).toBeInTheDocument();
  });

  it('should handle image upload through the API', async () => {
    // Create a spy to monitor API calls
    const uploadApiSpy = jest.fn();
    server.use(
      rest.post('/api/projects/:projectId/images', async (req, res, ctx) => {
        uploadApiSpy(req);
        return res(
          ctx.json({
            id: 'new-image-id',
            name: 'Uploaded Image',
            thumbnailPath: '/uploads/thumbnails/new-image.jpg',
            status: 'completed',
          }),
        );
      }),
    );

    // Render the project dashboard
    renderWithProviders(<ProjectDashboard />);

    // Wait for the component to load
    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    // Click the upload button
    const uploadButton = screen.getByRole('button', { name: /upload/i });
    userEvent.click(uploadButton);

    // In a real test, we would upload a file here
    // But for this test, we'll just check that the upload modal appears
    expect(screen.getByText(/upload.*image/i)).toBeInTheDocument();

    // Create a mock file and upload it
    const file = new File(['dummy content'], 'test-file.jpg', {
      type: 'image/jpeg',
    });
    const fileInput = screen.getByLabelText(/choose.*file/i);
    userEvent.upload(fileInput, file);

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /submit|upload/i });
    userEvent.click(submitButton);

    // Verify the API was called
    await waitFor(() => {
      expect(uploadApiSpy).toHaveBeenCalled();
    });

    // Verify the new image appears in the list
    await waitFor(() => {
      expect(screen.getByText('Uploaded Image')).toBeInTheDocument();
    });
  });

  it('should handle image deletion through the API', async () => {
    // Create a spy to monitor API calls
    const deleteApiSpy = jest.fn();
    server.use(
      rest.delete('/api/images/:imageId', (req, res, ctx) => {
        deleteApiSpy(req.params.imageId);
        return res(
          ctx.json({
            success: true,
            message: 'Image deleted successfully',
          }),
        );
      }),
    );

    // Render the project dashboard
    renderWithProviders(<ProjectDashboard />);

    // Wait for the component to load
    await waitFor(() => {
      expect(screen.getByText('Test Image 1')).toBeInTheDocument();
    });

    // Click the delete button for the first image
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    userEvent.click(deleteButtons[0]);

    // Confirm deletion in the modal
    const confirmButton = await screen.findByRole('button', {
      name: /confirm|yes|delete/i,
    });
    userEvent.click(confirmButton);

    // Verify the API was called
    await waitFor(() => {
      expect(deleteApiSpy).toHaveBeenCalledWith('image-1');
    });

    // Verify success notification
    expect(screen.getByText(/successfully deleted/i)).toBeInTheDocument();
  });

  it('should display project statistics from the API', async () => {
    // Render the project dashboard
    renderWithProviders(<ProjectDashboard />);

    // Wait for the component to load
    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    // Click on the statistics tab or button
    const statsButton =
      screen.getByRole('tab', { name: /statistics|stats/i }) ||
      screen.getByRole('button', { name: /statistics|stats/i });
    userEvent.click(statsButton);

    // Verify statistics data is displayed
    await waitFor(() => {
      expect(screen.getByText(/total.*images.*2/i)).toBeInTheDocument();
      expect(screen.getByText(/segmented.*images.*1/i)).toBeInTheDocument();
      expect(screen.getByText(/total.*polygons.*15/i)).toBeInTheDocument();
    });
  });

  it('should handle API errors gracefully', async () => {
    // Mock API error for project data
    server.use(
      rest.get('/api/projects/:projectId', (req, res, ctx) => {
        return res(
          ctx.status(500),
          ctx.json({
            error: 'Internal server error',
            message: 'Failed to load project data',
          }),
        );
      }),
    );

    // Render the project dashboard
    renderWithProviders(<ProjectDashboard />);

    // Verify error message is displayed
    await waitFor(() => {
      expect(screen.getByText(/failed to load project/i)).toBeInTheDocument();
    });
  });

  it('should navigate to segmentation editor when opening an image', async () => {
    // Mock router history
    const mockHistoryPush = jest.fn();
    jest.mock('react-router-dom', () => ({
      ...jest.requireActual('react-router-dom'),
      useHistory: () => ({
        push: mockHistoryPush,
      }),
    }));

    // Render the project dashboard
    renderWithProviders(<ProjectDashboard />);

    // Wait for the component to load
    await waitFor(() => {
      expect(screen.getByText('Test Image 1')).toBeInTheDocument();
    });

    // Click on the first image
    const imageCard =
      screen.getByText('Test Image 1').closest('.image-card') ||
      screen.getByText('Test Image 1').closest('[data-testid="image-card"]') ||
      screen.getByText('Test Image 1').closest('div');
    userEvent.click(imageCard);

    // Verify navigation to segmentation editor
    expect(window.location.pathname).toContain('/segmentation');
  });

  it('should handle real-time updates through WebSocket', async () => {
    // Mock WebSocket events
    const mockSocket = {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    };

    // Mock the useSocket hook
    jest.mock('../../hooks/useSocket', () => ({
      useSocket: () => ({
        socket: mockSocket,
        isConnected: true,
      }),
    }));

    // Render the project dashboard
    renderWithProviders(<ProjectDashboard />);

    // Wait for the component to load
    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    // Verify WebSocket listeners are registered
    expect(mockSocket.on).toHaveBeenCalledWith('image_update', expect.any(Function));

    // Simulate WebSocket event for image update
    const imageUpdateHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'image_update')[1];

    imageUpdateHandler({
      projectId: 'project-123',
      imageId: 'image-2',
      status: 'completed',
      segmentationStatus: 'completed',
    });

    // Verify UI was updated to show the new status
    await waitFor(() => {
      const imageElements = screen.getAllByText(/completed/i);
      expect(imageElements.length).toBeGreaterThan(1);
    });
  });
});
