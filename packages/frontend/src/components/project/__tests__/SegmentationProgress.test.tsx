import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import SegmentationProgress from '@/components/project/SegmentationProgress';
import '@testing-library/jest-dom';
import { AllProvidersWrapper } from '@/test-utils/test-wrapper';
import {
  setupSegmentationProgressMocks,
  mockEmptyQueueResponse,
  mockActiveQueueResponse,
  mockApiClientResponse,
} from '../../../shared/test-utils/segmentation-progress-test-utils';

// Setup all mocks
setupSegmentationProgressMocks();

// Import the mocked modules
import apiClient from '@/lib/apiClient';

describe.skip('SegmentationProgress Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with empty queue', async () => {
    // Mock API response for empty queue
    mockApiClientResponse(mockEmptyQueueResponse, apiClient);

    render(
      <AllProvidersWrapper>
        <SegmentationProgress projectId="project-123" />
      </AllProvidersWrapper>,
    );

    // Wait for the component to fetch and display data
    await waitFor(() => {
      expect(screen.getByText(/Segmentation: Ready/)).toBeInTheDocument();
    });

    // Check progress bar is rendered with 0 progress
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar.querySelector('.bg-primary')).toHaveStyle('transform: translateX(-100%)');
  });

  it('renders with running tasks', async () => {
    // Mock API response with running tasks
    mockApiClientResponse(mockActiveQueueResponse, apiClient);

    render(
      <AllProvidersWrapper>
        <SegmentationProgress projectId="project-123" />
      </AllProvidersWrapper>,
    );

    // Wait for the component to fetch and display data
    await waitFor(() => {
      expect(screen.getByText(/Segmentation: 1 running, 1 queued/)).toBeInTheDocument();
    });

    // Check progress bar is rendered with some progress
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
  });

  it('opens queue details when clicked', async () => {
    // Mock API response with running and queued tasks
    mockApiClientResponse(mockActiveQueueResponse, apiClient);

    render(
      <AllProvidersWrapper>
        <SegmentationProgress projectId="project-123" />
      </AllProvidersWrapper>,
    );

    // Wait for the component to fetch and display data
    await waitFor(() => {
      expect(screen.getByText(/Segmentation: 1 running, 1 queued/)).toBeInTheDocument();
    });

    // Click to open queue details
    fireEvent.click(screen.getByText(/Segmentation: 1 running, 1 queued/));

    // Check that queue details are displayed
    await waitFor(() => {
      expect(screen.getByText(/Segmentation Queue/)).toBeInTheDocument();
      expect(screen.getByText('Test Image')).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    // Mock API error
    apiClient.get.mockRejectedValueOnce(new Error('API error'));

    render(
      <AllProvidersWrapper>
        <SegmentationProgress projectId="project-123" />
      </AllProvidersWrapper>,
    );

    // Wait for the component to handle the error and display fallback
    await waitFor(() => {
      // The component might show either "Ready" or some default state
      const statusText = screen.getByText(/Segmentation:/);
      expect(statusText).toBeInTheDocument();
    });

    // Check progress bar is rendered
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
  });
});
