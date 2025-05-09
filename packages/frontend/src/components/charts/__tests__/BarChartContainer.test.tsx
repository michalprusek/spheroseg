import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import BarChartContainer from '../BarChartContainer';

// Mock recharts and UI components
vi.mock('recharts', () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: ({ dataKey, name, fill }: { dataKey: string, name: string, fill: string }) => (
    <div data-testid={`bar-${dataKey}`} data-name={name} data-fill={fill}>
      Bar - {dataKey}
    </div>
  ),
  XAxis: ({ dataKey }: { dataKey: string }) => <div data-testid="x-axis" data-key={dataKey}>XAxis</div>,
  YAxis: () => <div data-testid="y-axis">YAxis</div>,
  CartesianGrid: ({ strokeDasharray }: { strokeDasharray: string }) => (
    <div data-testid="cartesian-grid" data-stroke={strokeDasharray}>Grid</div>
  )
}));

vi.mock('@/components/ui/chart', () => ({
  ChartContainer: ({ children, config }: { children: React.ReactNode, config: any }) => (
    <div data-testid="chart-container" data-config={JSON.stringify(config)}>{children}</div>
  ),
  ChartTooltip: ({ content }: { content: React.ReactNode }) => (
    <div data-testid="chart-tooltip">{content}</div>
  ),
  ChartTooltipContent: () => <div data-testid="tooltip-content">Tooltip Content</div>,
  ChartLegend: ({ content }: { content: React.ReactNode }) => (
    <div data-testid="chart-legend">{content}</div>
  ),
  ChartLegendContent: () => <div data-testid="legend-content">Legend Content</div>
}));

describe('BarChartContainer Component', () => {
  const testData = [
    { name: 'Jan', value1: 100, value2: 200 },
    { name: 'Feb', value1: 200, value2: 300 },
    { name: 'Mar', value1: 150, value2: 400 }
  ];
  
  const testConfig = {
    value1: { label: 'Value 1', color: '#ff0000' },
    value2: { label: 'Value 2', color: '#00ff00' }
  };
  
  const testBars = [
    { dataKey: 'value1', name: 'Value One' },
    { dataKey: 'value2', name: 'Value Two' }
  ];
  
  it('renders chart container with correct config', () => {
    render(
      <BarChartContainer 
        data={testData} 
        config={testConfig} 
        bars={testBars} 
      />
    );
    
    const container = screen.getByTestId('chart-container');
    expect(container).toBeInTheDocument();
    
    // Check that config was passed correctly
    const configProp = JSON.parse(container.getAttribute('data-config') || '{}');
    expect(configProp).toEqual(testConfig);
  });
  
  it('renders chart components correctly', () => {
    render(
      <BarChartContainer 
        data={testData} 
        config={testConfig} 
        bars={testBars} 
      />
    );
    
    // Check for chart components
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
    expect(screen.getByTestId('chart-tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('chart-legend')).toBeInTheDocument();
  });
  
  it('renders correct number of bars with proper attributes', () => {
    render(
      <BarChartContainer 
        data={testData} 
        config={testConfig} 
        bars={testBars} 
      />
    );
    
    // Check first bar
    const bar1 = screen.getByTestId('bar-value1');
    expect(bar1).toBeInTheDocument();
    expect(bar1).toHaveAttribute('data-name', 'Value One');
    expect(bar1).toHaveAttribute('data-fill', '#ff0000');
    
    // Check second bar
    const bar2 = screen.getByTestId('bar-value2');
    expect(bar2).toBeInTheDocument();
    expect(bar2).toHaveAttribute('data-name', 'Value Two');
    expect(bar2).toHaveAttribute('data-fill', '#00ff00');
  });
  
  it('uses custom color for bar if provided', () => {
    const barsWithCustomColor = [
      { dataKey: 'value1', name: 'Value One', color: '#0000ff' },
      { dataKey: 'value2', name: 'Value Two' }
    ];
    
    render(
      <BarChartContainer 
        data={testData} 
        config={testConfig} 
        bars={barsWithCustomColor} 
      />
    );
    
    // Check that custom color is used
    const bar1 = screen.getByTestId('bar-value1');
    expect(bar1).toHaveAttribute('data-fill', '#0000ff');
    
    // Check that config color is used when no custom color
    const bar2 = screen.getByTestId('bar-value2');
    expect(bar2).toHaveAttribute('data-fill', '#00ff00');
  });
  
  it('uses fallback color if no color provided in config or bar props', () => {
    const incompleteConfig = {
      value1: { label: 'Value 1', color: '#ff0000' }
      // No entry for value2
    };
    
    render(
      <BarChartContainer 
        data={testData} 
        config={incompleteConfig} 
        bars={testBars} 
      />
    );
    
    // Check that fallback color is used
    const bar2 = screen.getByTestId('bar-value2');
    expect(bar2).toHaveAttribute('data-fill', '#888');
  });
});