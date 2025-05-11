import React, { useState, useMemo } from 'react';
import { SegmentationResult } from '@/lib/segmentation';
import { calculateMetrics } from '../../../utils/metricCalculations';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { Info } from 'lucide-react';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MetricsChartCard, BarChartContainer, PieChartContainer } from '@/components/charts';

interface MetricsVisualizationProps {
  segmentation: SegmentationResult;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FF6B6B', '#6B66FF'];

const MetricsVisualization: React.FC<MetricsVisualizationProps> = ({ segmentation }) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('bar');

  // Get external polygons for metrics
  const externalPolygons = useMemo(
    () => segmentation.polygons.filter((polygon) => polygon.type === 'external'),
    [segmentation.polygons],
  );

  // Calculate metrics for all polygons
  const allMetrics = useMemo(() => {
    // Find internal polygons (holes)
    const holes = segmentation.polygons.filter((p) => p.type === 'internal');

    return externalPolygons.map((polygon, index) => {
      const metrics = calculateMetrics(polygon, holes);
      return {
        id: index + 1,
        name: `Sféroid #${index + 1}`,
        ...metrics,
      };
    });
  }, [externalPolygons, segmentation.polygons]);

  // Prepare data for bar chart
  const barChartData = useMemo(() => {
    if (!allMetrics.length) return [];

    // Create data for key metrics
    return [
      {
        name: t('metrics.area'),
        ...allMetrics.reduce((acc, m, i) => ({ ...acc, [`id${i + 1}`]: m.Area }), {}),
      },
      {
        name: t('metrics.perimeter'),
        ...allMetrics.reduce((acc, m, i) => ({ ...acc, [`id${i + 1}`]: m.Perimeter }), {}),
      },
      {
        name: t('metrics.circularity'),
        ...allMetrics.reduce((acc, m, i) => ({ ...acc, [`id${i + 1}`]: m.Circularity }), {}),
      },
      {
        name: t('metrics.sphericity'),
        ...allMetrics.reduce((acc, m, i) => ({ ...acc, [`id${i + 1}`]: m.Sphericity }), {}),
      },
      {
        name: t('metrics.solidity'),
        ...allMetrics.reduce((acc, m, i) => ({ ...acc, [`id${i + 1}`]: m.Solidity }), {}),
      },
    ];
  }, [allMetrics, t]);

  // Prepare data for pie chart
  const pieChartData = useMemo(() => {
    if (!allMetrics.length) return [];

    return allMetrics.map((m) => ({
      name: m.name,
      value: m.Area,
    }));
  }, [allMetrics]);

  // Prepare data for comparison chart
  const comparisonData = useMemo(() => {
    if (!allMetrics.length) return [];

    return allMetrics.map((m) => ({
      name: m.name,
      circularity: m.Circularity,
      sphericity: m.Sphericity,
      solidity: m.Solidity,
      compactness: m.Compactness,
      convexity: m.Convexity,
    }));
  }, [allMetrics]);

  // Chart configuration
  const chartConfig = {
    area: { label: t('metrics.area'), color: '#0088FE' },
    perimeter: { label: t('metrics.perimeter'), color: '#00C49F' },
    circularity: { label: t('metrics.circularity'), color: '#FFBB28' },
    sphericity: { label: t('metrics.sphericity'), color: '#FF8042' },
    solidity: { label: t('metrics.solidity'), color: '#8884D8' },
    compactness: { label: t('metrics.compactness'), color: '#82CA9D' },
    convexity: { label: t('metrics.convexity'), color: '#FF6B6B' },
  };

  if (externalPolygons.length === 0) {
    return <div className="text-center py-8 text-gray-500 dark:text-gray-400">{t('metrics.noPolygonsFound')}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">{t('metrics.visualization')}</h3>
        <TooltipProvider>
          <UITooltip>
            <TooltipTrigger asChild>
              <Info className="h-5 w-5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('metrics.visualizationHelp')}</p>
            </TooltipContent>
          </UITooltip>
        </TooltipProvider>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="bar">{t('metrics.barChart')}</TabsTrigger>
          <TabsTrigger value="pie">{t('metrics.pieChart')}</TabsTrigger>
          <TabsTrigger value="comparison">{t('metrics.comparisonChart')}</TabsTrigger>
        </TabsList>

        <TabsContent value="bar" className="pt-4">
          <MetricsChartCard title={t('metrics.keyMetricsComparison')}>
            <BarChartContainer
              data={barChartData}
              config={chartConfig}
              bars={allMetrics.map((_, index) => ({
                dataKey: `id${index + 1}`,
                name: `Sféroid #${index + 1}`,
                color: COLORS[index % COLORS.length],
              }))}
            />
          </MetricsChartCard>
        </TabsContent>

        <TabsContent value="pie" className="pt-4">
          <MetricsChartCard title={t('metrics.areaDistribution')}>
            <PieChartContainer
              data={pieChartData}
              colors={COLORS}
              tooltipFormatter={(value) => [`${value.toFixed(2)} px²`, t('metrics.area')]}
            />
          </MetricsChartCard>
        </TabsContent>

        <TabsContent value="comparison" className="pt-4">
          <MetricsChartCard title={t('metrics.shapeMetricsComparison')}>
            <BarChartContainer
              data={comparisonData}
              config={chartConfig}
              bars={[
                {
                  dataKey: 'circularity',
                  name: t('metrics.circularity'),
                  color: '#FFBB28',
                },
                {
                  dataKey: 'sphericity',
                  name: t('metrics.sphericity'),
                  color: '#FF8042',
                },
                {
                  dataKey: 'solidity',
                  name: t('metrics.solidity'),
                  color: '#8884D8',
                },
                {
                  dataKey: 'compactness',
                  name: t('metrics.compactness'),
                  color: '#82CA9D',
                },
                {
                  dataKey: 'convexity',
                  name: t('metrics.convexity'),
                  color: '#FF6B6B',
                },
              ]}
            />
          </MetricsChartCard>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MetricsVisualization;
