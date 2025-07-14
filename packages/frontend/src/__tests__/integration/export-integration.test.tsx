import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import '@testing-library/jest-dom';
import ProjectExport from '@/pages/export/ProjectExport';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { vi } from 'vitest';
import { saveAs } from 'file-saver';

// Mock file-saver
vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

// Mock JSZip
vi.mock('jszip', () => {
  return {
    default: vi.fn().mockImplementation(() => {
      const folders = {};
      const files = {};

      return {
        folder: (name) => {
          folders[name] = { files: {} };
          return {
            file: (filename, content) => {
              folders[name].files[filename] = content;
            },
            folder: (subName) => {
              const subFolderName = `${name}/${subName}`;
              folders[subFolderName] = { files: {} };
              return {
                file: (filename, content) => {
                  folders[subFolderName].files[filename] = content;
                },
              };
            },
          };
        },
        file: (name, content) => {
          files[name] = content;
        },
        generateAsync: async () => Buffer.from('mock-zip-content'),
        files: { ...files },
        folders: { ...folders },
      };
    }),
  };
});

// Mock data
const mockProject = {
  id: 'test-project-id',
  title: 'Test Project',
  description: 'Test project description',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  user_id: 'test-user-id',
};

const mockImages = [
  {
    id: 'test-image-id-1',
    name: 'test-image-1.jpg',
    url: 'https://example.com/test-image-1.jpg',
    thumbnail_url: 'https://example.com/test-image-1-thumb.jpg',
    width: 800,
    height: 600,
    status: 'completed',
    project_id: 'test-project-id',
    segmentationResult: {
      polygons: [
        {
          id: 'poly-1',
          type: 'external',
          points: [
            { x: 100, y: 100 },
            { x: 200, y: 100 },
            { x: 200, y: 200 },
            { x: 100, y: 200 },
          ],
        },
      ],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'test-image-id-2',
    name: 'test-image-2.jpg',
    url: 'https://example.com/test-image-2.jpg',
    thumbnail_url: 'https://example.com/test-image-2-thumb.jpg',
    width: 1024,
    height: 768,
    status: 'completed',
    project_id: 'test-project-id',
    segmentationResult: {
      polygons: [
        {
          id: 'poly-2',
          type: 'external',
          points: [
            { x: 300, y: 300 },
            { x: 400, y: 300 },
            { x: 400, y: 400 },
            { x: 300, y: 400 },
          ],
        },
      ],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Set up MSW server
const server = setupServer(
  // Get project details
  http.get('/api/projects/:projectId', () => {
    return HttpResponse.json(mockProject);
  }),

  // Get project images
  http.get('/api/projects/:projectId/images', () => {
    return HttpResponse.json({ images: mockImages, total: mockImages.length });
  }),

  // Get segmentation results for each image
  http.get('/api/images/:imageId/segmentation', ({ params }) => {
    const imageId = params.imageId as string;
    const image = mockImages.find((img) => img.id === imageId);

    if (image?.segmentationResult) {
      return HttpResponse.json({
        id: `segmentation-${imageId}`,
        image_id: imageId,
        status: 'completed',
        result_data: image.segmentationResult,
      });
    }

    return new HttpResponse(null, { status: 404 });
  }),

  // Export project
  http.get('/api/projects/:projectId/export', () => {
    return new HttpResponse('mock-zip-data', {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename=project-export.zip',
      },
    });
  }),

  // Export metrics only
  rest.get('/api/projects/:projectId/export/metrics', (req, res, ctx) => {
    const format = req.url.searchParams.get('format') || 'EXCEL';

    if (format === 'EXCEL') {
      return res(
        ctx.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
        ctx.set('Content-Disposition', 'attachment; filename=metrics.xlsx'),
        ctx.body('mock-excel-data'),
      );
    } else if (format === 'CSV') {
      return res(
        ctx.set('Content-Type', 'text/csv'),
        ctx.set('Content-Disposition', 'attachment; filename=metrics.csv'),
        ctx.body('Image Name,Image ID,Object ID,Area\ntest-image-1.jpg,test-image-id-1,1,10000'),
      );
    }

    return res(ctx.status(400));
  }),
);

// Set up context mocks
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key) => key, // Simple translation mock
    setLanguage: vi.fn(),
    language: 'en',
  }),
}));

// Mock auth context
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', name: 'Test User' },
    isAuthenticated: true,
  }),
}));

// Start MSW server before tests
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const renderWithRouter = (ui, { route = '/projects/test-project-id/export' } = {}) => {
  window.history.pushState({}, 'Test page', route);
  return render(
    <BrowserRouter>
      <Routes>
        <Route path="/projects/:projectId/export" element={ui} />
      </Routes>
    </BrowserRouter>,
  );
};

describe('Export Integration Tests', () => {
  test('should load project and images on component mount', async () => {
    renderWithRouter(<ProjectExport />);

    // Wait for project title to load
    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    // Images should be loaded and displayed
    await waitFor(() => {
      expect(screen.getByText('test-image-1.jpg')).toBeInTheDocument();
      expect(screen.getByText('test-image-2.jpg')).toBeInTheDocument();
    });
  });

  test('should export project with all options', async () => {
    renderWithRouter(<ProjectExport />);

    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    // Select all export options
    const metadataCheckbox = screen.getByLabelText(/include.metadata/i);
    const segmentationCheckbox = screen.getByLabelText(/include.segmentation/i);
    const metricsCheckbox = screen.getByLabelText(/include.object.metrics/i);
    const imagesCheckbox = screen.getByLabelText(/include.images/i);

    fireEvent.click(metadataCheckbox);
    fireEvent.click(segmentationCheckbox);
    fireEvent.click(metricsCheckbox);
    fireEvent.click(imagesCheckbox);

    // Wait for select elements to be available after clicking checkboxes
    await waitFor(() => {
      expect(screen.getByText(/select.export.format/i)).toBeInTheDocument();
    });

    // Select export format (COCO)
    const formatSelect = screen.getByText(/select.export.format/i);
    fireEvent.click(formatSelect);
    await waitFor(() => {
      expect(screen.getByText('COCO')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('COCO'));

    // Click the export button
    const exportButton = screen.getByText(/export.project/i);
    fireEvent.click(exportButton);

    // Wait for the export to complete
    await waitFor(() => {
      expect(saveAs).toHaveBeenCalled();
    });
  });

  test('should export metrics in Excel format', async () => {
    renderWithRouter(<ProjectExport />);

    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    // Enable metrics export
    const metricsCheckbox = screen.getByLabelText(/include.object.metrics/i);
    fireEvent.click(metricsCheckbox);

    // Wait for metrics format selection to be available
    await waitFor(() => {
      expect(screen.getByText(/select.metrics.format/i)).toBeInTheDocument();
    });

    // Select Excel format
    const formatSelect = screen.getByText(/select.metrics.format/i);
    fireEvent.click(formatSelect);
    await waitFor(() => {
      expect(screen.getByText('EXCEL')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('EXCEL'));

    // Click the "Export Metrics Only" button
    const exportMetricsButton = screen.getByText(/export.metrics.only/i);
    fireEvent.click(exportMetricsButton);

    // Wait for the export to complete
    await waitFor(() => {
      expect(saveAs).toHaveBeenCalled();
    });
  });

  test('should export metrics in CSV format', async () => {
    renderWithRouter(<ProjectExport />);

    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    // Enable metrics export
    const metricsCheckbox = screen.getByLabelText(/include.object.metrics/i);
    fireEvent.click(metricsCheckbox);

    // Wait for metrics format selection to be available
    await waitFor(() => {
      expect(screen.getByText(/select.metrics.format/i)).toBeInTheDocument();
    });

    // Select CSV format
    const formatSelect = screen.getByText(/select.metrics.format/i);
    fireEvent.click(formatSelect);
    await waitFor(() => {
      expect(screen.getByText('CSV')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('CSV'));

    // Mock the server to return CSV data
    server.use(
      rest.get('/api/projects/:projectId/export/metrics', (req, res, ctx) => {
        return res(
          ctx.set('Content-Type', 'text/csv'),
          ctx.set('Content-Disposition', 'attachment; filename=metrics.csv'),
          ctx.body('Image Name,Image ID,Object ID,Area\ntest-image-1.jpg,test-image-id-1,1,10000'),
        );
      }),
    );

    // Click the "Export Metrics Only" button
    const exportMetricsButton = screen.getByText(/export.metrics.only/i);
    fireEvent.click(exportMetricsButton);

    // Wait for the export to complete
    await waitFor(() => {
      expect(saveAs).toHaveBeenCalled();
    });
  });

  test('should handle errors during export gracefully', async () => {
    // Mock server error for export
    server.use(
      rest.get('/api/projects/:projectId/export', (req, res, ctx) => {
        return res(ctx.status(500), ctx.json({ message: 'Server error during export' }));
      }),
    );

    renderWithRouter(<ProjectExport />);

    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    // Select export options
    const segmentationCheckbox = screen.getByLabelText(/include.segmentation/i);
    fireEvent.click(segmentationCheckbox);

    // Click the export button
    const exportButton = screen.getByText(/export.project/i);
    fireEvent.click(exportButton);

    // Should display error (in real app would show toast)
    await waitFor(() => {
      // This test assumes there's error state handling in the component
      // In a real test, we would check for error messages in the UI
      expect(saveAs).not.toHaveBeenCalled();
    });
  });

  test('should allow selecting and deselecting images for export', async () => {
    renderWithRouter(<ProjectExport />);

    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    // Find image selection checkboxes
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThanOrEqual(2);
    });

    // Find and click "Select All"
    const selectAllCheckbox = screen.getByLabelText(/select all/i);
    expect(selectAllCheckbox).toBeInTheDocument();

    // Uncheck "Select All"
    fireEvent.click(selectAllCheckbox);

    // Check individual image
    const firstImageCheckbox = screen
      .getAllByRole('checkbox')
      .find((checkbox) => checkbox.getAttribute('name')?.includes('image-') || false);

    if (firstImageCheckbox) {
      fireEvent.click(firstImageCheckbox);
    }

    // Enable segmentation export
    const segmentationCheckbox = screen.getByLabelText(/include.segmentation/i);
    fireEvent.click(segmentationCheckbox);

    // Click export button
    const exportButton = screen.getByText(/export.project/i);
    fireEvent.click(exportButton);

    // Wait for the export to complete
    await waitFor(() => {
      expect(saveAs).toHaveBeenCalled();
    });
  });
});
