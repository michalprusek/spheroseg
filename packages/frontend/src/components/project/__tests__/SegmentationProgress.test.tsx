import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import SegmentationProgress from '@/components/project/SegmentationProgress';
import '@testing-library/jest-dom';
import { AllProvidersWrapper } from '@/test-utils/test-wrapper';

// Mock the translation function
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string, params?: any) => {
      if (params) {
        return `${key} ${JSON.stringify(params)}`;
      }
      return key;
    },
  }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock apiClient
vi.mock('@/services/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Import the mocked modules
import apiClient from '@/services/api/client';

describe('SegmentationProgress Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with empty queue', async () => {
    // Mock API response for empty queue
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        queue: [],
        summary: {
          total: 0,
          queued: 0,
          processing: 0,
          completed: 0,
          failed: 0,
        },
      },
    });

    render(
      <AllProvidersWrapper>
        <SegmentationProgress projectId="project-123" />
      </AllProvidersWrapper>,
    );

    // Wait for the component to fetch and display data
    await waitFor(() => {
      expect(screen.getByText('segmentation.queue.statusReady')).toBeInTheDocument();
    });

    // Check progress bar is rendered with 0 progress
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar.querySelector('.bg-primary')).toHaveStyle('transform: translateX(-100%)');
  });

  it('renders with running tasks', async () => {
    // Mock API response with running tasks
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        runningTasks: ['task-1'],
        queuedTasks: ['task-2'],
        processingImages: [
          {
            id: 'task-1',
            name: 'image-1.jpg',
            projectId: 'project-123',
          },
        ],
        queuedImages: [
          {
            id: 'task-2',
            name: 'image-2.jpg', 
            projectId: 'project-123',
          },
        ],
        queueLength: 1,
        activeTasksCount: 1,
      },
    });

    render(
      <AllProvidersWrapper>
        <SegmentationProgress projectId="project-123" />
      </AllProvidersWrapper>,
    );

    // Wait for the component to fetch and display data
    await waitFor(() => {
      // Look for the specific translation key with parameters
      expect(screen.getByText('segmentation.queue.statusRunning {"count":1,"queued":1}')).toBeInTheDocument();
    });

    // Check progress bar is rendered with some progress
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
  });

  it('opens queue details when clicked', async () => {
    // Mock API response with running and queued tasks
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        runningTasks: ['task-1'],
        queuedTasks: ['task-2'],
        processingImages: [
          {
            id: 'task-1',
            name: 'Test Image',
            projectId: 'project-123',
          },
        ],
        queuedImages: [
          {
            id: 'task-2',
            name: 'Test Image 2',
            projectId: 'project-123',
          },
        ],
        queueLength: 1,
        activeTasksCount: 1,
      },
    });

    render(
      <AllProvidersWrapper>
        <SegmentationProgress projectId="project-123" />
      </AllProvidersWrapper>,
    );

    // Wait for the component to fetch and display data
    await waitFor(() => {
      // Look for the specific translation key with parameters
      expect(screen.getByText('segmentation.queue.statusRunning {"count":1,"queued":1}')).toBeInTheDocument();
    });

    // Find and click the component (it should be clickable)
    const progressComponent = screen.getByRole('progressbar').parentElement?.parentElement;
    if (progressComponent) {
      fireEvent.click(progressComponent);
    }

    // Check that queue details are displayed
    await waitFor(() => {
      // Look for elements that would indicate the queue details modal is open
      expect(screen.getByText('Test Image')).toBeInTheDocument();
      expect(screen.getByText('Test Image 2')).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    // Mock API error
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('API error'));

    render(
      <AllProvidersWrapper>
        <SegmentationProgress projectId="project-123" />
      </AllProvidersWrapper>,
    );

    // Wait for the component to handle the error and display fallback
    await waitFor(() => {
      // The component should show the ready state as a fallback
      expect(screen.getByText('segmentation.queue.statusReady')).toBeInTheDocument();
    });

    // Check progress bar is rendered
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
  });
});
