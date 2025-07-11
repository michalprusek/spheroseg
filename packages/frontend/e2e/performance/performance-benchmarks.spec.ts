import { test, expect } from '@playwright/test';
import { performance } from 'perf_hooks';

// Performance thresholds (in milliseconds)
const PERFORMANCE_THRESHOLDS = {
  pageLoad: {
    home: 3000,
    signIn: 2000,
    signUp: 2000,
    about: 2500,
    documentation: 3000,
  },
  firstContentfulPaint: 1500,
  largestContentfulPaint: 2500,
  timeToInteractive: 3500,
  totalBlockingTime: 300,
  cumulativeLayoutShift: 0.1,
};

// Helper to measure navigation timing
async function measureNavigationTiming(page) {
  return await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return {
      domContentLoaded: nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart,
      loadComplete: nav.loadEventEnd - nav.loadEventStart,
      domInteractive: nav.domInteractive - nav.fetchStart,
      responseTime: nav.responseEnd - nav.requestStart,
    };
  });
}

// Helper to measure web vitals
async function measureWebVitals(page) {
  return await page.evaluate(() => 
    new Promise((resolve) => {
      const vitals = {
        FCP: 0,
        LCP: 0,
        CLS: 0,
        FID: 0,
        TTFB: 0,
      };

      // First Contentful Paint
      const fcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.name === 'first-contentful-paint') {
            vitals.FCP = entry.startTime;
          }
        });
      });
      fcpObserver.observe({ entryTypes: ['paint'] });

      // Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        vitals.LCP = lastEntry.startTime;
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

      // Cumulative Layout Shift
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
        vitals.CLS = clsValue;
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });

      // Time to First Byte
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      vitals.TTFB = nav.responseStart - nav.requestStart;

      // Resolve after collecting data
      setTimeout(() => resolve(vitals), 5000);
    })
  );
}

test.describe('Performance Benchmarks', () => {
  test.beforeEach(async ({ page }) => {
    // Enable performance APIs
    await page.addInitScript(() => {
      window.performanceMetrics = {
        marks: {},
        measures: {},
      };
      
      // Override performance.mark
      const originalMark = window.performance.mark.bind(window.performance);
      window.performance.mark = function(name) {
        window.performanceMetrics.marks[name] = performance.now();
        return originalMark(name);
      };
      
      // Override performance.measure
      const originalMeasure = window.performance.measure.bind(window.performance);
      window.performance.measure = function(name, startMark, endMark) {
        const start = window.performanceMetrics.marks[startMark] || 0;
        const end = window.performanceMetrics.marks[endMark] || performance.now();
        window.performanceMetrics.measures[name] = end - start;
        return originalMeasure(name, startMark, endMark);
      };
    });
  });

  test('home page load performance', async ({ page }) => {
    const startTime = performance.now();
    
    await page.goto('/', { waitUntil: 'networkidle' });
    
    const loadTime = performance.now() - startTime;
    console.log(`Home page load time: ${loadTime.toFixed(2)}ms`);
    
    // Check against threshold
    expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.pageLoad.home);
    
    // Measure navigation timing
    const navTiming = await measureNavigationTiming(page);
    console.log('Navigation timing:', navTiming);
    
    // Measure web vitals
    const webVitals = await measureWebVitals(page);
    console.log('Web Vitals:', webVitals);
    
    // Assert web vitals
    expect(webVitals.FCP).toBeLessThan(PERFORMANCE_THRESHOLDS.firstContentfulPaint);
    expect(webVitals.LCP).toBeLessThan(PERFORMANCE_THRESHOLDS.largestContentfulPaint);
    expect(webVitals.CLS).toBeLessThan(PERFORMANCE_THRESHOLDS.cumulativeLayoutShift);
  });

  test('sign-in page performance', async ({ page }) => {
    const startTime = performance.now();
    
    await page.goto('/sign-in', { waitUntil: 'networkidle' });
    
    const loadTime = performance.now() - startTime;
    console.log(`Sign-in page load time: ${loadTime.toFixed(2)}ms`);
    
    expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.pageLoad.signIn);
    
    // Measure form interaction performance
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    
    const interactionStart = performance.now();
    await page.click('button[type="submit"]');
    const interactionTime = performance.now() - interactionStart;
    
    console.log(`Form submission time: ${interactionTime.toFixed(2)}ms`);
    expect(interactionTime).toBeLessThan(100); // Form should respond quickly
  });

  test('image lazy loading performance', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // Check that images are lazy loaded
    const lazyImages = await page.$$eval('img[loading="lazy"]', imgs => imgs.length);
    expect(lazyImages).toBeGreaterThan(0);
    
    // Measure time to load visible images
    const imageLoadStart = performance.now();
    await page.waitForLoadState('networkidle');
    const imageLoadTime = performance.now() - imageLoadStart;
    
    console.log(`Image loading time: ${imageLoadTime.toFixed(2)}ms`);
    expect(imageLoadTime).toBeLessThan(2000); // Images should load within 2s
  });

  test('route transition performance', async ({ page }) => {
    await page.goto('/');
    
    // Measure navigation between routes
    const transitions = [
      { from: '/', to: '/about', name: 'Home to About' },
      { from: '/about', to: '/sign-in', name: 'About to Sign In' },
      { from: '/sign-in', to: '/sign-up', name: 'Sign In to Sign Up' },
    ];
    
    for (const transition of transitions) {
      if (page.url() !== new URL(transition.from, page.url()).href) {
        await page.goto(transition.from);
      }
      
      const transitionStart = performance.now();
      await Promise.all([
        page.waitForURL(transition.to),
        page.click(`a[href="${transition.to}"]`),
      ]);
      const transitionTime = performance.now() - transitionStart;
      
      console.log(`${transition.name} transition: ${transitionTime.toFixed(2)}ms`);
      expect(transitionTime).toBeLessThan(500); // Transitions should be smooth
    }
  });

  test('memory usage monitoring', async ({ page }) => {
    await page.goto('/');
    
    // Get initial memory usage
    const initialMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return null;
    });
    
    if (initialMemory) {
      // Navigate through multiple pages
      const pages = ['/', '/about', '/sign-in', '/sign-up', '/documentation'];
      
      for (const url of pages) {
        await page.goto(url);
        await page.waitForLoadState('networkidle');
      }
      
      // Get final memory usage
      const finalMemory = await page.evaluate(() => {
        if ('memory' in performance) {
          return (performance as any).memory.usedJSHeapSize;
        }
        return null;
      });
      
      if (finalMemory) {
        const memoryIncrease = finalMemory - initialMemory;
        const memoryIncreaseMB = memoryIncrease / (1024 * 1024);
        
        console.log(`Memory increase: ${memoryIncreaseMB.toFixed(2)}MB`);
        expect(memoryIncreaseMB).toBeLessThan(50); // Should not leak more than 50MB
      }
    }
  });

  test('bundle size impact', async ({ page }) => {
    const response = await page.goto('/');
    
    // Collect all JavaScript files
    const jsFiles = [];
    page.on('response', (response) => {
      const url = response.url();
      if (url.endsWith('.js') || url.includes('.js?')) {
        jsFiles.push({
          url,
          size: parseInt(response.headers()['content-length'] || '0'),
        });
      }
    });
    
    await page.waitForLoadState('networkidle');
    
    // Calculate total bundle size
    const totalSize = jsFiles.reduce((sum, file) => sum + file.size, 0);
    const totalSizeMB = totalSize / (1024 * 1024);
    
    console.log(`Total JavaScript bundle size: ${totalSizeMB.toFixed(2)}MB`);
    console.log('Individual bundles:', jsFiles.map(f => ({
      name: f.url.split('/').pop(),
      size: `${(f.size / 1024).toFixed(2)}KB`,
    })));
    
    expect(totalSizeMB).toBeLessThan(2); // Total JS should be under 2MB
  });

  test('API response time benchmarks', async ({ page }) => {
    await page.goto('/sign-in');
    
    // Monitor API calls
    const apiCalls = [];
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/api/')) {
        const timing = response.timing();
        apiCalls.push({
          url,
          status: response.status(),
          duration: timing?.responseEnd || 0,
        });
      }
    });
    
    // Trigger API call
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Wait for API response
    await page.waitForResponse((response) => 
      response.url().includes('/api/') && response.status() !== 304,
      { timeout: 5000 }
    ).catch(() => {});
    
    // Analyze API performance
    apiCalls.forEach((call) => {
      console.log(`API Call: ${call.url.split('/').pop()} - ${call.duration.toFixed(2)}ms`);
      expect(call.duration).toBeLessThan(1000); // API calls should respond within 1s
    });
  });

  test('rendering performance under load', async ({ page }) => {
    await page.goto('/');
    
    // Measure rendering performance
    const renderingMetrics = await page.evaluate(async () => {
      const metrics = {
        fps: [],
        jank: 0,
      };
      
      let lastTime = performance.now();
      let frameCount = 0;
      
      return new Promise((resolve) => {
        const measureFrame = () => {
          const currentTime = performance.now();
          const delta = currentTime - lastTime;
          
          if (delta > 16.67) { // More than one frame (60fps = 16.67ms per frame)
            metrics.jank++;
          }
          
          frameCount++;
          if (frameCount % 60 === 0) { // Calculate FPS every 60 frames
            const fps = 1000 / delta;
            metrics.fps.push(fps);
          }
          
          lastTime = currentTime;
          
          if (frameCount < 300) { // Measure for 5 seconds at 60fps
            requestAnimationFrame(measureFrame);
          } else {
            resolve(metrics);
          }
        };
        
        requestAnimationFrame(measureFrame);
        
        // Simulate user interactions during measurement
        setTimeout(() => {
          window.scrollTo({ top: 1000, behavior: 'smooth' });
        }, 1000);
        
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 2500);
      });
    });
    
    const avgFPS = renderingMetrics.fps.reduce((a, b) => a + b, 0) / renderingMetrics.fps.length;
    console.log(`Average FPS: ${avgFPS.toFixed(2)}`);
    console.log(`Jank frames: ${renderingMetrics.jank}`);
    
    expect(avgFPS).toBeGreaterThan(30); // Should maintain at least 30fps
    expect(renderingMetrics.jank).toBeLessThan(10); // Minimal jank
  });
});

test.describe('Performance Regression Tests', () => {
  test('compare performance against baseline', async ({ page }) => {
    const baseline = {
      home: { FCP: 1200, LCP: 2000, CLS: 0.05 },
      about: { FCP: 1000, LCP: 1800, CLS: 0.03 },
    };
    
    for (const [pageName, expectedMetrics] of Object.entries(baseline)) {
      await page.goto(pageName === 'home' ? '/' : `/${pageName}`);
      
      const metrics = await measureWebVitals(page);
      
      // Allow 20% regression from baseline
      const tolerance = 1.2;
      
      expect(metrics.FCP).toBeLessThan(expectedMetrics.FCP * tolerance);
      expect(metrics.LCP).toBeLessThan(expectedMetrics.LCP * tolerance);
      expect(metrics.CLS).toBeLessThan(expectedMetrics.CLS * tolerance);
      
      console.log(`${pageName} performance:`, {
        FCP: `${metrics.FCP.toFixed(0)}ms (baseline: ${expectedMetrics.FCP}ms)`,
        LCP: `${metrics.LCP.toFixed(0)}ms (baseline: ${expectedMetrics.LCP}ms)`,
        CLS: `${metrics.CLS.toFixed(3)} (baseline: ${expectedMetrics.CLS})`,
      });
    }
  });
});