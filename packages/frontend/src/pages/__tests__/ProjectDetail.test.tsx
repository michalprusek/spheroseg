import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import ProjectDetail from '@/pages/ProjectDetail';
import '@testing-library/jest-dom';

// Mock dependencies
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'test-project-id' }),
  useNavigate: () => vi.fn(),
}));

// Mock the useAuth hook
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' },
    token: 'test-token',
  }),
}));

// Mock the useLanguage hook
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    setLanguage: vi.fn(),
    t: (key: string) => key,
    availableLanguages: ['en', 'cs', 'de', 'fr', 'es', 'ru'],
  }),
}));

// Mock the useTheme hook
vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: vi.fn(),
  }),
}));

vi.mock('@/hooks/useProjectData', () => ({
  useProjectData: () => ({
    projectTitle: 'Test Project',
    images: [
      {
        id: 'image-1',
        project_id: 'test-project-id',
        name: 'test-image-1.jpg',
        url: 'https://example.com/image1.jpg',
        thumbnail_url: 'https://example.com/thumbnail1.jpg',
        segmentationStatus: 'completed',
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-02'),
      },
    ],
    loading: false,
    error: null,
    refreshData: vi.fn(),
    updateImageStatus: vi.fn(),
  }),
}));

vi.mock('@/hooks/useImageFilter', () => ({
  useImageFilter: () => ({
    filteredImages: [
      {
        id: 'image-1',
        project_id: 'test-project-id',
        name: 'test-image-1.jpg',
        url: 'https://example.com/image1.jpg',
        thumbnail_url: 'https://example.com/thumbnail1.jpg',
        segmentationStatus: 'completed',
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-02'),
      },
    ],
    searchTerm: '',
    sortField: 'updatedAt',
    sortDirection: 'desc',
    handleSearch: vi.fn(),
    handleSort: vi.fn(),
  }),
}));

vi.mock('@/components/project/ProjectImageActions', () => ({
  useProjectImageActions: () => ({
    handleDeleteImage: vi.fn(),
    handleOpenSegmentationEditor: vi.fn(),
    handleResegment: vi.fn(),
  }),
}));

vi.mock('@/pages/export/hooks/useExportFunctions', () => ({
  useExportFunctions: () => ({
    exportSelectedImages: vi.fn(),
  }),
}));

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    disconnect: vi.fn(),
    connect: vi.fn(),
  })),
}));

vi.mock('@/components/project/ProjectHeader', () => ({
  default: () => <div data-testid="project-header">Project Header</div>,
}));

vi.mock('@/components/project/ProjectToolbar', () => ({
  default: ({ onToggleUploader, setViewMode, viewMode, onToggleSelectionMode }: any) => (
    <div data-testid="project-toolbar">
      <button data-testid="toggle-uploader" onClick={onToggleUploader}>
        Toggle Uploader
      </button>
      <button data-testid="toggle-view-mode" onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}>
        Toggle View Mode
      </button>
      <button data-testid="toggle-selection-mode" onClick={onToggleSelectionMode}>
        Toggle Selection Mode
      </button>
      <div data-testid="view-mode">{viewMode}</div>
      <div data-testid="selection-mode-indicator">Selection Mode</div>
    </div>
  ),
}));

vi.mock('@/components/project/ProjectImages', () => ({
  default: () => <div data-testid="project-images">Project Images</div>,
}));

vi.mock('@/components/project/ProjectUploaderSection', () => ({
  default: ({ onCancel, segmentAfterUpload, onSegmentAfterUploadChange, onUploadComplete }: any) => (
    <div data-testid="project-uploader">
      <button data-testid="cancel-upload" onClick={onCancel}>
        Cancel
      </button>
      <button data-testid="toggle-segment" onClick={() => onSegmentAfterUploadChange(!segmentAfterUpload)}>
        Toggle Segment
      </button>
      <button data-testid="simulate-upload" onClick={() => onUploadComplete([{ id: 'new-image' }])}>
        Simulate Upload
      </button>
      <div data-testid="segment-after-upload">{segmentAfterUpload.toString()}</div>
    </div>
  ),
}));

vi.mock('@/components/project/EmptyState', () => ({
  default: () => <div data-testid="empty-state">Empty State</div>,
}));

vi.mock('apiClient', () => ({
  default: {
    post: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock tanstack query
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

describe.skip('ProjectDetail Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the project detail page', () => {
    render(<ProjectDetail />);

    expect(screen.getByTestId('project-header')).toBeInTheDocument();
    expect(screen.getByTestId('project-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('project-images')).toBeInTheDocument();
  });

  it('toggles the uploader when the toggle button is clicked', () => {
    render(<ProjectDetail />);

    // Uploader should not be visible initially
    expect(screen.queryByTestId('project-uploader')).not.toBeInTheDocument();

    // Click the toggle uploader button
    fireEvent.click(screen.getByTestId('toggle-uploader'));

    // Uploader should now be visible
    expect(screen.getByTestId('project-uploader')).toBeInTheDocument();

    // Click the cancel button
    fireEvent.click(screen.getByTestId('cancel-upload'));

    // Uploader should be hidden again
    expect(screen.queryByTestId('project-uploader')).not.toBeInTheDocument();
  });

  it('toggles segment after upload option in uploader', () => {
    render(<ProjectDetail />);

    // Open the uploader
    fireEvent.click(screen.getByTestId('toggle-uploader'));

    // Check initial segment after upload value
    expect(screen.getByTestId('segment-after-upload')).toHaveTextContent('true');

    // Toggle segment after upload
    fireEvent.click(screen.getByTestId('toggle-segment'));

    // Segment after upload should be disabled
    expect(screen.getByTestId('segment-after-upload')).toHaveTextContent('false');
  });

  it('handles upload completion', () => {
    render(<ProjectDetail />);

    // Open the uploader
    fireEvent.click(screen.getByTestId('toggle-uploader'));

    // Simulate upload completion
    fireEvent.click(screen.getByTestId('simulate-upload'));

    // The uploader should be closed after upload completion
    expect(screen.queryByTestId('project-uploader')).not.toBeInTheDocument();
  });
});
