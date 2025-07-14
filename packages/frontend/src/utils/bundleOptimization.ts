/**
 * Bundle Optimization with Dynamic Import Analysis
 * 
 * This module provides advanced bundle optimization features including:
 * - Dynamic import analysis and tracking
 * - Intelligent prefetching based on user behavior
 * - Bundle size monitoring and alerts
 * - Route-based code splitting optimization
 * - Critical CSS extraction
 * - Resource hints generation
 */

import type { ComponentType, LazyExoticComponent } from 'react';

// ===========================
// Types
// ===========================

export interface ImportAnalysis {
  moduleId: string;
  importedBy: string[];
  size: number;
  loadTime: number;
  frequency: number;
  lastUsed: number;
  dependencies: string[];
}

export interface RouteAnalysis {
  path: string;
  chunks: string[];
  totalSize: number;
  criticalChunks: string[];
  avgLoadTime: number;
  visits: number;
}

export interface BundleMetrics {
  totalSize: number;
  chunks: ChunkMetrics[];
  routes: RouteAnalysis[];
  performance: PerformanceMetrics;
}

export interface ChunkMetrics {
  name: string;
  size: number;
  gzipSize: number;
  modules: string[];
  type: 'vendor' | 'common' | 'route' | 'async';
  loadCount: number;
  avgLoadTime: number;
  cacheHitRate: number;
}

export interface PerformanceMetrics {
  fcp: number; // First Contentful Paint
  lcp: number; // Largest Contentful Paint
  tti: number; // Time to Interactive
  cls: number; // Cumulative Layout Shift
  fid: number; // First Input Delay
}

export interface OptimizationSuggestion {
  type: 'split' | 'merge' | 'prefetch' | 'preload' | 'lazy' | 'inline';
  target: string;
  reason: string;
  impact: 'high' | 'medium' | 'low';
  estimatedSaving?: number;
}

export interface PrefetchStrategy {
  route: string;
  chunks: string[];
  strategy: 'eager' | 'lazy' | 'visible' | 'interaction';
  priority: number;
}

// ===========================
// Import Analysis
// ===========================

class DynamicImportAnalyzer {
  private imports = new Map<string, ImportAnalysis>();
  private routeMap = new Map<string, RouteAnalysis>();
  private observer: PerformanceObserver | null = null;
  
  constructor() {
    this.setupPerformanceObserver();
  }

  private setupPerformanceObserver(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return;
    }

    this.observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'resource' && entry.name.includes('.js')) {
          this.recordChunkLoad(entry as PerformanceResourceTiming);
        }
      }
    });

    this.observer.observe({ entryTypes: ['resource'] });
  }

  private recordChunkLoad(entry: PerformanceResourceTiming): void {
    const chunkName = this.extractChunkName(entry.name);
    const existing = this.imports.get(chunkName);

    const analysis: ImportAnalysis = {
      moduleId: chunkName,
      importedBy: existing?.importedBy || [],
      size: entry.transferSize || 0,
      loadTime: entry.duration,
      frequency: (existing?.frequency || 0) + 1,
      lastUsed: Date.now(),
      dependencies: existing?.dependencies || [],
    };

    this.imports.set(chunkName, analysis);
  }

  private extractChunkName(url: string): string {
    const match = url.match(/\/([^/]+)\.([a-f0-9]+)\.js$/);
    return match ? match[1] : url.split('/').pop() || 'unknown';
  }

  recordImport(
    moduleId: string,
    importedBy: string,
    dependencies: string[] = []
  ): void {
    const existing = this.imports.get(moduleId);
    
    this.imports.set(moduleId, {
      moduleId,
      importedBy: [...(existing?.importedBy || []), importedBy],
      size: existing?.size || 0,
      loadTime: existing?.loadTime || 0,
      frequency: (existing?.frequency || 0) + 1,
      lastUsed: Date.now(),
      dependencies: [...new Set([...(existing?.dependencies || []), ...dependencies])],
    });
  }

  recordRouteVisit(path: string, chunks: string[]): void {
    const existing = this.routeMap.get(path);
    
    this.routeMap.set(path, {
      path,
      chunks,
      totalSize: chunks.reduce((sum, chunk) => {
        const analysis = this.imports.get(chunk);
        return sum + (analysis?.size || 0);
      }, 0),
      criticalChunks: chunks.slice(0, 3), // First 3 chunks are critical
      avgLoadTime: existing?.avgLoadTime || 0,
      visits: (existing?.visits || 0) + 1,
    });
  }

  getAnalysis(): Map<string, ImportAnalysis> {
    return new Map(this.imports);
  }

  getRouteAnalysis(): Map<string, RouteAnalysis> {
    return new Map(this.routeMap);
  }

  getMostUsedImports(limit: number = 10): ImportAnalysis[] {
    return Array.from(this.imports.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, limit);
  }

  getUnusedImports(threshold: number = 24 * 60 * 60 * 1000): ImportAnalysis[] {
    const cutoff = Date.now() - threshold;
    return Array.from(this.imports.values())
      .filter(imp => imp.lastUsed < cutoff);
  }

  cleanup(): void {
    this.observer?.disconnect();
  }
}

// ===========================
// Bundle Size Monitor
// ===========================

class BundleSizeMonitor {
  private sizeThresholds = {
    chunk: 244 * 1024, // 244kb per chunk
    total: 2 * 1024 * 1024, // 2MB total
    vendor: 500 * 1024, // 500kb for vendor chunks
  };

  private metrics: BundleMetrics = {
    totalSize: 0,
    chunks: [],
    routes: [],
    performance: {
      fcp: 0,
      lcp: 0,
      tti: 0,
      cls: 0,
      fid: 0,
    },
  };

  async analyzeBundleSize(): Promise<BundleMetrics> {
    // In production, this would fetch actual bundle stats
    if (import.meta.env.DEV) {
      console.log('Bundle analysis available in production builds only');
    }

    // Get Web Vitals if available
    if ('PerformanceObserver' in window) {
      this.collectWebVitals();
    }

    return this.metrics;
  }

  private collectWebVitals(): void {
    // Collect FCP
    const paintEntries = performance.getEntriesByType('paint');
    const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint');
    if (fcp) {
      this.metrics.performance.fcp = fcp.startTime;
    }

    // Collect LCP
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as any;
      this.metrics.performance.lcp = lastEntry.renderTime || lastEntry.loadTime;
    });
    observer.observe({ entryTypes: ['largest-contentful-paint'] });

    // Note: CLS and FID require more complex tracking
  }

  checkThresholds(chunk: ChunkMetrics): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    if (chunk.size > this.sizeThresholds.chunk) {
      suggestions.push({
        type: 'split',
        target: chunk.name,
        reason: `Chunk size (${(chunk.size / 1024).toFixed(0)}kb) exceeds threshold`,
        impact: 'high',
        estimatedSaving: chunk.size - this.sizeThresholds.chunk,
      });
    }

    if (chunk.type === 'vendor' && chunk.size > this.sizeThresholds.vendor) {
      suggestions.push({
        type: 'split',
        target: chunk.name,
        reason: 'Large vendor bundle should be split',
        impact: 'medium',
      });
    }

    if (chunk.cacheHitRate < 0.7) {
      suggestions.push({
        type: 'prefetch',
        target: chunk.name,
        reason: 'Low cache hit rate',
        impact: 'medium',
      });
    }

    return suggestions;
  }

  generateReport(): string {
    const report = `
Bundle Analysis Report
=====================

Total Size: ${(this.metrics.totalSize / 1024 / 1024).toFixed(2)}MB

Top Chunks by Size:
${this.metrics.chunks
  .sort((a, b) => b.size - a.size)
  .slice(0, 5)
  .map(chunk => `- ${chunk.name}: ${(chunk.size / 1024).toFixed(0)}kb`)
  .join('\n')}

Performance Metrics:
- FCP: ${this.metrics.performance.fcp.toFixed(0)}ms
- LCP: ${this.metrics.performance.lcp.toFixed(0)}ms
- TTI: ${this.metrics.performance.tti.toFixed(0)}ms
`;
    return report;
  }
}

// ===========================
// Intelligent Prefetcher
// ===========================

class IntelligentPrefetcher {
  private prefetchQueue: PrefetchStrategy[] = [];
  private prefetching = new Set<string>();
  private userBehavior = new Map<string, number>();
  
  constructor(private analyzer: DynamicImportAnalyzer) {}

  analyzePrefetchStrategy(currentRoute: string): PrefetchStrategy[] {
    const strategies: PrefetchStrategy[] = [];
    const routeAnalysis = this.analyzer.getRouteAnalysis();

    // Analyze navigation patterns
    const patterns = this.analyzeNavigationPatterns(currentRoute);
    
    patterns.forEach(({ nextRoute, probability }) => {
      const route = routeAnalysis.get(nextRoute);
      if (route && probability > 0.3) {
        strategies.push({
          route: nextRoute,
          chunks: route.criticalChunks,
          strategy: probability > 0.7 ? 'eager' : 'lazy',
          priority: Math.round(probability * 10),
        });
      }
    });

    return strategies.sort((a, b) => b.priority - a.priority);
  }

  private analyzeNavigationPatterns(
    currentRoute: string
  ): Array<{ nextRoute: string; probability: number }> {
    // In a real implementation, this would use actual navigation data
    const commonPatterns: Record<string, Array<{ route: string; prob: number }>> = {
      '/dashboard': [
        { route: '/projects/:id', prob: 0.8 },
        { route: '/settings', prob: 0.2 },
      ],
      '/projects/:id': [
        { route: '/segmentation/:id', prob: 0.7 },
        { route: '/projects/:id/export', prob: 0.3 },
      ],
      '/segmentation/:id': [
        { route: '/projects/:id', prob: 0.9 },
        { route: '/dashboard', prob: 0.1 },
      ],
    };

    const pattern = Object.entries(commonPatterns).find(([route]) => 
      this.matchRoute(currentRoute, route)
    );

    if (pattern) {
      return pattern[1].map(({ route, prob }) => ({
        nextRoute: route,
        probability: prob,
      }));
    }

    return [];
  }

  private matchRoute(path: string, pattern: string): boolean {
    const regex = pattern.replace(/:[\w]+/g, '[^/]+');
    return new RegExp(`^${regex}$`).test(path);
  }

  async prefetch(strategy: PrefetchStrategy): Promise<void> {
    if (this.prefetching.has(strategy.route)) {
      return;
    }

    this.prefetching.add(strategy.route);

    try {
      switch (strategy.strategy) {
        case 'eager':
          await this.eagerPrefetch(strategy.chunks);
          break;
        case 'lazy':
          this.lazyPrefetch(strategy.chunks);
          break;
        case 'visible':
          this.visiblePrefetch(strategy.chunks);
          break;
        case 'interaction':
          this.interactionPrefetch(strategy.chunks);
          break;
      }
    } finally {
      this.prefetching.delete(strategy.route);
    }
  }

  private async eagerPrefetch(chunks: string[]): Promise<void> {
    // Immediately prefetch all chunks
    const links = chunks.map(chunk => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = `/assets/js/${chunk}.js`;
      document.head.appendChild(link);
      return link;
    });
  }

  private lazyPrefetch(chunks: string[]): void {
    // Prefetch during idle time
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        this.eagerPrefetch(chunks);
      }, { timeout: 2000 });
    } else {
      setTimeout(() => this.eagerPrefetch(chunks), 2000);
    }
  }

  private visiblePrefetch(chunks: string[]): void {
    // Prefetch when element becomes visible
    // This would use IntersectionObserver on actual elements
  }

  private interactionPrefetch(chunks: string[]): void {
    // Prefetch on user interaction (hover, focus)
    // This would attach to actual interactive elements
  }

  recordUserBehavior(from: string, to: string): void {
    const key = `${from}->${to}`;
    this.userBehavior.set(key, (this.userBehavior.get(key) || 0) + 1);
  }
}

// ===========================
// Route-based Code Splitting
// ===========================

export interface RouteConfig {
  path: string;
  component: () => Promise<{ default: ComponentType<any> }>;
  preload?: boolean;
  prefetch?: PrefetchStrategy;
  critical?: boolean;
}

export function optimizeRoutes(routes: RouteConfig[]): RouteConfig[] {
  const analyzer = new DynamicImportAnalyzer();
  
  return routes.map(route => {
    // Add chunk names for better tracking
    const chunkName = route.path.replace(/[/:]/g, '-').slice(1) || 'home';
    
    return {
      ...route,
      component: async () => {
        analyzer.recordImport(chunkName, 'router', []);
        return route.component();
      },
    };
  });
}

// ===========================
// Critical CSS Extraction
// ===========================

class CriticalCSSExtractor {
  private criticalSelectors = new Set<string>();
  
  extractCriticalCSS(html: string): string {
    // This would analyze the HTML and extract critical CSS
    // In practice, this is usually done at build time
    return '';
  }

  inlineCSS(css: string): void {
    const style = document.createElement('style');
    style.textContent = css;
    style.setAttribute('data-critical', 'true');
    document.head.insertBefore(style, document.head.firstChild);
  }

  async loadNonCriticalCSS(href: string): Promise<void> {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.media = 'print';
    link.onload = () => {
      link.media = 'all';
    };
    document.head.appendChild(link);
  }
}

// ===========================
// Resource Hints Generator
// ===========================

export function generateResourceHints(analysis: Map<string, ImportAnalysis>): string {
  const hints: string[] = [];
  
  // DNS prefetch for external resources
  hints.push('<link rel="dns-prefetch" href="//cdn.jsdelivr.net">');
  hints.push('<link rel="dns-prefetch" href="//fonts.googleapis.com">');
  
  // Preconnect for critical origins
  hints.push('<link rel="preconnect" href="https://api.spheroseg.com">');
  
  // Preload critical resources
  const criticalImports = Array.from(analysis.values())
    .filter(imp => imp.frequency > 5)
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 3);
  
  criticalImports.forEach(imp => {
    hints.push(`<link rel="preload" href="/assets/js/${imp.moduleId}.js" as="script">`);
  });
  
  // Prefetch likely next resources
  const likelyNext = Array.from(analysis.values())
    .filter(imp => imp.frequency > 2 && imp.frequency <= 5)
    .slice(0, 5);
  
  likelyNext.forEach(imp => {
    hints.push(`<link rel="prefetch" href="/assets/js/${imp.moduleId}.js">`);
  });
  
  return hints.join('\n');
}

// ===========================
// Main Bundle Optimizer
// ===========================

export class BundleOptimizer {
  private analyzer = new DynamicImportAnalyzer();
  private monitor = new BundleSizeMonitor();
  private prefetcher = new IntelligentPrefetcher(this.analyzer);
  private cssExtractor = new CriticalCSSExtractor();
  
  async initialize(): Promise<void> {
    // Start monitoring
    await this.monitor.analyzeBundleSize();
    
    // Setup route change listener
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', this.handleRouteChange.bind(this));
    }
  }

  private handleRouteChange(): void {
    const currentPath = window.location.pathname;
    
    // Record navigation
    this.analyzer.recordRouteVisit(currentPath, []);
    
    // Analyze and prefetch
    const strategies = this.prefetcher.analyzePrefetchStrategy(currentPath);
    strategies.forEach(strategy => {
      this.prefetcher.prefetch(strategy);
    });
  }

  recordImport(moduleId: string, importedBy: string): void {
    this.analyzer.recordImport(moduleId, importedBy);
  }

  async getOptimizationSuggestions(): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];
    const metrics = await this.monitor.analyzeBundleSize();
    
    // Check chunk sizes
    metrics.chunks.forEach(chunk => {
      suggestions.push(...this.monitor.checkThresholds(chunk));
    });
    
    // Check for unused imports
    const unused = this.analyzer.getUnusedImports();
    unused.forEach(imp => {
      suggestions.push({
        type: 'lazy',
        target: imp.moduleId,
        reason: 'Module has not been used recently',
        impact: 'low',
      });
    });
    
    // Check for frequently used async chunks
    const frequent = this.analyzer.getMostUsedImports();
    frequent.slice(0, 3).forEach(imp => {
      if (!imp.moduleId.includes('vendor')) {
        suggestions.push({
          type: 'preload',
          target: imp.moduleId,
          reason: 'Frequently used module should be preloaded',
          impact: 'high',
        });
      }
    });
    
    return suggestions;
  }

  generateReport(): string {
    const bundleReport = this.monitor.generateReport();
    const importAnalysis = this.analyzer.getAnalysis();
    const suggestions = this.getOptimizationSuggestions();
    
    return `
${bundleReport}

Top Imports:
${Array.from(importAnalysis.values())
  .sort((a, b) => b.frequency - a.frequency)
  .slice(0, 5)
  .map(imp => `- ${imp.moduleId}: ${imp.frequency} loads`)
  .join('\n')}

Optimization Suggestions:
${suggestions
  .map(s => `- [${s.impact}] ${s.type}: ${s.target} - ${s.reason}`)
  .join('\n')}
`;
  }

  cleanup(): void {
    this.analyzer.cleanup();
  }
}

// ===========================
// Export Singleton
// ===========================

export const bundleOptimizer = new BundleOptimizer();

// Auto-initialize in browser
if (typeof window !== 'undefined' && !import.meta.env.SSR) {
  bundleOptimizer.initialize();
}

export default bundleOptimizer;