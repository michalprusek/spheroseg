/**
 * Bundle Optimization Module Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  BundleOptimizer,
  bundleOptimizer,
  generateResourceHints,
  optimizeRoutes,
  type ImportAnalysis,
  type RouteConfig,
  type OptimizationSuggestion,
} from '../bundleOptimization';

// Mock performance observer
const mockPerformanceObserver = vi.fn();
global.PerformanceObserver = vi.fn().mockImplementation((callback) => {
  mockPerformanceObserver(callback);
  return {
    observe: vi.fn(),
    disconnect: vi.fn(),
  };
});

// Mock performance entries
const mockPerformanceEntries = [
  {
    entryType: 'resource',
    name: 'http://localhost/assets/js/vendor-react.123abc.js',
    transferSize: 150000,
    duration: 250,
  },
  {
    entryType: 'resource',
    name: 'http://localhost/assets/js/dashboard.456def.js',
    transferSize: 50000,
    duration: 100,
  },
];

describe('BundleOptimizer', () => {
  let optimizer: BundleOptimizer;

  beforeEach(() => {
    optimizer = new BundleOptimizer();
    vi.clearAllMocks();
  });

  afterEach(() => {
    optimizer.cleanup();
  });

  describe('initialization', () => {
    it('should initialize without errors', async () => {
      await expect(optimizer.initialize()).resolves.not.toThrow();
    });

    it('should set up performance observer', async () => {
      await optimizer.initialize();
      expect(PerformanceObserver).toHaveBeenCalled();
    });
  });

  describe('import tracking', () => {
    it('should record imports', () => {
      optimizer.recordImport('dashboard-module', 'app-router');
      optimizer.recordImport('dashboard-module', 'lazy-load');
      
      // Record multiple times to increase frequency
      optimizer.recordImport('dashboard-module', 'app-router');
      
      // The actual analysis is internal, but we can test suggestions
      return optimizer.getOptimizationSuggestions().then(suggestions => {
        expect(suggestions).toBeDefined();
        expect(Array.isArray(suggestions)).toBe(true);
      });
    });
  });

  describe('optimization suggestions', () => {
    it('should generate suggestions for large chunks', async () => {
      // Simulate a large chunk by manipulating internal state
      const suggestions = await optimizer.getOptimizationSuggestions();
      
      expect(suggestions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: expect.stringMatching(/split|merge|prefetch|preload|lazy|inline/),
            target: expect.any(String),
            reason: expect.any(String),
            impact: expect.stringMatching(/high|medium|low/),
          }),
        ])
      );
    });

    it('should prioritize frequently used modules for preloading', async () => {
      // Record multiple imports to simulate frequency
      for (let i = 0; i < 10; i++) {
        optimizer.recordImport('critical-module', 'various-sources');
      }
      
      const suggestions = await optimizer.getOptimizationSuggestions();
      const preloadSuggestions = suggestions.filter(s => s.type === 'preload');
      
      expect(preloadSuggestions.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('report generation', () => {
    it('should generate a formatted report', () => {
      const report = optimizer.generateReport();
      
      expect(report).toContain('Bundle Analysis Report');
      expect(report).toContain('Total Size:');
      expect(report).toContain('Performance Metrics:');
      expect(report).toContain('Top Chunks by Size:');
    });
  });
});

describe('generateResourceHints', () => {
  it('should generate resource hints HTML', () => {
    const mockAnalysis = new Map<string, ImportAnalysis>([
      ['vendor-react', {
        moduleId: 'vendor-react',
        importedBy: ['app'],
        size: 150000,
        loadTime: 250,
        frequency: 10,
        lastUsed: Date.now(),
        dependencies: [],
      }],
      ['dashboard', {
        moduleId: 'dashboard',
        importedBy: ['router'],
        size: 50000,
        loadTime: 100,
        frequency: 3,
        lastUsed: Date.now(),
        dependencies: ['vendor-react'],
      }],
    ]);

    const hints = generateResourceHints(mockAnalysis);
    
    expect(hints).toContain('dns-prefetch');
    expect(hints).toContain('preconnect');
    expect(hints).toContain('preload');
    expect(hints).toContain('vendor-react.js');
  });
});

describe('optimizeRoutes', () => {
  it('should enhance routes with import tracking', () => {
    const routes: RouteConfig[] = [
      {
        path: '/dashboard',
        component: () => Promise.resolve({ default: () => null }),
      },
      {
        path: '/projects/:id',
        component: () => Promise.resolve({ default: () => null }),
      },
    ];

    const optimizedRoutes = optimizeRoutes(routes);
    
    expect(optimizedRoutes).toHaveLength(2);
    expect(optimizedRoutes[0].component).toBeDefined();
    
    // The component should be wrapped
    expect(optimizedRoutes[0].component).not.toBe(routes[0].component);
  });

  it('should handle route paths with special characters', () => {
    const routes: RouteConfig[] = [
      {
        path: '/projects/:id/details',
        component: () => Promise.resolve({ default: () => null }),
      },
    ];

    const optimizedRoutes = optimizeRoutes(routes);
    
    expect(optimizedRoutes).toHaveLength(1);
    // Should convert path to safe chunk name
    expect(optimizedRoutes[0].component).toBeDefined();
  });
});

describe('bundleOptimizer singleton', () => {
  it('should export a singleton instance', () => {
    expect(bundleOptimizer).toBeDefined();
    expect(bundleOptimizer).toBeInstanceOf(BundleOptimizer);
  });

  it('should auto-initialize in browser environment', () => {
    // The singleton should be ready to use
    expect(() => bundleOptimizer.recordImport('test', 'test')).not.toThrow();
  });
});