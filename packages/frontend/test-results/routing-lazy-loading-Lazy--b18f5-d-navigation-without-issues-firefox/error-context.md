# Test info

- Name: Lazy Loading and Error Handling >> should handle rapid navigation without issues
- Location: /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/routing/lazy-loading.spec.ts:123:3

# Error details

```
Error: browserType.launch: Executable doesn't exist at /home/cvat/.cache/ms-playwright/firefox-1482/firefox/firefox
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
   23 |     // Page should eventually load
   24 |     await expect(page.locator('h1')).toContainText('SpheroSeg Documentation');
   25 |   });
   26 |
   27 |   test('should handle route loading errors gracefully', async ({ page }) => {
   28 |     // Intercept and fail a chunk request
   29 |     await page.route('**/src/pages/Documentation.tsx', route => {
   30 |       route.abort('failed');
   31 |     });
   32 |
   33 |     // Try to navigate to documentation
   34 |     await page.goto(urls.documentation);
   35 |     
   36 |     // Should either show error boundary or fallback to NotFound
   37 |     await expect(page.locator('text=Page not found').or(page.locator('text=Something went wrong'))).toBeVisible();
   38 |   });
   39 |
   40 |   test('should lazy load routes on demand', async ({ page }) => {
   41 |     const loadedChunks: string[] = [];
   42 |     
   43 |     // Monitor network requests for JS chunks
   44 |     page.on('response', response => {
   45 |       if (response.url().includes('.js') && response.status() === 200) {
   46 |         loadedChunks.push(response.url());
   47 |       }
   48 |     });
   49 |
   50 |     // Load home page
   51 |     await navigateAndWaitForLoad(page, urls.home);
   52 |     const initialChunkCount = loadedChunks.length;
   53 |     
   54 |     // Navigate to documentation - should load new chunks
   55 |     await page.click(selectors.navigation.documentation);
   56 |     await page.waitForURL(urls.documentation);
   57 |     await page.waitForLoadState('networkidle');
   58 |     
   59 |     // Should have loaded additional chunks
   60 |     expect(loadedChunks.length).toBeGreaterThan(initialChunkCount);
   61 |   });
   62 |
   63 |   test('should handle network failures gracefully', async ({ page, context }) => {
   64 |     // Navigate to home page first
   65 |     await navigateAndWaitForLoad(page, urls.home);
   66 |     
   67 |     // Go offline
   68 |     await context.setOffline(true);
   69 |     
   70 |     // Try to navigate to another page
   71 |     await page.click(selectors.navigation.documentation).catch(() => {});
   72 |     
   73 |     // Should show some error or stay on current page
   74 |     // The exact behavior depends on the app's error handling
   75 |     await page.waitForTimeout(1000);
   76 |     
   77 |     // Go back online
   78 |     await context.setOffline(false);
   79 |     
   80 |     // Should be able to navigate now
   81 |     await page.click(selectors.navigation.documentation);
   82 |     await expect(page).toHaveURL(urls.documentation);
   83 |   });
   84 |
   85 |   test('should handle JavaScript errors without crashing', async ({ page }) => {
   86 |     let jsError: Error | null = null;
   87 |     
   88 |     // Listen for JavaScript errors
   89 |     page.on('pageerror', error => {
   90 |       jsError = error;
   91 |     });
   92 |
   93 |     // Navigate through pages
   94 |     await navigateAndWaitForLoad(page, urls.home);
   95 |     await page.click(selectors.navigation.documentation);
   96 |     await page.waitForURL(urls.documentation);
   97 |     
   98 |     // No JavaScript errors should occur during normal navigation
   99 |     expect(jsError).toBeNull();
  100 |   });
  101 |
  102 |   test('should load pages within acceptable time', async ({ page }) => {
  103 |     const maxLoadTime = 5000; // 5 seconds
  104 |     
  105 |     const pagesToTest = [
  106 |       urls.home,
  107 |       urls.documentation,
  108 |       urls.about,
  109 |       urls.termsOfService,
  110 |       urls.privacyPolicy,
  111 |     ];
  112 |
  113 |     for (const url of pagesToTest) {
  114 |       const startTime = Date.now();
  115 |       await page.goto(url);
  116 |       await page.waitForLoadState('networkidle');
  117 |       const loadTime = Date.now() - startTime;
  118 |       
  119 |       expect(loadTime).toBeLessThan(maxLoadTime);
  120 |     }
  121 |   });
  122 |
> 123 |   test('should handle rapid navigation without issues', async ({ page }) => {
      |   ^ Error: browserType.launch: Executable doesn't exist at /home/cvat/.cache/ms-playwright/firefox-1482/firefox/firefox
  124 |     await navigateAndWaitForLoad(page, urls.home);
  125 |     
  126 |     // Rapidly click through navigation
  127 |     await page.click(selectors.navigation.documentation);
  128 |     await page.click(selectors.navigation.termsOfService);
  129 |     await page.click(selectors.navigation.privacyPolicy);
  130 |     await page.click(selectors.navigation.about);
  131 |     
  132 |     // Wait for final navigation to complete
  133 |     await page.waitForLoadState('networkidle');
  134 |     
  135 |     // Should end up on the last clicked page
  136 |     await expect(page).toHaveURL(urls.about);
  137 |     await expect(page.locator('h1')).toContainText('About SpheroSeg');
  138 |   });
  139 |
  140 |   test('should preserve application state during navigation', async ({ page }) => {
  141 |     await navigateAndWaitForLoad(page, urls.home);
  142 |     
  143 |     // Change theme
  144 |     await page.click(selectors.themeToggle);
  145 |     
  146 |     // Get theme state
  147 |     const htmlElement = page.locator('html');
  148 |     const initialTheme = await htmlElement.getAttribute('class');
  149 |     
  150 |     // Navigate to another page
  151 |     await page.click(selectors.navigation.documentation);
  152 |     await page.waitForURL(urls.documentation);
  153 |     
  154 |     // Theme should be preserved
  155 |     const currentTheme = await htmlElement.getAttribute('class');
  156 |     expect(currentTheme).toBe(initialTheme);
  157 |   });
  158 |
  159 |   test('should handle 404 errors for non-existent routes', async ({ page }) => {
  160 |     const nonExistentRoutes = [
  161 |       '/non-existent-page',
  162 |       '/admin',
  163 |       '/api/test',
  164 |       '/projects/invalid-id',
  165 |     ];
  166 |
  167 |     for (const route of nonExistentRoutes) {
  168 |       await navigateAndWaitForLoad(page, route);
  169 |       
  170 |       // Should show 404 page
  171 |       await expect(page.locator('h1')).toContainText('Page not found');
  172 |       await expect(page.getByText('The page you requested could not be found')).toBeVisible();
  173 |       
  174 |       // Should have link back to home
  175 |       const homeLink = page.getByRole('link', { name: 'Return to Home' });
  176 |       await expect(homeLink).toBeVisible();
  177 |       
  178 |       // Clicking home link should work
  179 |       await homeLink.click();
  180 |       await expect(page).toHaveURL(urls.home);
  181 |     }
  182 |   });
  183 |
  184 |   test('should handle deep linking correctly', async ({ page }) => {
  185 |     // Direct navigation to deep links
  186 |     await navigateAndWaitForLoad(page, urls.documentation + '#api-reference');
  187 |     
  188 |     // Should load the page and scroll to section
  189 |     await expect(page).toHaveURL(urls.documentation + '#api-reference');
  190 |     await expect(page.locator('#api-reference')).toBeInViewport();
  191 |   });
  192 | });
```