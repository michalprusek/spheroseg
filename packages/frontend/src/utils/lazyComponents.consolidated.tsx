/**
 * Centralized Lazy Component Definitions
 * 
 * This file consolidates all lazy-loaded component definitions in one place
 * using the consolidated code splitting utilities.
 */

import { lazyWithRetry, createCodeSplitComponent } from './codeSplitting.consolidated';

// Page Components
export const pages = {
  // Public pages
  Index: lazyWithRetry(() => import('@/pages/Index'), { 
    chunkName: 'index-page',
    preload: true 
  }),
  
  SignIn: lazyWithRetry(() => import('@/pages/SignIn'), { 
    chunkName: 'signin-page' 
  }),
  
  SignUp: lazyWithRetry(() => import('@/pages/SignUp'), { 
    chunkName: 'signup-page'
  }),
  
  ForgotPassword: lazyWithRetry(() => import('@/pages/ForgotPassword'), {
    chunkName: 'forgot-password-page'
  }),
  
  VerifyEmail: lazyWithRetry(() => import('@/pages/VerifyEmail'), {
    chunkName: 'verify-email-page'
  }),
  
  RequestAccess: lazyWithRetry(() => import('@/pages/RequestAccess'), {
    chunkName: 'request-access-page'
  }),
  
  AcceptInvitation: lazyWithRetry(() => import('@/pages/AcceptInvitation'), {
    chunkName: 'accept-invitation-page'
  }),
  
  // Protected pages
  Dashboard: lazyWithRetry(() => import('@/pages/Dashboard'), {
    chunkName: 'dashboard-page',
    preload: true
  }),
  
  ProjectDetail: lazyWithRetry(() => import('@/pages/ProjectDetail'), {
    chunkName: 'project-detail-page',
    preload: true
  }),
  
  SegmentationPage: lazyWithRetry(() => import('@/pages/segmentation/SegmentationPage'), {
    chunkName: 'segmentation-page',
    preload: true
  }),
  
  SegmentationEditorRedirect: lazyWithRetry(
    () => import('@/pages/segmentation/SegmentationEditorRedirect'), {
      chunkName: 'segmentation-redirect'
    }
  ),
  
  ProjectExport: lazyWithRetry(() => import('@/pages/export/ProjectExport'), {
    chunkName: 'project-export-page'
  }),
  
  Settings: lazyWithRetry(() => import('@/pages/Settings'), {
    chunkName: 'settings-page'
  }),
  
  Profile: lazyWithRetry(() => import('@/pages/Profile'), {
    chunkName: 'profile-page'
  }),
  
  // Static pages
  Documentation: lazyWithRetry(() => import('@/pages/Documentation'), {
    chunkName: 'documentation-page'
  }),
  
  AboutPage: lazyWithRetry(() => import('@/pages/AboutPage'), {
    chunkName: 'about-page'
  }),
  
  TermsOfService: lazyWithRetry(() => import('@/pages/TermsOfService'), {
    chunkName: 'terms-page'
  }),
  
  PrivacyPolicy: lazyWithRetry(() => import('@/pages/PrivacyPolicy'), {
    chunkName: 'privacy-page'
  }),
  
  NotFound: lazyWithRetry(() => import('@/pages/NotFound'), {
    chunkName: 'notfound-page'
  }),
};

// Heavy Components
export const components = {
  // Segmentation components
  SegmentationCanvas: createCodeSplitComponent(
    () => import('@/pages/segmentation/components/canvas/CanvasContainer'),
    { chunkName: 'segmentation-canvas', prefetch: true }
  ),
  
  // Image components
  VirtualImageGrid: createCodeSplitComponent(
    () => import('@/components/project/VirtualImageGrid'),
    { chunkName: 'virtual-image-grid', prefetch: true }
  ),
  
  // Analytics components
  AnalyticsDashboard: createCodeSplitComponent(
    () => import('@/components/analytics/AnalyticsDashboardOptimized'),
    { chunkName: 'analytics-dashboard' }
  ),
  
  // Export components
  ExcelExporter: createCodeSplitComponent(
    () => import('@/pages/segmentation/components/project/export/ExcelExporter'),
    { chunkName: 'excel-exporter' }
  ),
  
  MetricsVisualization: createCodeSplitComponent(
    () => import('@/pages/segmentation/components/project/export/MetricsVisualization'),
    { chunkName: 'metrics-viz' }
  ),
  
  // 3D visualization
  Viewer3D: createCodeSplitComponent(
    () => import('@/components/visualization/3DViewer'),
    { chunkName: '3d-viewer' }
  ),
};

// External Libraries (heavy dependencies)
export const libraries = {
  // Chart library (commented out - dependency not installed)
  // recharts: createCodeSplitComponent(
  //   () => import('recharts'),
  //   { chunkName: 'vendor-recharts', prefetch: true }
  // ),
  
  // PDF generation (commented out - dependency not installed)
  // jsPDF: createCodeSplitComponent(
  //   () => import('jspdf').then(module => ({
  //     default: module.default || module.jsPDF
  //   })),
  //   { chunkName: 'vendor-jspdf' }
  // ),

  // Excel generation (commented out - dependency not installed)
  // xlsx: createCodeSplitComponent(
  //   () => import('xlsx'),
  //   { chunkName: 'vendor-xlsx' }
  // ),

  // Image processing (commented out - dependency not installed)
  // jimp: createCodeSplitComponent(
  //   () => import('jimp').then(module => ({
  //     default: module.default || module
  //   })),
  //   { chunkName: 'vendor-jimp' }
  // ),
  
  // Code editor (commented out - dependency not installed)
  // monaco: createCodeSplitComponent(
  //   () => import('@monaco-editor/react'),
  //   { chunkName: 'vendor-monaco' }
  // ),
};

// Feature-based loading
export async function loadFeature(feature: string) {
  const featureMap: Record<string, () => Promise<any>> = {
    'segmentation': () => import('@/pages/segmentation/SegmentationPage'),
    'export': () => import('@/pages/export/ProjectExport'),
    'analytics': () => import('@/components/analytics/AnalyticsDashboardOptimized'),
    'settings': () => import('@/pages/Settings'),
    'profile': () => import('@/pages/Profile'),
  };
  
  const loader = featureMap[feature];
  if (!loader) {
    throw new Error(`Unknown feature: ${feature}`);
  }
  
  return loader();
}

// Route configuration with lazy components
export const routes = {
  public: [
    { path: '/', component: pages.Index, preload: true },
    { path: '/sign-in', component: pages.SignIn },
    { path: '/sign-up', component: pages.SignUp },
    { path: '/forgot-password', component: pages.ForgotPassword },
    { path: '/verify-email', component: pages.VerifyEmail },
    { path: '/request-access', component: pages.RequestAccess },
    { path: '/accept-invitation', component: pages.AcceptInvitation },
    { path: '/documentation', component: pages.Documentation },
    { path: '/about', component: pages.AboutPage },
    { path: '/terms-of-service', component: pages.TermsOfService },
    { path: '/privacy-policy', component: pages.PrivacyPolicy },
  ],
  
  protected: [
    { path: '/dashboard', component: pages.Dashboard, preload: true },
    { path: '/projects/:id', component: pages.ProjectDetail, preload: true },
    { path: '/segmentation/:id', component: pages.SegmentationPage, preload: true },
    { path: '/images/:imageId/segmentation', component: pages.SegmentationEditorRedirect },
    { path: '/projects/:id/export', component: pages.ProjectExport },
    { path: '/settings', component: pages.Settings },
    { path: '/profile', component: pages.Profile },
  ],
  
  fallback: { path: '*', component: pages.NotFound },
};

// Preload critical routes
export function preloadCriticalRoutes() {
  const criticalRoutes = routes.public
    .concat(routes.protected)
    .filter(route => route.preload);
  
  criticalRoutes.forEach(route => {
    const component = route.component as any;
    if (component.preload) {
      component.preload();
    }
  });
}

// Export all definitions
export default {
  pages,
  components,
  libraries,
  routes,
  loadFeature,
  preloadCriticalRoutes,
};