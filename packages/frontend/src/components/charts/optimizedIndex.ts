/**
 * Optimized exports for chart components
 * 
 * Instead of using barrel exports which prevent tree-shaking,
 * this file provides lazy imports for each component.
 * 
 * Usage:
 * import { getChartComponent } from './charts/optimizedIndex';
 * const UnifiedChart = await getChartComponent('UnifiedChart');
 */

import { lazy, LazyExoticComponent, ComponentType } from 'react';

// Map of component names to their lazy imports
const chartComponents = {
  UnifiedChart: () => import('./UnifiedChart'),
  ChartBuilder: () => import('./ChartBuilder'),
  ChartGrid: () => import('./ChartGrid'),
  StatCard: () => import('./StatCard'),
  BarChartContainer: () => import('./BarChartContainer'),
  PieChartContainer: () => import('./PieChartContainer'),
} as const;

// Type for available chart components
export type ChartComponentName = keyof typeof chartComponents;

// Cache for loaded components
const componentCache = new Map<ChartComponentName, LazyExoticComponent<ComponentType<any>>>();

/**
 * Get a lazy-loaded chart component by name
 */
export function getLazyChartComponent(name: ChartComponentName): LazyExoticComponent<ComponentType<any>> {
  if (!componentCache.has(name)) {
    const lazyComponent = lazy(chartComponents[name]);
    componentCache.set(name, lazyComponent);
  }
  return componentCache.get(name)!;
}

/**
 * Preload a chart component
 */
export async function preloadChartComponent(name: ChartComponentName): Promise<void> {
  await chartComponents[name]();
}

/**
 * Preload all chart components (use sparingly)
 */
export async function preloadAllChartComponents(): Promise<void> {
  const promises = Object.values(chartComponents).map(importFn => importFn());
  await Promise.all(promises);
}

/**
 * Get component import function for dynamic imports
 */
export function getChartComponentImport(name: ChartComponentName) {
  return chartComponents[name];
}

// For backward compatibility, export lazy versions directly
// But encourage using the functions above instead
export const LazyUnifiedChart = lazy(() => import('./UnifiedChart'));
export const LazyChartBuilder = lazy(() => import('./ChartBuilder'));
export const LazyChartGrid = lazy(() => import('./ChartGrid'));
export const LazyStatCard = lazy(() => import('./StatCard'));
export const LazyBarChartContainer = lazy(() => import('./BarChartContainer'));
export const LazyPieChartContainer = lazy(() => import('./PieChartContainer'));