import React from 'react';
import { screen } from '@testing-library/react';
import { vi } from 'vitest';
import MetricsVisualization from '../../export/MetricsVisualization';
import '@testing-library/jest-dom';
import { resetAllMocks } from '../../../../../../../shared/test-utils/componentTestUtils';
import {
  mockVisualizationSegmentation,
  emptyVisualizationSegmentation,
  setupVisualizationMocks,
  renderVisualization,
  verifyBarChartPresent,
  verifyBarCount,
  verifyChartTabs,
  verifyEmptyState
} from './visualizationTestUtils';

// Setup mocks for testing
setupVisualizationMocks();

describe('MetricsVisualization Component', () => {
  beforeEach(() => {
    resetAllMocks();
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
