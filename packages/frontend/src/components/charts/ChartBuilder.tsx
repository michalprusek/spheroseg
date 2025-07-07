import React, { useState } from 'react';
import { UnifiedChart } from './UnifiedChart';
import { chartService, COLOR_PALETTES, type ChartConfig, type ChartType } from '@/services/chartService';
import { useConfig } from '@/hooks/useConfig';
import { cn } from '@/utils/cn';

interface ChartBuilderProps {
  data: any[];
  defaultType?: ChartType;
  defaultConfig?: Partial<ChartConfig>;
  showBuilder?: boolean;
  className?: string;
  onConfigChange?: (config: ChartConfig) => void;
}

/**
 * ChartBuilder - Interactive chart configuration component
 * Allows users to dynamically configure and preview charts
 */
export function ChartBuilder({
  data,
  defaultType = 'bar',
  defaultConfig = {},
  showBuilder = true,
  className,
  onConfigChange,
}: ChartBuilderProps) {
  const config = useConfig();
  const [chartConfig, setChartConfig] = useState<ChartConfig>(() => 
    chartService.createChartConfig({
      type: defaultType,
      data,
      ...defaultConfig,
    })
  );

  // Extract data keys from the first data item
  const dataKeys = data.length > 0 ? Object.keys(data[0]).filter(key => 
    typeof data[0][key] === 'number'
  ) : [];
  
  const allKeys = data.length > 0 ? Object.keys(data[0]) : [];

  const updateConfig = (updates: Partial<ChartConfig>) => {
    const newConfig = { ...chartConfig, ...updates };
    setChartConfig(newConfig);
    onConfigChange?.(newConfig);
  };

  const chartTypes: { value: ChartType; label: string; description: string }[] = [
    { value: 'line', label: 'Line Chart', description: 'Show trends over time' },
    { value: 'bar', label: 'Bar Chart', description: 'Compare values across categories' },
    { value: 'pie', label: 'Pie Chart', description: 'Show proportions of a whole' },
    { value: 'area', label: 'Area Chart', description: 'Show cumulative values over time' },
    { value: 'scatter', label: 'Scatter Plot', description: 'Show correlations between variables' },
    { value: 'radar', label: 'Radar Chart', description: 'Compare multiple variables' },
    { value: 'composed', label: 'Composed Chart', description: 'Combine different chart types' },
    { value: 'treemap', label: 'Treemap', description: 'Show hierarchical data' },
    { value: 'funnel', label: 'Funnel Chart', description: 'Show progressive reduction' },
  ];

  const colorPalettes = Object.keys(COLOR_PALETTES) as Array<keyof typeof COLOR_PALETTES>;

  if (!showBuilder) {
    return <UnifiedChart {...chartConfig} className={className} />;
  }

  return (
    <div className={cn('chart-builder', className)}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-lg font-semibold">Chart Configuration</h3>
          
          {/* Chart Type */}
          <div>
            <label className="block text-sm font-medium mb-2">Chart Type</label>
            <select
              value={chartConfig.type}
              onChange={(e) => updateConfig({ type: e.target.value as ChartType })}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
            >
              {chartTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {chartTypes.find(t => t.value === chartConfig.type)?.description}
            </p>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2">Title</label>
            <input
              type="text"
              value={chartConfig.title || ''}
              onChange={(e) => updateConfig({ title: e.target.value })}
              placeholder="Chart title"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
            />
          </div>

          {/* Subtitle */}
          <div>
            <label className="block text-sm font-medium mb-2">Subtitle</label>
            <input
              type="text"
              value={chartConfig.subtitle || ''}
              onChange={(e) => updateConfig({ subtitle: e.target.value })}
              placeholder="Chart subtitle"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
            />
          </div>

          {/* Data Configuration */}
          {chartConfig.type !== 'pie' && chartConfig.type !== 'treemap' && chartConfig.type !== 'funnel' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">X-Axis Key</label>
                <select
                  value={chartConfig.xAxisKey || ''}
                  onChange={(e) => updateConfig({ xAxisKey: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
                >
                  <option value="">Select key</option>
                  {allKeys.map((key) => (
                    <option key={key} value={key}>
                      {key}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Data Keys</label>
                <div className="space-y-2">
                  {dataKeys.map((key) => (
                    <label key={key} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={chartConfig.dataKeys?.includes(key) ?? false}
                        onChange={(e) => {
                          const newKeys = e.target.checked
                            ? [...(chartConfig.dataKeys || []), key]
                            : (chartConfig.dataKeys || []).filter(k => k !== key);
                          updateConfig({ dataKeys: newKeys });
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm">{key}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Color Palette */}
          <div>
            <label className="block text-sm font-medium mb-2">Color Palette</label>
            <select
              value={colorPalettes.find(p => 
                JSON.stringify(COLOR_PALETTES[p]) === JSON.stringify(chartConfig.colors)
              ) || 'default'}
              onChange={(e) => updateConfig({ 
                colors: COLOR_PALETTES[e.target.value as keyof typeof COLOR_PALETTES] 
              })}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
            >
              {colorPalettes.map((palette) => (
                <option key={palette} value={palette}>
                  {palette.charAt(0).toUpperCase() + palette.slice(1)}
                </option>
              ))}
            </select>
            <div className="flex gap-1 mt-2">
              {chartConfig.colors?.slice(0, 8).map((color, index) => (
                <div
                  key={index}
                  className="w-6 h-6 rounded"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Display Options */}
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={chartConfig.showLegend}
                onChange={(e) => updateConfig({ showLegend: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm">Show Legend</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={chartConfig.showTooltip}
                onChange={(e) => updateConfig({ showTooltip: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm">Show Tooltip</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={chartConfig.showGrid}
                onChange={(e) => updateConfig({ showGrid: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm">Show Grid</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={chartConfig.animate}
                onChange={(e) => updateConfig({ animate: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm">Enable Animation</span>
            </label>
          </div>

          {/* Dimensions */}
          <div>
            <label className="block text-sm font-medium mb-2">Height (px)</label>
            <input
              type="number"
              value={chartConfig.height || 400}
              onChange={(e) => updateConfig({ height: parseInt(e.target.value, 10) })}
              min="200"
              max="800"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
        </div>

        {/* Chart Preview */}
        <div className="lg:col-span-2">
          <div className="border rounded-lg p-4 dark:border-gray-700">
            <UnifiedChart {...chartConfig} showExportButtons />
          </div>
          
          {/* Data Preview */}
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Data Preview</h4>
            <div className="border rounded-md overflow-hidden dark:border-gray-700">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    {allKeys.map((key) => (
                      <th key={key} className="px-3 py-2 text-left font-medium">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-700">
                  {data.slice(0, 5).map((row, index) => (
                    <tr key={index}>
                      {allKeys.map((key) => (
                        <td key={key} className="px-3 py-2">
                          {typeof row[key] === 'number' 
                            ? chartService.formatNumber(row[key])
                            : row[key]
                          }
                        </td>
                      ))}
                    </tr>
                  ))}
                  {data.length > 5 && (
                    <tr>
                      <td colSpan={allKeys.length} className="px-3 py-2 text-center text-gray-500">
                        ... and {data.length - 5} more rows
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}