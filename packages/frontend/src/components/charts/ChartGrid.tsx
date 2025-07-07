import React from 'react';
import { UnifiedChart } from './UnifiedChart';
import type { ChartConfig } from '@/services/chartService';
import { cn } from '@/utils/cn';

interface ChartGridProps {
  charts: ChartConfig[];
  columns?: 1 | 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
  showExportButtons?: boolean;
  onChartClick?: (chart: ChartConfig, index: number) => void;
}

/**
 * ChartGrid - Display multiple charts in a responsive grid layout
 */
export function ChartGrid({
  charts,
  columns = 2,
  gap = 'md',
  className,
  showExportButtons = false,
  onChartClick,
}: ChartGridProps) {
  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
  };

  const columnClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 lg:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div
      className={cn(
        'grid',
        columnClasses[columns],
        gapClasses[gap],
        className
      )}
    >
      {charts.map((chart, index) => (
        <div
          key={index}
          className={cn(
            'bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-4',
            onChartClick && 'cursor-pointer hover:shadow-md transition-shadow'
          )}
          onClick={() => onChartClick?.(chart, index)}
        >
          <UnifiedChart
            {...chart}
            showExportButtons={showExportButtons}
            responsive={true}
          />
        </div>
      ))}
    </div>
  );
}