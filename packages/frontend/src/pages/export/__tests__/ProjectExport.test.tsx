import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import ProjectExport from '../ProjectExport';
import { setupAllContextMocks } from '@/test-utils/contextMocks';
import { MemoryRouterWrapper } from '@/test-utils/test-wrapper';
import { useExportFunctions } from '../hooks/useExportFunctions';
import { useProjectData } from '@/hooks/useProjectData';
import { useNavigate } from 'react-router-dom';

// Mock useParams hook from react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: vi.fn(() => ({ id: 'test-project-id' })),
    useNavigate: vi.fn(() => vi.fn()),
  };
});

// Mock useProjectData hook
vi.mock('@/hooks/useProjectData', () => ({
  useProjectData: vi.fn(() => ({
    projectTitle: 'Test Project',
    images: [
      {
        id: 'img1',
        name: 'image1.jpg',
        url: 'http://example.com/image1.jpg',
        thumbnailUrl: 'http://example.com/thumb1.jpg',
      },
      {
        id: 'img2',
        name: 'image2.jpg',
        url: 'http://example.com/image2.jpg',
        thumbnailUrl: 'http://example.com/thumb2.jpg',
      },
      {
        id: 'img3',
        name: 'image3.jpg',
        url: 'http://example.com/image3.jpg',
        thumbnailUrl: 'http://example.com/thumb3.jpg',
      },
    ],
    loading: false,
  })),
}));

// Mock useExportFunctions hook
vi.mock('../hooks/useExportFunctions', () => ({
  useExportFunctions: vi.fn(() => ({
    selectedImages: { img1: true, img2: false, img3: true },
    includeMetadata: true,
    includeObjectMetrics: true,
    includeSegmentation: true,
    includeImages: true,
    annotationFormat: 'coco',
    metricsFormat: 'json',
    isExporting: false,
    handleSelectAll: vi.fn(),
    handleSelectImage: vi.fn(),
    getSelectedCount: vi.fn(() => 2),
    handleExport: vi.fn(),
    handleExportMetricsAsXlsx: vi.fn(),
    setIncludeMetadata: vi.fn(),
    setIncludeObjectMetrics: vi.fn(),
    setIncludeSegmentation: vi.fn(),
    setIncludeImages: vi.fn(),
    setAnnotationFormat: vi.fn(),
    setMetricsFormat: vi.fn(),
  })),
}));

// Mock ProjectHeader component
vi.mock('@/components/project/ProjectHeader', () => ({
  default: vi.fn(({ projectTitle, imagesCount, loading }) => (
    <div data-testid="mock-project-header">
      <h1>{projectTitle}</h1>
      <p>Images: {imagesCount}</p>
      {loading && <p>Loading...</p>}
    </div>
  )),
}));

// Mock export components
vi.mock('../components/ExportOptionsCard', () => ({
  default: vi.fn(() => <div data-testid="mock-export-options">Export Options Card</div>),
}));

vi.mock('../components/ImageSelectionCard', () => ({
  default: vi.fn(() => <div data-testid="mock-image-selection">Image Selection Card</div>),
}));

describe('ProjectExport Component', () => {
  beforeEach(() => {
    // Setup all context mocks
    setupAllContextMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <MemoryRouterWrapper initialEntries={['/projects/test-project-id/export']}>
        <ProjectExport />
      </MemoryRouterWrapper>,
    );
  };

  it('renders the project export page correctly', () => {
    renderComponent();

    // Check if the project header is displayed with correct data
    expect(screen.getByTestId('mock-project-header')).toBeInTheDocument();
    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText('Images: 3')).toBeInTheDocument();

    // Check if the export options and image selection cards are displayed
    expect(screen.getByTestId('mock-export-options')).toBeInTheDocument();
    expect(screen.getByTestId('mock-image-selection')).toBeInTheDocument();

    // Check if the export button is displayed with correct count
    expect(screen.getByText(/Exportovat 2 obrázků/i)).toBeInTheDocument();

    // Check if the back button is displayed
    expect(screen.getByText(/Zpět na projekt/i)).toBeInTheDocument();
  });

  it('handles clicking the export button', () => {
    renderComponent();

    // Get the handleExport mock function
    const { handleExport } = (useExportFunctions as unknown)();

    // Click the export button
    fireEvent.click(screen.getByText(/Exportovat 2 obrázků/i));

    // Check if handleExport was called with the selected images
    expect(handleExport).toHaveBeenCalledWith([
      {
        id: 'img1',
        name: 'image1.jpg',
        url: 'http://example.com/image1.jpg',
        thumbnailUrl: 'http://example.com/thumb1.jpg',
      },
      {
        id: 'img3',
        name: 'image3.jpg',
        url: 'http://example.com/image3.jpg',
        thumbnailUrl: 'http://example.com/thumb3.jpg',
      },
    ]);
  });

  it('handles clicking the back button', () => {
    renderComponent();

    // Get the navigate mock function
    const navigate = useNavigate();

    // Click the back button
    fireEvent.click(screen.getByText(/Zpět na projekt/i));

    // Check if navigate was called with the correct route
    expect(navigate).toHaveBeenCalledWith('/project/test-project-id');
  });

  it('disables the export button when no images are selected', () => {
    // Override the getSelectedCount to return 0
    (useExportFunctions as unknown).mockReturnValueOnce({
      ...(useExportFunctions as unknown)(),
      getSelectedCount: vi.fn(() => 0),
    });

    renderComponent();

    // Check if the export button is disabled
    expect(screen.getByText(/Exportovat 0 obrázků/i)).toBeDisabled();
  });

  it('shows loading state when exporting', () => {
    // Override the isExporting state to be true
    (useExportFunctions as unknown).mockReturnValueOnce({
      ...(useExportFunctions as unknown)(),
      isExporting: true,
    });

    renderComponent();

    // Check if the export button shows the loading indicator
    expect(screen.getByText('⏳').className).toContain('animate-spin');
    expect(screen.getByText(/Exportovat 2 obrázků/i)).toBeDisabled();
  });

  it('handles loading state of project data', () => {
    // Override the loading state to be true
    (useProjectData as unknown).mockReturnValueOnce({
      ...(useProjectData as unknown)(),
      loading: true,
    });

    renderComponent();

    // Check if the loading indicator is displayed in the header
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});
