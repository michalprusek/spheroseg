/**
 * Centralized webpack chunk names for consistent code splitting
 * Using webpackChunkName comments for better debugging and caching
 */

// Page chunks
export const CHUNK_NAMES = {
  // Public pages
  INDEX: 'index-page',
  SIGN_IN: 'sign-in-page',
  SIGN_UP: 'sign-up-page',
  VERIFY_EMAIL: 'verify-email-page',
  DOCUMENTATION: 'documentation-page',
  ABOUT: 'about-page',
  TERMS: 'terms-page',
  PRIVACY: 'privacy-page',
  REQUEST_ACCESS: 'request-access-page',
  FORGOT_PASSWORD: 'forgot-password-page',
  
  // Protected pages
  DASHBOARD: 'dashboard-page',
  PROJECT_DETAIL: 'project-detail-page',
  SEGMENTATION: 'segmentation-page',
  SEGMENTATION_EDITOR: 'segmentation-editor-page',
  PROJECT_EXPORT: 'project-export-page',
  SETTINGS: 'settings-page',
  PROFILE: 'profile-page',
  ACCEPT_INVITATION: 'accept-invitation-page',
  
  // Feature chunks
  IMAGE_VIEWER: 'image-viewer',
  POLYGON_EDITOR: 'polygon-editor',
  EXPORT_UTILS: 'export-utils',
  CHARTS: 'charts',
  
  // Vendor chunks
  REACT_QUERY: 'react-query',
  MATERIAL_UI: 'material-ui',
  MONACO_EDITOR: 'monaco-editor',
} as const;

/**
 * Generate import with webpack chunk name
 */
export function importWithChunkName<T = any>(
  path: string,
  chunkName: string
): () => Promise<{ default: T }> {
  // This is a template - actual usage requires literal strings for webpack
  return () => import(/* webpackChunkName: "${chunkName}" */ `${path}`);
}

/**
 * Preload critical chunks
 */
export function preloadCriticalChunks(): void {
  if (typeof window === 'undefined') return;
  
  // Critical chunks to preload
  const criticalChunks = [
    CHUNK_NAMES.DASHBOARD,
    CHUNK_NAMES.SIGN_IN,
  ];
  
  criticalChunks.forEach(chunkName => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'script';
    // In production, chunks will have hash in filename
    link.href = `/assets/js/${chunkName}.js`;
    document.head.appendChild(link);
  });
}