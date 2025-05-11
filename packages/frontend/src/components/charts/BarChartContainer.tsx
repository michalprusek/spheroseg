import React from 'react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface ChartConfig {
  [key: string]: {
    label: string;
    color: string;
  };
}

interface BarChartContainerProps {
  data: any[];
  config: ChartConfig;
  bars: {
    dataKey: string;
    name: string;
    color?: string;
  }[];
}

/**
 * Reusable bar chart container component
 */
const BarChartContainer: React.FC<BarChartContainerProps> = ({ data, config, bars }) => {
  return (
    <ChartContainer config={config}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        {bars.map((bar, index) => (
          <Bar
            key={`bar-${index}`}
            dataKey={bar.dataKey}
            name={bar.name}
            fill={bar.color || config[bar.dataKey]?.color || '#888'}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
};

export default BarChartContainer;
