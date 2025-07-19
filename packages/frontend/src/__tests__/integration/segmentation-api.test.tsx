/**
 * Integration tests for segmentation API interactions
 * Tests the integration between frontend components and backend API
 * Using enhanced mock API client for consistent testing
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import mockApiClient from '@/lib/__mocks__/enhanced/apiClient';
import { useNavigate } from 'react-router-dom';

// Mock the API client module
vi.mock('@/lib/apiClient', () => {
  return {
    default: mockApiClient,
  };
});

// Import components that use the API client
import SegmentationEditor from '@/pages/segmentation/SegmentationEditorV2';
import { SegmentationProvider } from '@/contexts/SegmentationContext';

// Mock context providers
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@example.com' },
    token: 'mock-token',
  }),
}));

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useParams: () => ({ projectId: 'project-1', imageId: 'image-1' }),
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  Navigate: ({ to }: { to: string }) => <div>Navigate to {to}</div>,
}));

// Toast notification mock
const toastMock = {
  success: vi.fn(),
  error: vi.fn(),
  loading: vi.fn(),
  custom: vi.fn(),
};

vi.mock('react-hot-toast', () => ({
  toast: toastMock,
}));

// Test wrapper for context providers
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <SegmentationProvider>{children}</SegmentationProvider>;
};

describe('Segmentation API Integration', () => {
  // Reset API mocks between tests
  beforeEach(() => {
    mockApiClient.resetMocks();
    mockApiClient.setupStandardMocks();

    // Clear all mock function calls
    vi.clearAllMocks();
  });

  it('should load segmentation data on component mount', async () => {
    // Render component
    render(
      <TestWrapper>
        <SegmentationEditor projectId="project-1" imageId="image-1" />
      </TestWrapper>,
    );

    // Wait for data loading to complete
    await waitFor(() => {
      // Check that the get method was called with the right URL
      expect(mockApiClient.get).toHaveBeenCalledWith(expect.stringMatching(/\/images\/image-1\/segmentation/));
    });

    // Verify data was loaded and rendered
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });

  it('should handle segmentation data loading error', async () => {
    // Setup mock to return error
    mockApiClient.addMockEndpoint({
      url: /\/images\/image-1\/segmentation/,
      method: 'get',
      response: 'Error loading segmentation data',
      status: 500,
    });

    // Render component
    render(
      <TestWrapper>
        <SegmentationEditor projectId="project-1" imageId="image-1" />
      </TestWrapper>,
    );

    // Wait for error state
    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalled();
    });

    // Verify error handling
    const errorElement = await screen.findByText(/error|failed/i);
    expect(errorElement).toBeInTheDocument();
  });

  it('should handle network errors gracefully', async () => {
    // Configure mock to simulate network error
    mockApiClient.configureMock({
      throwNetworkErrorProbability: 1, // Always throw network error
      endpoints: mockApiClient.mockConfig.endpoints,
    });

    // Render component
    render(
      <TestWrapper>
        <SegmentationEditor projectId="project-1" imageId="image-1" />
      </TestWrapper>,
    );

    // Wait for error handling
    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalled();
    });

    // Verify error display
    const errorElement = await screen.findByText(/network|connection|error/i);
    expect(errorElement).toBeInTheDocument();
  });

  it('should save segmentation changes successfully', async () => {
    // Setup successful save response
    mockApiClient.addMockEndpoint({
      url: /\/images\/image-1\/segmentation/,
      method: 'put',
      response: { success: true, message: 'Segmentation saved successfully' },
    });

    // Render component
    render(
      <TestWrapper>
        <SegmentationEditor projectId="project-1" imageId="image-1" />
      </TestWrapper>,
    );

    // Wait for component to load
    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalled();
    });

    // Find and click save button
    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);

    // Verify save API was called
    await waitFor(() => {
      expect(mockApiClient.put).toHaveBeenCalledWith(
        expect.stringMatching(/\/images\/image-1\/segmentation/),
        expect.any(Object),
      );
    });

    // Verify success toast
    expect(toastMock.success).toHaveBeenCalled();
  });

  it('should handle save errors correctly', async () => {
    // Setup error response for save
    mockApiClient.addMockEndpoint({
      url: /\/images\/image-1\/segmentation/,
      method: 'put',
      response: 'Failed to save segmentation',
      status: 500,
    });

    // Render component
    render(
      <TestWrapper>
        <SegmentationEditor projectId="project-1" imageId="image-1" />
      </TestWrapper>,
    );

    // Wait for component to load
    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalled();
    });

    // Find and click save button
    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);

    // Verify save API was called and error handled
    await waitFor(() => {
      expect(mockApiClient.put).toHaveBeenCalled();
    });

    // Verify error toast
    expect(toastMock.error).toHaveBeenCalled();
  });

  it('should handle slow network responses with loading indicators', async () => {
    // Configure slow responses
    mockApiClient.addMockEndpoint({
      url: /\/images\/image-1\/segmentation/,
      method: 'get',
      response: mockApiClient.mockData.segmentation,
      delay: 1000, // 1 second delay
    });

    // Render component
    render(
      <TestWrapper>
        <SegmentationEditor projectId="project-1" imageId="image-1" />
      </TestWrapper>,
    );

    // Verify loading state is shown
    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    // Wait for data loading to complete
    await waitFor(
      () => {
        expect(mockApiClient.get).toHaveBeenCalled();
      },
      { timeout: 2000 },
    );

    // Verify loading state is hidden
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });

  it('should handle authentication token issues', async () => {
    // Setup unauthorized response
    mockApiClient.addMockEndpoint({
      url: /\/images\/image-1\/segmentation/,
      method: 'get',
      response: 'Unauthorized',
      status: 401,
    });

    // Render component
    render(
      <TestWrapper>
        <SegmentationEditor projectId="project-1" imageId="image-1" />
      </TestWrapper>,
    );

    // Wait for API call
    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalled();
    });

    // Verify auth error is handled
    // This might show an error message or redirect to login
    // We'll check for the presence of an auth-related error
    const authErrorElement = await screen.findByText(/unauthorized|auth|login/i);
    expect(authErrorElement).toBeInTheDocument();
  });

  it('should trigger resegmentation API when requested', async () => {
    // Set up successful resegmentation response
    mockApiClient.addMockEndpoint({
      url: /\/projects\/project-1\/images\/image-1\/segment/,
      method: 'post',
      response: { success: true, message: 'Resegmentation job queued' },
      delay: 500,
    });

    // Render component
    render(
      <TestWrapper>
        <SegmentationEditor projectId="project-1" imageId="image-1" />
      </TestWrapper>,
    );

    // Wait for initial load
    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalled();
    });

    // Find and click resegment button
    const resegmentButton = screen.getByRole('button', { name: /resegment/i });
    fireEvent.click(resegmentButton);

    // Verify resegmentation API was called
    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith(
        expect.stringMatching(/\/projects\/project-1\/images\/image-1\/segment/),
        expect.objectContaining({ force: true }),
      );
    });

    // Verify success notification
    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalled();
    });
  });

  it('should handle pagination and navigation between images', async () => {
    // Add mock data for navigation between images
    mockApiClient.addMockEndpoint({
      url: /\/projects\/project-1\/images/,
      method: 'get',
      response: {
        images: mockApiClient.mockData.images,
        pagination: {
          current_page: 1,
          total_pages: 2,
          total_images: 5,
          per_page: 3,
        },
      },
    });

    // Add mock data for next image
    mockApiClient.addMockEndpoint({
      url: /\/images\/image-2\/segmentation/,
      method: 'get',
      response: {
        ...mockApiClient.mockData.segmentation,
        id: 'segmentation-2',
        image_id: 'image-2',
      },
    });

    // Render component
    render(
      <TestWrapper>
        <SegmentationEditor projectId="project-1" imageId="image-1" />
      </TestWrapper>,
    );

    // Wait for initial load
    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalled();
    });

    // Simulate navigation to next image
    // First, we need to find the navigation control that would trigger this
    const nextButton = screen.getByRole('button', {
      name: /next|forward|>|→/i,
    });
    fireEvent.click(nextButton);

    // Verify image list API was called
    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalledWith(expect.stringMatching(/\/projects\/project-1\/images/));
    });

    // This might trigger a navigation in the real app, which we're mocking
    // For testing, we can verify state changes or mock navigation calls
    const navigate = useNavigate();
    expect(navigate).toHaveBeenCalled();
  });
});
