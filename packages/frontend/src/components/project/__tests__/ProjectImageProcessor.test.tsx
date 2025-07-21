import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import { vi } from 'vitest';
import ProjectImageProcessor from '@/components/project/ProjectImageProcessor';
import '@testing-library/jest-dom';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/services/api/client', () => ({
  default: {
    post: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => {
      // Simple mock translation function
      const translations: Record<string, string> = {
        'imageProcessor.segmentationStarted': 'Segmentation process started...',
        'imageProcessor.segmentationStartError': 'Failed to start segmentation.',
        'imageProcessor.startSegmentationTooltip': 'Start segmentation',
        'imageProcessor.processingTooltip': 'Processing...',
        'imageProcessor.completedTooltip': 'Segmentation completed',
        'imageProcessor.retryTooltip': 'Retry segmentation',
      };
      return translations[key] || key;
    },
  }),
}));

// Import the mocked modules
import apiClient from '@/services/api/client';

describe('ProjectImageProcessor Component', () => {
  const mockImage = {
    id: 'image-123',
    project_id: 'project-123',
    name: 'test-image.jpg',
    url: 'https://example.com/image.jpg',
    thumbnail_url: 'https://example.com/thumbnail.jpg',
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-02'),
    segmentationStatus: 'pending' as const,
  };

  const mockOnStatusChange = vi.fn();
  const mockOnResultChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with pending status', () => {
    render(
      <ProjectImageProcessor
        image={mockImage}
        onStatusChange={mockOnStatusChange}
        onResultChange={mockOnResultChange}
      />,
    );

    // Check if the button is rendered with the correct icon
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();

    // Check for play icon
    const playIcon = document.querySelector('.lucide-play');
    expect(playIcon).toBeInTheDocument();
  });

  it('renders correctly with processing status', () => {
    const processingImage = {
      ...mockImage,
      segmentationStatus: 'processing' as const,
    };

    render(
      <ProjectImageProcessor
        image={processingImage}
        onStatusChange={mockOnStatusChange}
        onResultChange={mockOnResultChange}
      />,
    );

    // Check if the button is rendered with the loading spinner
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();

    // Check for loading spinner
    const loadingIcon = document.querySelector('.lucide-loader2');
    expect(loadingIcon).toBeInTheDocument();
    expect(loadingIcon).toHaveClass('animate-spin');
  });

  it('renders correctly with completed status', () => {
    const completedImage = {
      ...mockImage,
      segmentationStatus: 'completed' as const,
    };

    render(
      <ProjectImageProcessor
        image={completedImage}
        onStatusChange={mockOnStatusChange}
        onResultChange={mockOnResultChange}
      />,
    );

    // Check if the button is rendered with the check icon
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();

    // Check for check icon
    const checkIcon = document.querySelector('.lucide-check-circle');
    expect(checkIcon).toBeInTheDocument();
    expect(checkIcon).toHaveClass('text-green-500');
  });

  it('renders correctly with failed status', () => {
    const failedImage = {
      ...mockImage,
      segmentationStatus: 'failed' as const,
    };

    render(
      <ProjectImageProcessor
        image={failedImage}
        onStatusChange={mockOnStatusChange}
        onResultChange={mockOnResultChange}
      />,
    );

    // Check if the button is rendered with the alert icon
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();

    // Check for alert icon
    const alertIcon = document.querySelector('.lucide-alert-triangle');
    expect(alertIcon).toBeInTheDocument();
    expect(alertIcon).toHaveClass('text-red-500');
  });

  it('triggers segmentation when button is clicked', async () => {
    // Mock successful API response
    (apiClient.post as unknown).mockResolvedValueOnce({});

    render(
      <ProjectImageProcessor
        image={mockImage}
        onStatusChange={mockOnStatusChange}
        onResultChange={mockOnResultChange}
      />,
    );

    // Click the segmentation button
    const button = screen.getByRole('button');
    fireEvent.click(button);

    // Check if API was called with correct parameters
    expect(apiClient.post).toHaveBeenCalledWith(`/api/images/${mockImage.id}/segmentation`);

    // Check if status change callback was called
    expect(mockOnStatusChange).toHaveBeenCalledWith(mockImage.id, 'processing');

    // Check if toast notification was shown
    expect(toast.info).toHaveBeenCalledWith('Segmentation process started...');
  });

  it('handles API errors correctly', async () => {
    // Mock API error
    const errorMessage = 'API error occurred';
    (apiClient.post as unknown).mockRejectedValueOnce(new Error(errorMessage));

    render(
      <ProjectImageProcessor
        image={mockImage}
        onStatusChange={mockOnStatusChange}
        onResultChange={mockOnResultChange}
      />,
    );

    // Click the segmentation button
    const button = screen.getByRole('button');
    fireEvent.click(button);

    // Wait for the error to be handled
    await waitFor(() => {
      // Check if status change callback was called with failed status
      expect(mockOnStatusChange).toHaveBeenCalledWith(mockImage.id, 'failed');

      // Check if error toast was shown
      expect(toast.error).toHaveBeenCalled();
    });
  });
});
