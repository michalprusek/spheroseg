import React, { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MetricsChartCardProps {
  title: string;
  children: ReactNode;
  className?: string;
  height?: number | string;
}

/**
 * Reusable card component for metrics visualizations
 */
const MetricsChartCard: React.FC<MetricsChartCardProps> = ({
  title,
  children,
  className = '',
  height = 400
}) => {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ height: typeof height === 'number' ? `${height}px` : height }}>
          {children}
        </div>
      </CardContent>
    </Card>
  );
};

export default MetricsChartCard;