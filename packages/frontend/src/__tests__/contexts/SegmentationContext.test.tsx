import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { SegmentationProvider, useSegmentationContext } from '@/pages/segmentation/contexts/SegmentationContext';
import '@testing-library/jest-dom';

// Mock segmentation data
const mockSegmentation = {
  id: 'test-segmentation-id',
  imageSrc: 'https://example.com/image.jpg',
  polygons: [
    {
      id: 'polygon-1',
      points: [
        { x: 10, y: 10 },
        { x: 100, y: 10 },
        { x: 100, y: 100 },
        { x: 10, y: 100 }
      ],
      type: 'external',
      class: 'spheroid'
    }
  ],
  status: 'completed',
  timestamp: new Date()
};

// Test component that uses the segmentation context
const TestComponent = () => {
  const { segmentation, loading } = useSegmentationContext();

  return (
    <div>
      <div data-testid="loading-status">{loading ? 'Loading' : 'Not Loading'}</div>
      {segmentation ? (
        <div>
          <div data-testid="segmentation-id">{segmentation.id}</div>
          <div data-testid="polygon-count">{segmentation.polygons.length}</div>
          <div data-testid="segmentation-status">{segmentation.status}</div>
        </div>
      ) : (
        <div data-testid="no-segmentation">No segmentation data</div>
      )}
    </div>
  );
};

describe('SegmentationContext', () => {
  it('provides segmentation data to child components', () => {
    render(
      <SegmentationProvider segmentation={mockSegmentation} loading={false}>
        <TestComponent />
      </SegmentationProvider>
    );

    // Check if segmentation data is provided
    expect(screen.getByTestId('segmentation-id')).toHaveTextContent('test-segmentation-id');
    expect(screen.getByTestId('polygon-count')).toHaveTextContent('1');
    expect(screen.getByTestId('segmentation-status')).toHaveTextContent('completed');
    expect(screen.getByTestId('loading-status')).toHaveTextContent('Not Loading');
  });

  it('handles null segmentation data', () => {
    render(
      <SegmentationProvider segmentation={null} loading={false}>
        <TestComponent />
      </SegmentationProvider>
    );

    // Check if no segmentation message is displayed
    expect(screen.getByTestId('no-segmentation')).toBeInTheDocument();
    expect(screen.getByTestId('loading-status')).toHaveTextContent('Not Loading');
  });

  it('handles loading state', () => {
    render(
      <SegmentationProvider segmentation={null} loading={true}>
        <TestComponent />
      </SegmentationProvider>
    );

    // Check if loading state is provided
    expect(screen.getByTestId('loading-status')).toHaveTextContent('Loading');
  });
});
