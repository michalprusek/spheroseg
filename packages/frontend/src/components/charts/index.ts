/**
 * Unified Chart Components
 * Export all chart-related components and utilities
 */

// Core components
export { UnifiedChart } from './UnifiedChart';
export { ChartBuilder } from './ChartBuilder';
export { ChartGrid } from './ChartGrid';
export { StatCard, StatGrid } from './StatCard';

// Legacy components (for backward compatibility)
export { MetricsChartCard } from './MetricsChartCard';
export { BarChartContainer } from './BarChartContainer';
export { PieChartContainer } from './PieChartContainer';

// Re-export chart service utilities
export { chartService, COLOR_PALETTES } from '@/services/chartService';
export type { ChartConfig, ChartType, ChartTheme } from '@/services/chartService';