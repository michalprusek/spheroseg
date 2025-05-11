import React from 'react';
import { vi } from 'vitest';
import { renderWithProviders } from '../../../../../../../shared/test-utils/componentTestUtils';

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

// Setup function to add common mocks before tests
export function setupVisualizationMocks() {
  // Mock the calculateMetrics function
  vi.mock('../../../../utils/metricCalculations', () => ({
    calculateMetrics: () => ({
      Area: 1000,
      Perimeter: 200,
      EquivalentDiameter: 35.68,
      Circularity: 0.785,
      FeretDiameterMax: 50,
      FeretDiameterMaxOrthogonalDistance: 30,
      FeretDiameterMin: 25,
      FeretAspectRatio: 2,
      LengthMajorDiameterThroughCentroid: 45,
      LengthMinorDiameterThroughCentroid: 22.5,
      Compactness: 0.8,
      Convexity: 0.95,
      Solidity: 0.9,
      Sphericity: 0.75,
    }),
  }));

  // Mock the recharts components
  vi.mock('recharts', () => ({
    BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
    Bar: ({ dataKey, name }: any) => <div data-testid={`bar-${dataKey}`} data-name={name}></div>,
    XAxis: () => <div data-testid="x-axis"></div>,
    YAxis: () => <div data-testid="y-axis"></div>,
    CartesianGrid: () => <div data-testid="cartesian-grid"></div>,
    ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
    PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
    Pie: ({ data, dataKey, label }: any) => (
      <div data-testid="pie" data-items={data?.length || 0} data-key={dataKey}>
        {typeof label === 'function' && <div data-testid="pie-label"></div>}
      </div>
    ),
    Cell: () => <div data-testid="pie-cell"></div>,
    Tooltip: () => <div data-testid="tooltip"></div>,
    Legend: () => <div data-testid="legend"></div>,
  }));

  // Mock the language context
  vi.mock('@/contexts/LanguageContext', () => ({
    useLanguage: () => ({
      t: (key: string) => key,
      language: 'en',
      setLanguage: vi.fn(),
      availableLanguages: ['en', 'cs'],
    }),
  }));
}

// Render helper for visualization components
export function renderVisualization(ui: React.ReactElement, options = {}) {
  return renderWithProviders(ui, {
    withLanguage: true,
    ...options,
  });
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
