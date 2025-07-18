# Test info

- Name: Performance Benchmarks >> image lazy loading performance
- Location: /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/performance/performance-benchmarks.spec.ts:160:3

# Error details

```
Error: browserType.launch: Executable doesn't exist at /home/cvat/.cache/ms-playwright/webkit-2158/pw_run.sh
╔═════════════════════════════════════════════════════════════════════════╗
║ Looks like Playwright Test or Playwright was just installed or updated. ║
║ Please run the following command to download new browsers:              ║
║                                                                         ║
║     npx playwright install                                              ║
║                                                                         ║
║ <3 Playwright Team                                                      ║
╚═════════════════════════════════════════════════════════════════════════╝
```

# Test source

```ts
   60 |         vitals.LCP = lastEntry.startTime;
   61 |       });
   62 |       lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
   63 |
   64 |       // Cumulative Layout Shift
   65 |       let clsValue = 0;
   66 |       const clsObserver = new PerformanceObserver((list) => {
   67 |         for (const entry of list.getEntries()) {
   68 |           if (!(entry as any).hadRecentInput) {
   69 |             clsValue += (entry as any).value;
   70 |           }
   71 |         }
   72 |         vitals.CLS = clsValue;
   73 |       });
   74 |       clsObserver.observe({ entryTypes: ['layout-shift'] });
   75 |
   76 |       // Time to First Byte
   77 |       const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
   78 |       vitals.TTFB = nav.responseStart - nav.requestStart;
   79 |
   80 |       // Resolve after collecting data
   81 |       setTimeout(() => resolve(vitals), 5000);
   82 |     })
   83 |   );
   84 | }
   85 |
   86 | test.describe('Performance Benchmarks', () => {
   87 |   test.beforeEach(async ({ page }) => {
   88 |     // Enable performance APIs
   89 |     await page.addInitScript(() => {
   90 |       window.performanceMetrics = {
   91 |         marks: {},
   92 |         measures: {},
   93 |       };
   94 |       
   95 |       // Override performance.mark
   96 |       const originalMark = window.performance.mark.bind(window.performance);
   97 |       window.performance.mark = function(name) {
   98 |         window.performanceMetrics.marks[name] = performance.now();
   99 |         return originalMark(name);
  100 |       };
  101 |       
  102 |       // Override performance.measure
  103 |       const originalMeasure = window.performance.measure.bind(window.performance);
  104 |       window.performance.measure = function(name, startMark, endMark) {
  105 |         const start = window.performanceMetrics.marks[startMark] || 0;
  106 |         const end = window.performanceMetrics.marks[endMark] || performance.now();
  107 |         window.performanceMetrics.measures[name] = end - start;
  108 |         return originalMeasure(name, startMark, endMark);
  109 |       };
  110 |     });
  111 |   });
  112 |
  113 |   test('home page load performance', async ({ page }) => {
  114 |     const startTime = performance.now();
  115 |     
  116 |     await page.goto('/', { waitUntil: 'networkidle' });
  117 |     
  118 |     const loadTime = performance.now() - startTime;
  119 |     console.log(`Home page load time: ${loadTime.toFixed(2)}ms`);
  120 |     
  121 |     // Check against threshold
  122 |     expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.pageLoad.home);
  123 |     
  124 |     // Measure navigation timing
  125 |     const navTiming = await measureNavigationTiming(page);
  126 |     console.log('Navigation timing:', navTiming);
  127 |     
  128 |     // Measure web vitals
  129 |     const webVitals = await measureWebVitals(page);
  130 |     console.log('Web Vitals:', webVitals);
  131 |     
  132 |     // Assert web vitals
  133 |     expect(webVitals.FCP).toBeLessThan(PERFORMANCE_THRESHOLDS.firstContentfulPaint);
  134 |     expect(webVitals.LCP).toBeLessThan(PERFORMANCE_THRESHOLDS.largestContentfulPaint);
  135 |     expect(webVitals.CLS).toBeLessThan(PERFORMANCE_THRESHOLDS.cumulativeLayoutShift);
  136 |   });
  137 |
  138 |   test('sign-in page performance', async ({ page }) => {
  139 |     const startTime = performance.now();
  140 |     
  141 |     await page.goto('/sign-in', { waitUntil: 'networkidle' });
  142 |     
  143 |     const loadTime = performance.now() - startTime;
  144 |     console.log(`Sign-in page load time: ${loadTime.toFixed(2)}ms`);
  145 |     
  146 |     expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.pageLoad.signIn);
  147 |     
  148 |     // Measure form interaction performance
  149 |     await page.fill('input[name="email"]', 'test@example.com');
  150 |     await page.fill('input[name="password"]', 'password123');
  151 |     
  152 |     const interactionStart = performance.now();
  153 |     await page.click('button[type="submit"]');
  154 |     const interactionTime = performance.now() - interactionStart;
  155 |     
  156 |     console.log(`Form submission time: ${interactionTime.toFixed(2)}ms`);
  157 |     expect(interactionTime).toBeLessThan(100); // Form should respond quickly
  158 |   });
  159 |
> 160 |   test('image lazy loading performance', async ({ page }) => {
      |   ^ Error: browserType.launch: Executable doesn't exist at /home/cvat/.cache/ms-playwright/webkit-2158/pw_run.sh
  161 |     await page.goto('/', { waitUntil: 'domcontentloaded' });
  162 |     
  163 |     // Check that images are lazy loaded
  164 |     const lazyImages = await page.$$eval('img[loading="lazy"]', imgs => imgs.length);
  165 |     expect(lazyImages).toBeGreaterThan(0);
  166 |     
  167 |     // Measure time to load visible images
  168 |     const imageLoadStart = performance.now();
  169 |     await page.waitForLoadState('networkidle');
  170 |     const imageLoadTime = performance.now() - imageLoadStart;
  171 |     
  172 |     console.log(`Image loading time: ${imageLoadTime.toFixed(2)}ms`);
  173 |     expect(imageLoadTime).toBeLessThan(2000); // Images should load within 2s
  174 |   });
  175 |
  176 |   test('route transition performance', async ({ page }) => {
  177 |     await page.goto('/');
  178 |     
  179 |     // Measure navigation between routes
  180 |     const transitions = [
  181 |       { from: '/', to: '/about', name: 'Home to About' },
  182 |       { from: '/about', to: '/sign-in', name: 'About to Sign In' },
  183 |       { from: '/sign-in', to: '/sign-up', name: 'Sign In to Sign Up' },
  184 |     ];
  185 |     
  186 |     for (const transition of transitions) {
  187 |       if (page.url() !== new URL(transition.from, page.url()).href) {
  188 |         await page.goto(transition.from);
  189 |       }
  190 |       
  191 |       const transitionStart = performance.now();
  192 |       await Promise.all([
  193 |         page.waitForURL(transition.to),
  194 |         page.click(`a[href="${transition.to}"]`),
  195 |       ]);
  196 |       const transitionTime = performance.now() - transitionStart;
  197 |       
  198 |       console.log(`${transition.name} transition: ${transitionTime.toFixed(2)}ms`);
  199 |       expect(transitionTime).toBeLessThan(500); // Transitions should be smooth
  200 |     }
  201 |   });
  202 |
  203 |   test('memory usage monitoring', async ({ page }) => {
  204 |     await page.goto('/');
  205 |     
  206 |     // Get initial memory usage
  207 |     const initialMemory = await page.evaluate(() => {
  208 |       if ('memory' in performance) {
  209 |         return (performance as any).memory.usedJSHeapSize;
  210 |       }
  211 |       return null;
  212 |     });
  213 |     
  214 |     if (initialMemory) {
  215 |       // Navigate through multiple pages
  216 |       const pages = ['/', '/about', '/sign-in', '/sign-up', '/documentation'];
  217 |       
  218 |       for (const url of pages) {
  219 |         await page.goto(url);
  220 |         await page.waitForLoadState('networkidle');
  221 |       }
  222 |       
  223 |       // Get final memory usage
  224 |       const finalMemory = await page.evaluate(() => {
  225 |         if ('memory' in performance) {
  226 |           return (performance as any).memory.usedJSHeapSize;
  227 |         }
  228 |         return null;
  229 |       });
  230 |       
  231 |       if (finalMemory) {
  232 |         const memoryIncrease = finalMemory - initialMemory;
  233 |         const memoryIncreaseMB = memoryIncrease / (1024 * 1024);
  234 |         
  235 |         console.log(`Memory increase: ${memoryIncreaseMB.toFixed(2)}MB`);
  236 |         expect(memoryIncreaseMB).toBeLessThan(50); // Should not leak more than 50MB
  237 |       }
  238 |     }
  239 |   });
  240 |
  241 |   test('bundle size impact', async ({ page }) => {
  242 |     const response = await page.goto('/');
  243 |     
  244 |     // Collect all JavaScript files
  245 |     const jsFiles = [];
  246 |     page.on('response', (response) => {
  247 |       const url = response.url();
  248 |       if (url.endsWith('.js') || url.includes('.js?')) {
  249 |         jsFiles.push({
  250 |           url,
  251 |           size: parseInt(response.headers()['content-length'] || '0'),
  252 |         });
  253 |       }
  254 |     });
  255 |     
  256 |     await page.waitForLoadState('networkidle');
  257 |     
  258 |     // Calculate total bundle size
  259 |     const totalSize = jsFiles.reduce((sum, file) => sum + file.size, 0);
  260 |     const totalSizeMB = totalSize / (1024 * 1024);
```