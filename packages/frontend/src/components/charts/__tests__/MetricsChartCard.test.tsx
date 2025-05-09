import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import MetricsChartCard from '../MetricsChartCard';

// Mock dependencies
vi.mock('@/components/ui/card', () => ({
  Card: ({ className, children }: { className: string, children: React.ReactNode }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-header">{children}</div>
  ),
  CardTitle: ({ children }: { children: React.ReactNode }) => (
    <h3 data-testid="card-title">{children}</h3>
  ),
  CardContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-content">{children}</div>
  )
}));

describe('MetricsChartCard Component', () => {
  it('renders correctly with default props', () => {
    const testContent = <div data-testid="chart-content">Test Chart</div>;
    render(
      <MetricsChartCard title="Test Chart">
        {testContent}
      </MetricsChartCard>
    );
    
    // Check title rendering
    const title = screen.getByTestId('card-title');
    expect(title).toHaveTextContent('Test Chart');
    
    // Check content rendering
    const content = screen.getByTestId('chart-content');
    expect(content).toBeInTheDocument();
    
    // Check default height is applied
    const chartContainer = content.parentElement;
    expect(chartContainer).toHaveStyle('height: 400px');
  });
  
  it('applies custom height correctly', () => {
    render(
      <MetricsChartCard title="Test Chart" height={500}>
        <div>Test Content</div>
      </MetricsChartCard>
    );
    
    // Get the chart container div and check its height
    const chartContainer = screen.getByText('Test Content').parentElement;
    expect(chartContainer).toHaveStyle('height: 500px');
  });
  
  it('accepts string height value', () => {
    render(
      <MetricsChartCard title="Test Chart" height="50vh">
        <div>Test Content</div>
      </MetricsChartCard>
    );
    
    // Get the chart container div and check its height
    const chartContainer = screen.getByText('Test Content').parentElement;
    expect(chartContainer).toHaveStyle('height: 50vh');
  });
  
  it('applies custom className to Card component', () => {
    render(
      <MetricsChartCard title="Test Chart" className="custom-class">
        <div>Test Content</div>
      </MetricsChartCard>
    );
    
    // Check that the custom class is applied to the card
    const card = screen.getByTestId('card');
    expect(card).toHaveClass('custom-class');
  });
});