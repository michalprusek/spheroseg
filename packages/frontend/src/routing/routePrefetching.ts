/**
 * Enhanced route prefetching system
 * Intelligently prefetches routes based on user behavior and patterns
 */

import { logger } from '@/utils/logger';

// Route priorities for prefetching
const ROUTE_PRIORITIES = {
  '/dashboard': 1,
  '/sign-in': 1,
  '/project/:id': 2,
  '/settings': 3,
  '/profile': 3,
} as const;

// Track which routes have been prefetched
const prefetchedRoutes = new Set<string>();

// Track user navigation patterns
const navigationHistory: string[] = [];
const MAX_HISTORY = 10;

/**
 * Prefetch a route component
 */
export async function prefetchRoute(path: string): Promise<void> {
  // Skip if already prefetched
  if (prefetchedRoutes.has(path)) {
    return;
  }

  try {
    const startTime = performance.now();
    
    // Dynamic imports based on path
    switch (path) {
      case '/dashboard':
        await import('@/pages/Dashboard');
        break;
      case '/sign-in':
        await import('@/pages/SignIn');
        break;
      case '/sign-up':
        await import('@/pages/SignUp');
        break;
      case '/settings':
        await import('@/pages/Settings');
        break;
      case '/profile':
        await import('@/pages/Profile');
        break;
      case '/documentation':
        await import('@/pages/Documentation');
        break;
      case '/about':
        await import('@/pages/AboutPage');
        break;
      default:
        // Handle dynamic routes
        if (path.startsWith('/project/') || path.startsWith('/projects/')) {
          await import('@/pages/ProjectDetail');
        } else if (path.includes('/segmentation')) {
          await import('@/pages/segmentation/SegmentationPage');
        } else if (path.includes('/export')) {
          await import('@/pages/export/ProjectExport');
        }
    }
    
    const loadTime = performance.now() - startTime;
    logger.debug(`Prefetched route ${path} in ${loadTime.toFixed(2)}ms`);
    
    prefetchedRoutes.add(path);
    
    // Report performance metrics
    if ('sendBeacon' in navigator && import.meta.env.VITE_ENABLE_PERFORMANCE_METRICS === 'true') {
      navigator.sendBeacon('/api/metrics/route-prefetch', JSON.stringify({
        path,
        loadTime,
        timestamp: Date.now()
      }));
    }
  } catch (error) {
    logger.error(`Failed to prefetch route ${path}:`, error);
  }
}

/**
 * Prefetch routes based on current location
 */
export function prefetchRelatedRoutes(currentPath: string): void {
  // Add to navigation history
  navigationHistory.push(currentPath);
  if (navigationHistory.length > MAX_HISTORY) {
    navigationHistory.shift();
  }
  
  // Prefetch based on current location
  if (currentPath === '/') {
    // From home, users likely go to sign-in or dashboard
    setTimeout(() => prefetchRoute('/sign-in'), 1000);
    if (localStorage.getItem('access_token')) {
      setTimeout(() => prefetchRoute('/dashboard'), 500);
    }
  } else if (currentPath === '/sign-in') {
    // After sign-in, users go to dashboard
    setTimeout(() => prefetchRoute('/dashboard'), 1000);
  } else if (currentPath === '/dashboard') {
    // From dashboard, users might go to settings or a project
    setTimeout(() => prefetchRoute('/settings'), 3000);
  } else if (currentPath.includes('/project/')) {
    // From project, might go to segmentation or export
    const projectId = currentPath.split('/').pop();
    if (projectId) {
      setTimeout(() => prefetchRoute(`/projects/${projectId}/segmentation`), 2000);
      setTimeout(() => prefetchRoute(`/project/${projectId}/export`), 4000);
    }
  }
}

/**
 * Predictive prefetching based on user patterns
 */
export function predictivePrefetech(): void {
  // Analyze navigation history to predict next route
  if (navigationHistory.length < 3) return;
  
  // Simple pattern detection
  const patterns = new Map<string, number>();
  
  for (let i = 0; i < navigationHistory.length - 1; i++) {
    const current = navigationHistory[i];
    const next = navigationHistory[i + 1];
    const pattern = `${current} -> ${next}`;
    patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
  }
  
  // Find most common pattern from current location
  const currentPath = navigationHistory[navigationHistory.length - 1];
  let maxCount = 0;
  let predictedPath = '';
  
  patterns.forEach((count, pattern) => {
    if (pattern.startsWith(currentPath) && count > maxCount) {
      maxCount = count;
      predictedPath = pattern.split(' -> ')[1];
    }
  });
  
  if (predictedPath && maxCount >= 2) {
    logger.debug(`Predictive prefetch: ${predictedPath} (confidence: ${maxCount})`);
    setTimeout(() => prefetchRoute(predictedPath), 2000);
  }
}

/**
 * Prefetch routes on idle
 */
export function prefetchOnIdle(): void {
  if (!('requestIdleCallback' in window)) {
    return;
  }
  
  const criticalRoutes = Object.keys(ROUTE_PRIORITIES)
    .filter(route => ROUTE_PRIORITIES[route as keyof typeof ROUTE_PRIORITIES] <= 2);
  
  window.requestIdleCallback(() => {
    criticalRoutes.forEach((route, index) => {
      setTimeout(() => prefetchRoute(route), index * 1000);
    });
  }, { timeout: 5000 });
}

/**
 * Add resource hints for critical chunks
 */
export function addResourceHints(): void {
  // Add preconnect for API server
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = new URL(apiUrl).origin;
    document.head.appendChild(link);
  }
  
  // Add dns-prefetch for CDN if configured
  const cdnUrl = import.meta.env.VITE_CDN_URL;
  if (cdnUrl) {
    const link = document.createElement('link');
    link.rel = 'dns-prefetch';
    link.href = new URL(cdnUrl).origin;
    document.head.appendChild(link);
  }
}

/**
 * Monitor chunk loading performance
 */
export function monitorChunkLoading(): void {
  if (!('PerformanceObserver' in window)) {
    return;
  }
  
  const observer = new PerformanceObserver((list) => {
    list.getEntries().forEach((entry) => {
      if (entry.entryType === 'resource' && entry.name.includes('.chunk.js')) {
        const duration = entry.duration;
        
        // Log slow chunk loads
        if (duration > 3000) {
          logger.warn(`Slow chunk load: ${entry.name} took ${duration}ms`);
          
          // Report to monitoring
          if (import.meta.env.VITE_ENABLE_PERFORMANCE_METRICS === 'true') {
            navigator.sendBeacon('/api/metrics/slow-chunk', JSON.stringify({
              chunk: entry.name,
              duration,
              timestamp: Date.now()
            }));
          }
        }
      }
    });
  });
  
  observer.observe({ entryTypes: ['resource'] });
}

/**
 * Initialize route prefetching system
 */
export function initializeRoutePrefetching(): void {
  // Add resource hints immediately
  addResourceHints();
  
  // Start monitoring chunk loading
  monitorChunkLoading();
  
  // Prefetch on idle
  prefetchOnIdle();
  
  // Listen for route changes
  if (typeof window !== 'undefined') {
    let lastPath = window.location.pathname;
    
    // Use MutationObserver to detect route changes (works with React Router)
    const observer = new MutationObserver(() => {
      const currentPath = window.location.pathname;
      if (currentPath !== lastPath) {
        lastPath = currentPath;
        prefetchRelatedRoutes(currentPath);
        predictivePrefetech();
      }
    });
    
    observer.observe(document, { subtree: true, childList: true });
  }
}