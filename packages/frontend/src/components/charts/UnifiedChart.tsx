import React, { useRef, useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ComposedChart,
  Treemap,
  Funnel,
  FunnelChart,
  Sankey,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import { chartService, type ChartConfig } from '@/services/chartService';
import { useTheme } from '@/store';
import { cn } from '@/utils/cn';

interface UnifiedChartProps extends ChartConfig {
  className?: string;
  onDataClick?: (data: any) => void;
  showExportButtons?: boolean;
  containerRef?: React.RefObject<HTMLDivElement>;
}

/**
 * UnifiedChart - A single component for all chart types
 * Automatically selects the appropriate Recharts component based on type
 */
export function UnifiedChart({
  type,
  data,
  dataKeys = [],
  xAxisKey = 'name',
  yAxisKey = 'value',
  title,
  subtitle,
  showLegend = true,
  showTooltip = true,
  showGrid = true,
  height = 400,
  width = '100%',
  responsive = true,
  animate = true,
  theme: themeOverride,
  colors: customColors,
  margin = { top: 20, right: 20, bottom: 20, left: 20 },
  customOptions = {},
  className,
  onDataClick,
  showExportButtons = false,
  containerRef,
}: UnifiedChartProps) {
  const internalRef = useRef<HTMLDivElement>(null);
  const chartRef = containerRef || internalRef;
  const { theme: appTheme } = useTheme();
  const [isExporting, setIsExporting] = useState(false);
  
  // Get theme configuration
  const theme = chartService.getTheme(themeOverride || (appTheme === 'system' ? 'auto' : appTheme));
  const colors = customColors || theme.colors.primary;

  // Handle export functions
  const handleExportImage = async (format: 'png' | 'jpeg' | 'svg') => {
    if (!chartRef.current) return;
    setIsExporting(true);
    try {
      await chartService.exportChartAsImage(chartRef.current, title || 'chart', format);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportData = () => {
    chartService.exportChartDataAsCSV(data, title || 'chart-data');
  };

  // Common props for all charts
  const commonProps = {
    data,
    margin,
    onClick: onDataClick,
    ...customOptions,
  };

  // Common axis props
  const axisProps = {
    stroke: theme.colors.text,
    fontSize: theme.fonts.size.tick,
    fontFamily: theme.fonts.family,
  };

  // Render chart based on type
  const renderChart = () => {
    switch (type) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.grid} />}
            <XAxis dataKey={xAxisKey} {...axisProps} />
            <YAxis {...axisProps} />
            {showTooltip && <Tooltip contentStyle={getTooltipStyle()} />}
            {showLegend && <Legend />}
            {dataKeys.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
                dot={{ fill: colors[index % colors.length], r: 4 }}
                activeDot={{ r: 6 }}
                animationDuration={animate ? 1000 : 0}
              />
            ))}
          </LineChart>
        );

      case 'bar':
        return (
          <BarChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.grid} />}
            <XAxis dataKey={xAxisKey} {...axisProps} />
            <YAxis {...axisProps} />
            {showTooltip && <Tooltip contentStyle={getTooltipStyle()} />}
            {showLegend && <Legend />}
            {dataKeys.map((key, index) => (
              <Bar
                key={key}
                dataKey={key}
                fill={colors[index % colors.length]}
                animationDuration={animate ? 1000 : 0}
              >
                <LabelList position="top" />
              </Bar>
            ))}
          </BarChart>
        );

      case 'pie':
        return (
          <PieChart {...commonProps}>
            {showTooltip && <Tooltip contentStyle={getTooltipStyle()} />}
            {showLegend && <Legend />}
            <Pie
              data={data}
              dataKey={yAxisKey}
              nameKey={xAxisKey}
              cx="50%"
              cy="50%"
              outerRadius={height / 3}
              animationDuration={animate ? 1000 : 0}
              label
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
          </PieChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.grid} />}
            <XAxis dataKey={xAxisKey} {...axisProps} />
            <YAxis {...axisProps} />
            {showTooltip && <Tooltip contentStyle={getTooltipStyle()} />}
            {showLegend && <Legend />}
            {dataKeys.map((key, index) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[index % colors.length]}
                fill={colors[index % colors.length]}
                fillOpacity={0.6}
                animationDuration={animate ? 1000 : 0}
              />
            ))}
          </AreaChart>
        );

      case 'scatter':
        return (
          <ScatterChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.grid} />}
            <XAxis dataKey={xAxisKey} {...axisProps} />
            <YAxis dataKey={yAxisKey} {...axisProps} />
            {showTooltip && <Tooltip contentStyle={getTooltipStyle()} />}
            {showLegend && <Legend />}
            <Scatter
              name="Data"
              fill={colors[0]}
              animationDuration={animate ? 1000 : 0}
            />
          </ScatterChart>
        );

      case 'radar':
        return (
          <RadarChart {...commonProps}>
            <PolarGrid stroke={theme.colors.grid} />
            <PolarAngleAxis dataKey={xAxisKey} {...axisProps} />
            <PolarRadiusAxis {...axisProps} />
            {showTooltip && <Tooltip contentStyle={getTooltipStyle()} />}
            {showLegend && <Legend />}
            {dataKeys.map((key, index) => (
              <Radar
                key={key}
                name={key}
                dataKey={key}
                stroke={colors[index % colors.length]}
                fill={colors[index % colors.length]}
                fillOpacity={0.6}
                animationDuration={animate ? 1000 : 0}
              />
            ))}
          </RadarChart>
        );

      case 'composed':
        return (
          <ComposedChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.grid} />}
            <XAxis dataKey={xAxisKey} {...axisProps} />
            <YAxis {...axisProps} />
            {showTooltip && <Tooltip contentStyle={getTooltipStyle()} />}
            {showLegend && <Legend />}
            {/* Composed chart can mix different types - customize as needed */}
            {dataKeys.map((key, index) => {
              if (index === 0) {
                return (
                  <Bar
                    key={key}
                    dataKey={key}
                    fill={colors[index % colors.length]}
                    animationDuration={animate ? 1000 : 0}
                  />
                );
              }
              return (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={colors[index % colors.length]}
                  strokeWidth={2}
                  animationDuration={animate ? 1000 : 0}
                />
              );
            })}
          </ComposedChart>
        );

      case 'treemap':
        return (
          <Treemap
            {...commonProps}
            dataKey={yAxisKey}
            animationDuration={animate ? 1000 : 0}
            content={({ x, y, width, height, name, value }: any) => (
              <g>
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  style={{
                    fill: colors[Math.floor(Math.random() * colors.length)],
                    stroke: theme.colors.background,
                    strokeWidth: 2,
                  }}
                />
                <text
                  x={x + width / 2}
                  y={y + height / 2}
                  textAnchor="middle"
                  fill={theme.colors.text}
                  fontSize={theme.fonts.size.label}
                >
                  {name}
                </text>
                <text
                  x={x + width / 2}
                  y={y + height / 2 + 15}
                  textAnchor="middle"
                  fill={theme.colors.text}
                  fontSize={theme.fonts.size.tick}
                >
                  {value}
                </text>
              </g>
            )}
          />
        );

      case 'funnel':
        return (
          <FunnelChart {...commonProps}>
            {showTooltip && <Tooltip contentStyle={getTooltipStyle()} />}
            {showLegend && <Legend />}
            <Funnel
              dataKey={yAxisKey}
              animationDuration={animate ? 1000 : 0}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Funnel>
          </FunnelChart>
        );

      case 'sankey':
        return (
          <Sankey
            {...commonProps}
            link={{ stroke: theme.colors.grid }}
            nodePadding={50}
            nodeWidth={10}
            node={{ fill: colors[0] }}
          />
        );

      default:
        return <div>Unsupported chart type: {type}</div>;
    }
  };

  const getTooltipStyle = () => ({
    backgroundColor: theme.colors.tooltip.background,
    border: `1px solid ${theme.colors.tooltip.border}`,
    borderRadius: '8px',
    color: theme.colors.tooltip.text,
    fontSize: theme.fonts.size.label,
    fontFamily: theme.fonts.family,
  });

  const ChartWrapper = responsive ? ResponsiveContainer : React.Fragment;
  const wrapperProps = responsive ? { width, height } : {};

  return (
    <div className={cn('unified-chart', className)} ref={chartRef}>
      {/* Chart Header */}
      {(title || subtitle || showExportButtons) && (
        <div className="flex items-start justify-between mb-4">
          <div>
            {title && (
              <h3 
                className="text-lg font-semibold" 
                style={{ 
                  color: theme.colors.text,
                  fontSize: theme.fonts.size.title,
                  fontFamily: theme.fonts.family,
                }}
              >
                {title}
              </h3>
            )}
            {subtitle && (
              <p 
                className="text-sm opacity-70 mt-1"
                style={{ 
                  color: theme.colors.text,
                  fontSize: theme.fonts.size.subtitle,
                  fontFamily: theme.fonts.family,
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
          
          {showExportButtons && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExportImage('png')}
                disabled={isExporting}
                className="px-3 py-1 text-xs rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
                style={{ color: theme.colors.text }}
              >
                PNG
              </button>
              <button
                onClick={() => handleExportImage('svg')}
                disabled={isExporting}
                className="px-3 py-1 text-xs rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
                style={{ color: theme.colors.text }}
              >
                SVG
              </button>
              <button
                onClick={handleExportData}
                className="px-3 py-1 text-xs rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
                style={{ color: theme.colors.text }}
              >
                CSV
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* Chart Container */}
      <ChartWrapper {...wrapperProps}>
        {renderChart()}
      </ChartWrapper>
    </div>
  );
}