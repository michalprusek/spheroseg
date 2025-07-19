/**
 * Lazy-loaded heavy components with code splitting
 *
 * This file demonstrates component-level code splitting for heavy components
 * that should be loaded on-demand to improve initial bundle size.
 */

import { lazy, Suspense, ComponentType, useState, useRef, useEffect } from 'react';
import LoadingFallback from './LoadingFallback';
import { createCodeSplitComponent } from '@/utils/codeSplitting';
import logger from '@/utils/logger';

// Heavy visualization components
export const LazySegmentationCanvas = lazy(() =>
  import(
    /* webpackChunkName: "segmentation-canvas" */
    /* webpackPrefetch: true */
    '@/pages/segmentation/components/canvas/CanvasV2'
  ).then((module) => ({ default: module.default || module.CanvasV2 })),
);

export const LazyVirtualImageGrid = lazy(
  () =>
    import(
      /* webpackChunkName: "virtual-image-grid" */
      /* webpackPrefetch: true */
      '@/components/project/VirtualImageGrid'
    ),
);

export const LazyAnalyticsDashboard = lazy(
  () =>
    import(
      /* webpackChunkName: "analytics-dashboard" */
      '@/components/analytics/AnalyticsDashboardOptimized'
    ),
);

// Export components
export const LazyExcelExporter = lazy(
  () =>
    import(
      /* webpackChunkName: "excel-exporter" */
      '@/pages/segmentation/components/project/export/ExcelExporter'
    ),
);

export const LazyMetricsVisualization = lazy(
  () =>
    import(
      /* webpackChunkName: "metrics-viz" */
      '@/pages/segmentation/components/project/export/MetricsVisualization'
    ),
);

// Complex forms and dialogs
export const LazyProjectExportDialog = lazy(
  () =>
    import(
      /* webpackChunkName: "export-dialog" */
      '@/pages/export/ProjectExport'
    ),
);

// 3D visualization components
export const Lazy3DViewer = lazy(() =>
  import(
    /* webpackChunkName: "3d-viewer" */
    '@/components/visualization/3DViewer'
  ).catch(() => ({
    default: () => <div>3D Viewer not available</div>,
  })),
);

// Create wrapped components with loading states
export function withLazyLoading<P extends object>(
  Component: ComponentType<P>,
  loadingMessage: string = 'Loading component...',
): ComponentType<P> {
  return (props: P) => (
    <Suspense fallback={<LoadingFallback message={loadingMessage} />}>
      <Component {...props} />
    </Suspense>
  );
}

// Pre-configured lazy components with loading states
export const SegmentationCanvas = withLazyLoading(LazySegmentationCanvas, 'Loading segmentation canvas...');

export const VirtualImageGrid = withLazyLoading(LazyVirtualImageGrid, 'Loading image gallery...');

export const AnalyticsDashboard = withLazyLoading(LazyAnalyticsDashboard, 'Loading analytics...');

export const ExcelExporter = withLazyLoading(LazyExcelExporter, 'Loading Excel exporter...');

// Advanced code splitting with prefetch control
export const advancedComponents = {
  // Heavy chart library
  ChartLibrary: createCodeSplitComponent(
    () =>
      import(
        /* webpackChunkName: "charts" */
        /* webpackPrefetch: true */
        'recharts'
      ).then((module) => ({
        default: () => {
          const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } = module;
          return { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend };
        },
      })),
    { chunkName: 'charts', prefetch: true },
  ),

  // PDF generation
  PDFExporter: createCodeSplitComponent(
    () =>
      import(
        /* webpackChunkName: "pdf-export" */
        'jspdf'
      ).then((module) => ({
        default: module.default || module.jsPDF,
      })),
    { chunkName: 'pdf-export' },
  ),

  // Image processing
  ImageProcessor: createCodeSplitComponent(
    () =>
      import(
        /* webpackChunkName: "image-processing" */
        'jimp'
      ).then((module) => ({
        default: module.default || module,
      })),
    { chunkName: 'image-processing' },
  ),
};

// Conditional loading based on features
export function loadFeatureComponent(feature: string) {
  switch (feature) {
    case 'segmentation':
      return import('@/pages/segmentation/SegmentationPage');
    case 'export':
      return import('@/pages/export/ProjectExport');
    case 'analytics':
      return import('@/components/analytics/AnalyticsDashboardOptimized');
    default:
      return Promise.reject(new Error(`Unknown feature: ${feature}`));
  }
}

// Dynamic component loader with caching
const componentCache = new Map<string, ComponentType<Record<string, unknown>>>();

export async function loadDynamicComponent(componentPath: string): Promise<ComponentType<Record<string, unknown>>> {
  if (componentCache.has(componentPath)) {
    return componentCache.get(componentPath)!;
  }

  try {
    const module = await import(componentPath);
    const Component = module.default || module[Object.keys(module)[0]];
    componentCache.set(componentPath, Component);
    return Component;
  } catch (error) {
    logger.error(`Failed to load component: ${componentPath}`, error);
    throw error;
  }
}

// Intersection Observer for lazy loading
export function useLazyComponent(
  importFn: () => Promise<{ default: ComponentType<Record<string, unknown>> }>,
  rootMargin: string = '100px',
) {
  const [Component, setComponent] = useState<ComponentType<Record<string, unknown>> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !Component && !isLoading) {
            setIsLoading(true);
            importFn()
              .then((module) => {
                setComponent(() => module.default || module);
                setIsLoading(false);
              })
              .catch((err) => {
                setError(err);
                setIsLoading(false);
              });
          }
        });
      },
      { rootMargin },
    );

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [importFn, Component, isLoading, rootMargin]);

  return { ref, Component, isLoading, error };
}

// Example usage component
export function LazyLoadExample() {
  const {
    ref,
    Component: DynamicComponent,
    isLoading,
    error,
  } = useLazyComponent(() => import('@/components/analytics/AnalyticsDashboardOptimized'));

  return (
    <div ref={ref} style={{ minHeight: '200px' }}>
      {isLoading && <LoadingFallback message="Loading analytics..." />}
      {error && <div>Error loading component: {error.message}</div>}
      {DynamicComponent && <DynamicComponent />}
    </div>
  );
}

// Export all lazy components
export default {
  SegmentationCanvas,
  VirtualImageGrid,
  AnalyticsDashboard,
  ExcelExporter,
  advancedComponents,
  loadFeatureComponent,
  loadDynamicComponent,
  useLazyComponent,
  withLazyLoading,
};
