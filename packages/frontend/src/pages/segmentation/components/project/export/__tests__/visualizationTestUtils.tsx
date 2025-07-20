import React from 'react';
import { vi, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LanguageProvider } from '@/contexts/LanguageContext';

// Mock segmentation data for tests
export const mockVisualizationSegmentation = {
  id: 'test-segmentation-id',
  imageId: 'test-image-id',
  status: 'completed' as const,
  polygons: [
    {
      id: 'polygon-1',
      points: [
        { x: 10, y: 10 },
        { x: 100, y: 10 },
        { x: 100, y: 100 },
        { x: 10, y: 100 },
      ],
      type: 'external' as const,
    },
    {
      id: 'polygon-2',
      points: [
        { x: 200, y: 200 },
        { x: 300, y: 200 },
        { x: 300, y: 300 },
        { x: 200, y: 300 },
      ],
      type: 'external' as const,
    },
  ],
};

// Empty segmentation for testing error states
export const emptyVisualizationSegmentation = {
  ...mockVisualizationSegmentation,
  polygons: [],
};


// Render helper for visualization components
export function renderVisualization(ui: React.ReactElement, options = {}) {
  return render(
    <LanguageProvider>
      {ui}
    </LanguageProvider>,
    options
  );
}

// Test helper functions for common visualization assertions
export function verifyBarChartPresent(screen: any) {
  expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  expect(screen.getByTestId('x-axis')).toBeInTheDocument();
  expect(screen.getByTestId('y-axis')).toBeInTheDocument();
}

export function verifyBarCount(screen: any, expectedCount: number) {
  const bars = screen.getAllByTestId(/^bar-id/);
  expect(bars.length).toBe(expectedCount);
}

export function verifyPieChartPresent(screen: any) {
  expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
  expect(screen.getByTestId('pie')).toBeInTheDocument();
}

export function verifyChartTabs(screen: any) {
  expect(screen.getByText('metrics.pieChart')).toBeInTheDocument();
  expect(screen.getByText('metrics.comparisonChart')).toBeInTheDocument();
}

export function verifyEmptyState(screen: any) {
  expect(screen.getByText('metrics.noPolygonsFound')).toBeInTheDocument();
  expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
  expect(screen.queryByTestId('pie-chart')).not.toBeInTheDocument();
}
