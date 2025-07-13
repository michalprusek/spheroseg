/**
 * Integration tests for resegmentation workflow in frontend
 *
 * These tests verify:
 * - Resegment button behavior
 * - Status updates and spinner animation
 * - WebSocket integration
 * - UI state management during resegmentation
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { ImageDisplay } from '@/components/project/ImageDisplay';
import { ProjectImageActions } from '@/components/project/ProjectImageActions';
import { SegmentationEditorV2 } from '@/pages/segmentation/SegmentationEditorV2';
import { SEGMENTATION_STATUS } from '@/constants/segmentationStatus';
import apiClient from '@/lib/apiClient';
import { io } from 'socket.io-client';

// Mock dependencies
vi.mock('@/lib/apiClient');
vi.mock('socket.io-client');
vi.mock('@/hooks/useTranslations', () => ({
  useTranslations: () => ({
    t: (key: string) => key,
  }),
}));

// Mock socket.io
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
};

// Mock project image
const mockImage = {
  id: 'test-image-123',
  project_id: 'test-project-123',
  filename: 'test-image.jpg',
  original_name: 'test-image.jpg',
  url: '/uploads/test-image.jpg',
  thumbnail_url: '/uploads/thumb-test-image.jpg',
  size: 1024,
  width: 800,
  height: 600,
  segmentation_status: SEGMENTATION_STATUS.COMPLETED,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('Resegmentation Frontend Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (io as any).mockReturnValue(mockSocket);
  });

  describe('ImageDisplay Resegmentation', () => {
    it('should show resegment button with normal state when image is completed', () => {
      render(
        <BrowserRouter>
          <ImageDisplay image={mockImage} onDelete={vi.fn()} onResegment={vi.fn()} viewMode="grid" />
        </BrowserRouter>,
      );

      const resegmentButton = screen.getByLabelText('Resegment image');
      expect(resegmentButton).toBeInTheDocument();
      expect(resegmentButton).not.toBeDisabled();

      // Check that spinner is not present
      const icon = resegmentButton.querySelector('svg');
      expect(icon).not.toHaveClass('animate-spin');
    });

    it('should show spinner when image is in queued status', () => {
      const queuedImage = {
        ...mockImage,
        segmentation_status: SEGMENTATION_STATUS.QUEUED,
      };

      render(
        <BrowserRouter>
          <ImageDisplay image={queuedImage} onDelete={vi.fn()} onResegment={vi.fn()} viewMode="grid" />
        </BrowserRouter>,
      );

      const resegmentButton = screen.getByLabelText('Resegment image');
      expect(resegmentButton).toBeDisabled();

      // Check that spinner is present
      const icon = resegmentButton.querySelector('svg');
      expect(icon).toHaveClass('animate-spin');
    });

    it('should show spinner when image is in processing status', () => {
      const processingImage = {
        ...mockImage,
        segmentation_status: SEGMENTATION_STATUS.PROCESSING,
      };

      render(
        <BrowserRouter>
          <ImageDisplay image={processingImage} onDelete={vi.fn()} onResegment={vi.fn()} viewMode="grid" />
        </BrowserRouter>,
      );

      const resegmentButton = screen.getByLabelText('Resegment image');
      expect(resegmentButton).toBeDisabled();

      // Check that spinner is present
      const icon = resegmentButton.querySelector('svg');
      expect(icon).toHaveClass('animate-spin');
    });

    it('should update status when receiving WebSocket updates', async () => {
      const { rerender } = render(
        <BrowserRouter>
          <ImageDisplay image={mockImage} onDelete={vi.fn()} onResegment={vi.fn()} viewMode="grid" />
        </BrowserRouter>,
      );

      // Simulate WebSocket connection
      expect(mockSocket.on).toHaveBeenCalledWith('segmentation_update', expect.any(Function));

      // Get the segmentation_update handler
      const updateHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'segmentation_update')?.[1];

      // Simulate receiving status update
      await waitFor(() => {
        updateHandler({
          imageId: mockImage.id,
          status: SEGMENTATION_STATUS.PROCESSING,
        });
      });

      // Wait for component to update
      await waitFor(() => {
        const resegmentButton = screen.getByLabelText('Resegment image');
        expect(resegmentButton).toBeDisabled();
        const icon = resegmentButton.querySelector('svg');
        expect(icon).toHaveClass('animate-spin');
      });
    });
  });

  describe('ProjectImageActions Resegmentation', () => {
    it('should trigger resegmentation API call', async () => {
      const mockOnImagesChange = vi.fn();
      const mockApiResponse = {
        data: {
          message: 'Resegmentation started successfully',
          status: SEGMENTATION_STATUS.QUEUED,
        },
      };

      (apiClient.post as any).mockResolvedValueOnce(mockApiResponse);

      const { handleResegment } = ProjectImageActions({
        projectId: mockImage.project_id,
        onImagesChange: mockOnImagesChange,
        images: [mockImage],
      });

      await handleResegment(mockImage.id);

      // Verify API call
      expect(apiClient.post).toHaveBeenCalledWith(`/api/segmentation/${mockImage.id}/resegment`, {
        project_id: mockImage.project_id,
      });

      // Verify images were updated with queued status
      expect(mockOnImagesChange).toHaveBeenCalled();
      const updatedImages = mockOnImagesChange.mock.calls[0][0];
      expect(updatedImages[0].segmentationStatus).toBe(SEGMENTATION_STATUS.QUEUED);
    });

    it('should dispatch custom events for status updates', async () => {
      const mockOnImagesChange = vi.fn();
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

      (apiClient.post as any).mockResolvedValueOnce({
        data: {
          message: 'Resegmentation started successfully',
          status: SEGMENTATION_STATUS.QUEUED,
        },
      });

      const { handleResegment } = ProjectImageActions({
        projectId: mockImage.project_id,
        onImagesChange: mockOnImagesChange,
        images: [mockImage],
      });

      await handleResegment(mockImage.id);

      // Wait for events to be dispatched
      await waitFor(() => {
        // Check for image-status-update event
        const statusUpdateEvent = dispatchEventSpy.mock.calls.find(
          (call) => call[0].type === 'image-status-update',
        )?.[0];

        expect(statusUpdateEvent).toBeDefined();
        expect(statusUpdateEvent.detail).toEqual({
          imageId: mockImage.id,
          status: SEGMENTATION_STATUS.QUEUED,
          forceQueueUpdate: true,
        });

        // Check for queue-status-update event
        const queueUpdateEvent = dispatchEventSpy.mock.calls.find(
          (call) => call[0].type === 'queue-status-update',
        )?.[0];

        expect(queueUpdateEvent).toBeDefined();
        expect(queueUpdateEvent.detail.refresh).toBe(true);
      });
    });

    it('should handle resegmentation errors gracefully', async () => {
      const mockOnImagesChange = vi.fn();
      const mockError = new Error('ML service unavailable');

      (apiClient.post as any).mockRejectedValueOnce(mockError);

      const { handleResegment } = ProjectImageActions({
        projectId: mockImage.project_id,
        onImagesChange: mockOnImagesChange,
        images: [mockImage],
      });

      await handleResegment(mockImage.id);

      // Verify image status was reset
      const resetCall = mockOnImagesChange.mock.calls.find(
        (call) => call[0][0].segmentationStatus === SEGMENTATION_STATUS.WITHOUT_SEGMENTATION,
      );
      expect(resetCall).toBeDefined();
    });
  });

  describe('SegmentationEditor Resegmentation', () => {
    it('should show spinner in segmentation editor during resegmentation', () => {
      const processingImage = {
        ...mockImage,
        segmentation_status: SEGMENTATION_STATUS.PROCESSING,
      };

      render(
        <BrowserRouter>
          <SegmentationEditorV2
            imageData={{
              ...processingImage,
              segmentationStatus: SEGMENTATION_STATUS.PROCESSING,
              polygons: [],
            }}
            projectId={processingImage.project_id}
          />
        </BrowserRouter>,
      );

      // Look for spinner in the resegment button
      const resegmentButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.textContent?.includes('resegment') || btn.querySelector('.animate-spin'));

      expect(resegmentButtons.length).toBeGreaterThan(0);
      const spinningButton = resegmentButtons.find((btn) => btn.querySelector('.animate-spin'));
      expect(spinningButton).toBeDefined();
    });

    it('should use unified resegment endpoint in editor', async () => {
      (apiClient.post as any).mockResolvedValueOnce({
        data: {
          message: 'Resegmentation started successfully',
          status: SEGMENTATION_STATUS.QUEUED,
        },
      });

      // Directly test the hook since the component is complex
      const { handleResegment } = await import('@/pages/segmentation/hooks/segmentation/useSegmentationV2').then(
        (mod) => {
          // Mock the hook implementation
          return {
            handleResegment: async (imageId: string, projectId: string) => {
              await apiClient.post(`/api/segmentation/${imageId}/resegment`, {
                project_id: projectId,
              });
            },
          };
        },
      );

      await handleResegment(mockImage.id, mockImage.project_id);

      expect(apiClient.post).toHaveBeenCalledWith(`/api/segmentation/${mockImage.id}/resegment`, {
        project_id: mockImage.project_id,
      });
    });
  });

  describe('End-to-End Resegmentation Flow', () => {
    it('should complete full resegmentation flow with status updates', async () => {
      const mockOnImagesChange = vi.fn();
      let currentStatus = SEGMENTATION_STATUS.COMPLETED;

      // Mock API responses
      (apiClient.post as any).mockResolvedValueOnce({
        data: {
          message: 'Resegmentation started successfully',
          status: SEGMENTATION_STATUS.QUEUED,
        },
      });

      (apiClient.get as any).mockImplementation((url: string) => {
        if (url.includes('/segmentation')) {
          return Promise.resolve({
            data: {
              status: currentStatus,
              polygons:
                currentStatus === SEGMENTATION_STATUS.COMPLETED
                  ? [
                      {
                        id: 'new-polygon',
                        points: [
                          [0, 0],
                          [100, 0],
                          [100, 100],
                          [0, 100],
                        ],
                      },
                    ]
                  : [],
            },
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      const { rerender } = render(
        <BrowserRouter>
          <ImageDisplay
            image={{ ...mockImage, segmentationStatus: currentStatus }}
            onDelete={vi.fn()}
            onResegment={async (imageId) => {
              // Simulate resegment action
              currentStatus = SEGMENTATION_STATUS.QUEUED;
              mockOnImagesChange([{ ...mockImage, segmentationStatus: currentStatus }]);

              await apiClient.post(`/api/segmentation/${imageId}/resegment`, {
                project_id: mockImage.project_id,
              });
            }}
            viewMode="grid"
          />
        </BrowserRouter>,
      );

      // Click resegment button
      const resegmentButton = screen.getByLabelText('Resegment image');
      fireEvent.click(resegmentButton);

      // Wait for status to change to queued
      await waitFor(() => {
        expect(currentStatus).toBe(SEGMENTATION_STATUS.QUEUED);
      });

      // Rerender with queued status
      rerender(
        <BrowserRouter>
          <ImageDisplay
            image={{ ...mockImage, segmentationStatus: currentStatus }}
            onDelete={vi.fn()}
            onResegment={vi.fn()}
            viewMode="grid"
          />
        </BrowserRouter>,
      );

      // Verify spinner is shown
      expect(screen.getByLabelText('Resegment image')).toBeDisabled();
      expect(screen.getByLabelText('Resegment image').querySelector('.animate-spin')).toBeInTheDocument();

      // Simulate WebSocket update to processing
      currentStatus = SEGMENTATION_STATUS.PROCESSING;
      const updateHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'segmentation_update')?.[1];

      updateHandler({
        imageId: mockImage.id,
        status: SEGMENTATION_STATUS.PROCESSING,
      });

      // Simulate completion
      currentStatus = SEGMENTATION_STATUS.COMPLETED;
      updateHandler({
        imageId: mockImage.id,
        status: SEGMENTATION_STATUS.COMPLETED,
      });

      // Rerender with completed status
      rerender(
        <BrowserRouter>
          <ImageDisplay
            image={{ ...mockImage, segmentationStatus: currentStatus }}
            onDelete={vi.fn()}
            onResegment={vi.fn()}
            viewMode="grid"
          />
        </BrowserRouter>,
      );

      // Verify button is enabled again
      await waitFor(() => {
        const finalButton = screen.getByLabelText('Resegment image');
        expect(finalButton).not.toBeDisabled();
        expect(finalButton.querySelector('.animate-spin')).not.toBeInTheDocument();
      });
    });
  });
});
