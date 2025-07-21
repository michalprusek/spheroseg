import React from 'react';
import { screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import MetricsVisualization from '../../export/MetricsVisualization';
import '@testing-library/jest-dom';
import {
  mockVisualizationSegmentation,
  emptyVisualizationSegmentation,
  renderVisualization,
  verifyBarChartPresent,
  verifyBarCount,
  verifyChartTabs,
  verifyEmptyState,
} from './visualizationTestUtils';

// Mock dependencies - must be hoisted
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    language: 'en',
    setLanguage: vi.fn(),
    availableLanguages: ['en', 'cs'],
  }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../../../utils/metricCalculations', () => ({
  calculateMetrics: () => ({
    Area: 1000,
    Perimeter: 200,
    EquivalentDiameter: 35.68,
    Circularity: 0.785,
    FeretDiameterMax: 50,
    FeretDiameterMaxOrthogonalDistance: 30,
    Eccentricity: 0.8,
    ConvexArea: 1200,
    Solidity: 0.833,
  }),
}));

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

describe('MetricsVisualization Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the bar chart by default', () => {
    renderVisualization(<MetricsVisualization segmentation={mockVisualizationSegmentation} />);
    verifyBarChartPresent(screen);
  });

  it('has pie chart and comparison chart tabs', () => {
    renderVisualization(<MetricsVisualization segmentation={mockVisualizationSegmentation} />);
    verifyBarChartPresent(screen);
    verifyChartTabs(screen);
  });

  it('displays the correct number of bars for each polygon', () => {
    renderVisualization(<MetricsVisualization segmentation={mockVisualizationSegmentation} />);
    verifyBarCount(screen, 2);
  });

  it('shows a message when there are no polygons', () => {
    renderVisualization(<MetricsVisualization segmentation={emptyVisualizationSegmentation} />);
    verifyEmptyState(screen);
  });

  it('renders the info tooltip', () => {
    renderVisualization(<MetricsVisualization segmentation={mockVisualizationSegmentation} />);
    const infoIcon = screen.getByText('metrics.visualization').nextSibling;
    expect(infoIcon).toBeInTheDocument();
  });

  it('renders the bar chart title', () => {
    renderVisualization(<MetricsVisualization segmentation={mockVisualizationSegmentation} />);
    expect(screen.getByText('metrics.keyMetricsComparison')).toBeInTheDocument();
  });
});
