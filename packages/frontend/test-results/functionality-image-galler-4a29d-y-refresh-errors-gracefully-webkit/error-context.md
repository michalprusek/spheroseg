# Test info

- Name: Image Gallery Refresh After Upload >> should handle gallery refresh errors gracefully
- Location: /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/functionality/image-gallery-refresh.spec.ts:315:3

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
  215 |     // Verify list updated
  216 |     const newListItems = await gallery.locator('.list-item').count();
  217 |     expect(newListItems).toBe(initialListItems + 1);
  218 |   });
  219 |
  220 |   test('should handle rapid consecutive uploads', async ({ page }) => {
  221 |     // Navigate to project
  222 |     await navigateToProject(page, 'test2');
  223 |     
  224 |     const gallery = await page.locator('.image-gallery');
  225 |     const initialCount = await gallery.locator('.image-item').count();
  226 |     
  227 |     // Upload multiple images rapidly
  228 |     const uploads = [];
  229 |     for (let i = 1; i <= 3; i++) {
  230 |       const uploadPromise = (async () => {
  231 |         await page.click('button:has-text("Upload Images")');
  232 |         const fileInput = await page.locator('input[type="file"]');
  233 |         const testImagePath = path.join(__dirname, `../fixtures/rapid-test-${i}.png`);
  234 |         await fileInput.setInputFiles(testImagePath);
  235 |       })();
  236 |       uploads.push(uploadPromise);
  237 |     }
  238 |     
  239 |     // Wait for all uploads to start
  240 |     await Promise.all(uploads);
  241 |     
  242 |     // Wait for all uploads to complete
  243 |     await page.waitForSelector('text=3 files uploaded', { timeout: 60000 });
  244 |     
  245 |     // Verify all images appear
  246 |     const finalCount = await gallery.locator('.image-item').count();
  247 |     expect(finalCount).toBe(initialCount + 3);
  248 |   });
  249 |
  250 |   test('should update gallery across multiple browser tabs', async ({ page, context }) => {
  251 |     // Open project in first tab
  252 |     await navigateToProject(page, 'test2');
  253 |     
  254 |     // Open same project in second tab
  255 |     const page2 = await context.newPage();
  256 |     await loginAsTestUser(page2);
  257 |     await navigateToProject(page2, 'test2');
  258 |     
  259 |     // Get initial counts in both tabs
  260 |     const gallery1 = await page.locator('.image-gallery');
  261 |     const gallery2 = await page2.locator('.image-gallery');
  262 |     
  263 |     const initialCount1 = await gallery1.locator('.image-item').count();
  264 |     const initialCount2 = await gallery2.locator('.image-item').count();
  265 |     expect(initialCount1).toBe(initialCount2);
  266 |     
  267 |     // Upload image in first tab
  268 |     await page.click('button:has-text("Upload Images")');
  269 |     const fileInput = await page.locator('input[type="file"]');
  270 |     const testImagePath = path.join(__dirname, '../fixtures/cross-tab-test.png');
  271 |     await fileInput.setInputFiles(testImagePath);
  272 |     
  273 |     await page.waitForSelector('text=Upload complete', { timeout: 30000 });
  274 |     
  275 |     // Verify gallery updated in first tab
  276 |     const newCount1 = await gallery1.locator('.image-item').count();
  277 |     expect(newCount1).toBe(initialCount1 + 1);
  278 |     
  279 |     // Verify gallery updated in second tab (with a small delay for sync)
  280 |     await page2.waitForTimeout(2000);
  281 |     const newCount2 = await gallery2.locator('.image-item').count();
  282 |     expect(newCount2).toBe(initialCount2 + 1);
  283 |     
  284 |     // Close second tab
  285 |     await page2.close();
  286 |   });
  287 |
  288 |   test('should show upload progress in gallery', async ({ page }) => {
  289 |     // Navigate to project
  290 |     await navigateToProject(page, 'test2');
  291 |     
  292 |     // Start upload
  293 |     await page.click('button:has-text("Upload Images")');
  294 |     const fileInput = await page.locator('input[type="file"]');
  295 |     const testImagePath = path.join(__dirname, '../fixtures/progress-test.png');
  296 |     await fileInput.setInputFiles(testImagePath);
  297 |     
  298 |     // Look for upload placeholder in gallery
  299 |     const uploadPlaceholder = await page.locator('.image-gallery .upload-placeholder');
  300 |     await expect(uploadPlaceholder).toBeVisible({ timeout: 5000 });
  301 |     
  302 |     // Verify it shows progress
  303 |     const progressIndicator = await uploadPlaceholder.locator('.upload-progress');
  304 |     await expect(progressIndicator).toBeVisible();
  305 |     
  306 |     // Wait for upload to complete
  307 |     await page.waitForSelector('text=Upload complete', { timeout: 30000 });
  308 |     
  309 |     // Verify placeholder is replaced with actual image
  310 |     await expect(uploadPlaceholder).not.toBeVisible();
  311 |     const newImage = await page.locator('.image-gallery .image-item').last();
  312 |     await expect(newImage).toBeVisible();
  313 |   });
  314 |
> 315 |   test('should handle gallery refresh errors gracefully', async ({ page }) => {
      |   ^ Error: browserType.launch: Executable doesn't exist at /home/cvat/.cache/ms-playwright/webkit-2158/pw_run.sh
  316 |     // Navigate to project
  317 |     await navigateToProject(page, 'test2');
  318 |     
  319 |     // Simulate network issue
  320 |     await page.route('**/api/images/**', route => {
  321 |       if (route.request().method() === 'GET') {
  322 |         route.abort('failed');
  323 |       } else {
  324 |         route.continue();
  325 |       }
  326 |     });
  327 |     
  328 |     // Upload image
  329 |     await page.click('button:has-text("Upload Images")');
  330 |     const fileInput = await page.locator('input[type="file"]');
  331 |     const testImagePath = path.join(__dirname, '../fixtures/error-test.png');
  332 |     await fileInput.setInputFiles(testImagePath);
  333 |     
  334 |     // Upload should still work
  335 |     await page.waitForSelector('text=Upload complete', { timeout: 30000 });
  336 |     
  337 |     // Gallery might show error but shouldn't crash
  338 |     const errorMessage = await page.locator('.gallery-error-message');
  339 |     if (await errorMessage.isVisible()) {
  340 |       // Verify retry option
  341 |       await expect(page.locator('button:has-text("Retry")')).toBeVisible();
  342 |     }
  343 |     
  344 |     // Remove network simulation
  345 |     await page.unroute('**/api/images/**');
  346 |   });
  347 | });
```