# Test info

- Name: Performance Benchmarks >> rendering performance under load
- Location: /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/performance/performance-benchmarks.spec.ts:306:3

# Error details

```
Error: browserType.launch: Executable doesn't exist at /home/cvat/.cache/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell
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
  261 |     
  262 |     console.log(`Total JavaScript bundle size: ${totalSizeMB.toFixed(2)}MB`);
  263 |     console.log('Individual bundles:', jsFiles.map(f => ({
  264 |       name: f.url.split('/').pop(),
  265 |       size: `${(f.size / 1024).toFixed(2)}KB`,
  266 |     })));
  267 |     
  268 |     expect(totalSizeMB).toBeLessThan(2); // Total JS should be under 2MB
  269 |   });
  270 |
  271 |   test('API response time benchmarks', async ({ page }) => {
  272 |     await page.goto('/sign-in');
  273 |     
  274 |     // Monitor API calls
  275 |     const apiCalls = [];
  276 |     page.on('response', async (response) => {
  277 |       const url = response.url();
  278 |       if (url.includes('/api/')) {
  279 |         const timing = response.timing();
  280 |         apiCalls.push({
  281 |           url,
  282 |           status: response.status(),
  283 |           duration: timing?.responseEnd || 0,
  284 |         });
  285 |       }
  286 |     });
  287 |     
  288 |     // Trigger API call
  289 |     await page.fill('input[name="email"]', 'test@example.com');
  290 |     await page.fill('input[name="password"]', 'password123');
  291 |     await page.click('button[type="submit"]');
  292 |     
  293 |     // Wait for API response
  294 |     await page.waitForResponse((response) => 
  295 |       response.url().includes('/api/') && response.status() !== 304,
  296 |       { timeout: 5000 }
  297 |     ).catch(() => {});
  298 |     
  299 |     // Analyze API performance
  300 |     apiCalls.forEach((call) => {
  301 |       console.log(`API Call: ${call.url.split('/').pop()} - ${call.duration.toFixed(2)}ms`);
  302 |       expect(call.duration).toBeLessThan(1000); // API calls should respond within 1s
  303 |     });
  304 |   });
  305 |
> 306 |   test('rendering performance under load', async ({ page }) => {
      |   ^ Error: browserType.launch: Executable doesn't exist at /home/cvat/.cache/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell
  307 |     await page.goto('/');
  308 |     
  309 |     // Measure rendering performance
  310 |     const renderingMetrics = await page.evaluate(async () => {
  311 |       const metrics = {
  312 |         fps: [],
  313 |         jank: 0,
  314 |       };
  315 |       
  316 |       let lastTime = performance.now();
  317 |       let frameCount = 0;
  318 |       
  319 |       return new Promise((resolve) => {
  320 |         const measureFrame = () => {
  321 |           const currentTime = performance.now();
  322 |           const delta = currentTime - lastTime;
  323 |           
  324 |           if (delta > 16.67) { // More than one frame (60fps = 16.67ms per frame)
  325 |             metrics.jank++;
  326 |           }
  327 |           
  328 |           frameCount++;
  329 |           if (frameCount % 60 === 0) { // Calculate FPS every 60 frames
  330 |             const fps = 1000 / delta;
  331 |             metrics.fps.push(fps);
  332 |           }
  333 |           
  334 |           lastTime = currentTime;
  335 |           
  336 |           if (frameCount < 300) { // Measure for 5 seconds at 60fps
  337 |             requestAnimationFrame(measureFrame);
  338 |           } else {
  339 |             resolve(metrics);
  340 |           }
  341 |         };
  342 |         
  343 |         requestAnimationFrame(measureFrame);
  344 |         
  345 |         // Simulate user interactions during measurement
  346 |         setTimeout(() => {
  347 |           window.scrollTo({ top: 1000, behavior: 'smooth' });
  348 |         }, 1000);
  349 |         
  350 |         setTimeout(() => {
  351 |           window.scrollTo({ top: 0, behavior: 'smooth' });
  352 |         }, 2500);
  353 |       });
  354 |     });
  355 |     
  356 |     const avgFPS = renderingMetrics.fps.reduce((a, b) => a + b, 0) / renderingMetrics.fps.length;
  357 |     console.log(`Average FPS: ${avgFPS.toFixed(2)}`);
  358 |     console.log(`Jank frames: ${renderingMetrics.jank}`);
  359 |     
  360 |     expect(avgFPS).toBeGreaterThan(30); // Should maintain at least 30fps
  361 |     expect(renderingMetrics.jank).toBeLessThan(10); // Minimal jank
  362 |   });
  363 | });
  364 |
  365 | test.describe('Performance Regression Tests', () => {
  366 |   test('compare performance against baseline', async ({ page }) => {
  367 |     const baseline = {
  368 |       home: { FCP: 1200, LCP: 2000, CLS: 0.05 },
  369 |       about: { FCP: 1000, LCP: 1800, CLS: 0.03 },
  370 |     };
  371 |     
  372 |     for (const [pageName, expectedMetrics] of Object.entries(baseline)) {
  373 |       await page.goto(pageName === 'home' ? '/' : `/${pageName}`);
  374 |       
  375 |       const metrics = await measureWebVitals(page);
  376 |       
  377 |       // Allow 20% regression from baseline
  378 |       const tolerance = 1.2;
  379 |       
  380 |       expect(metrics.FCP).toBeLessThan(expectedMetrics.FCP * tolerance);
  381 |       expect(metrics.LCP).toBeLessThan(expectedMetrics.LCP * tolerance);
  382 |       expect(metrics.CLS).toBeLessThan(expectedMetrics.CLS * tolerance);
  383 |       
  384 |       console.log(`${pageName} performance:`, {
  385 |         FCP: `${metrics.FCP.toFixed(0)}ms (baseline: ${expectedMetrics.FCP}ms)`,
  386 |         LCP: `${metrics.LCP.toFixed(0)}ms (baseline: ${expectedMetrics.LCP}ms)`,
  387 |         CLS: `${metrics.CLS.toFixed(3)} (baseline: ${expectedMetrics.CLS})`,
  388 |       });
  389 |     }
  390 |   });
  391 | });
```