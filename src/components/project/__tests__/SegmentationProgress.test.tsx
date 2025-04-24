import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import SegmentationProgress from '../SegmentationProgress';
import '@testing-library/jest-dom';
import apiClient from '@/lib/__mocks__/apiClient';

// Mock the modules
vi.mock('@/lib/apiClient');

// Mock the socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    disconnect: vi.fn()
  }))
}));

// Mock the useAuth hook
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    token: 'mock-token'
  })
}));

// Mock the useLanguage hook
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key
  })
}));

// Mock the useOnClickOutside hook
vi.mock('@/hooks/useOnClickOutside', () => ({
  useOnClickOutside: vi.fn()
}));

// Mock axios
vi.mock('axios');

describe('SegmentationProgress Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiClient.resetMocks();
  });

  it('renders with project-specific queue data', async () => {
    render(<SegmentationProgress projectId="project-123" />);

    // Wait for the component to fetch and display data
    await waitFor(() => {
      expect(screen.getByText(/Segmentation: 1 running, 1 queued/)).toBeInTheDocument();
    });

    // Check progress bar is rendered
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('opens the queue details when clicked', async () => {
    render(<SegmentationProgress projectId="project-123" />);

    // Wait for the component to load
    await waitFor(() => {
      expect(screen.getByText(/Segmentation: 1 running, 1 queued/)).toBeInTheDocument();
    });

    // Click to open the queue details
    fireEvent.click(screen.getByText(/Segmentation: 1 running, 1 queued/));

    // Check if queue details are displayed
    await waitFor(() => {
      expect(screen.getByText('Segmentation Queue')).toBeInTheDocument();
      expect(screen.getByText('Image 1')).toBeInTheDocument();
      expect(screen.getByText('Processing')).toBeInTheDocument();
    });
  });

  it.skip('displays "Ready" when queue is empty', async () => {
    // Mock API to return empty queue
    apiClient.get.mockImplementationOnce(() => {
      return Promise.resolve({
        data: {
          queueLength: 0,
          runningTasks: [],
          queuedTasks: [],
          processingImages: []
        }
      });
    });

    render(<SegmentationProgress projectId="project-123" />);

    // Wait for the component to load and display "Ready"
    await waitFor(() => {
      expect(screen.getByText(/Segmentation: Ready/)).toBeInTheDocument();
    });
  });

  it('filters queue items by project ID', async () => {
    render(<SegmentationProgress projectId="project-123" />);

    // Wait for the component to load
    await waitFor(() => {
      expect(screen.getByText(/Segmentation: 1 running, 1 queued/)).toBeInTheDocument();
    });

    // Open queue details
    fireEvent.click(screen.getByText(/Segmentation: 1 running, 1 queued/));

    // Check if only project-specific items are shown
    await waitFor(() => {
      expect(screen.getByText('Image 1')).toBeInTheDocument();
      // Image 3 should not be visible as it belongs to a different project
      expect(screen.queryByText('Image 3')).not.toBeInTheDocument();
    });
  });

  it.skip('shows "No running tasks" when there are no running tasks', async () => {
    // Mock API to return queue with no running tasks but some queued tasks
    apiClient.get.mockImplementationOnce(() => {
      return Promise.resolve({
        data: {
          queueLength: 1,
          runningTasks: [],
          queuedTasks: ['task-2'],
          processingImages: []
        }
      });
    });

    render(<SegmentationProgress projectId="project-123" />);

    // Wait for the component to load
    await waitFor(() => {
      expect(screen.getByText(/Segmentation: 0 running, 1 queued/)).toBeInTheDocument();
    });

    // Open queue details
    fireEvent.click(screen.getByText(/Segmentation: 0 running, 1 queued/));

    // Check if "No running tasks" is displayed
    await waitFor(() => {
      expect(screen.getByText('No running tasks')).toBeInTheDocument();
    });
  });
});
