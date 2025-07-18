# Test info

- Name: Segmentation Queue Updates >> should show estimated time for queue completion
- Location: /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/functionality/segmentation-queue-updates.spec.ts:311:3

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
  211 |     const priorityButton = await imageItem.locator('button:has-text("Segment Priority")');
  212 |     if (await priorityButton.isVisible()) {
  213 |       await priorityButton.click();
  214 |       
  215 |       // Open queue details
  216 |       const queueIndicator = await page.locator('.segmentation-queue-indicator');
  217 |       await queueIndicator.click();
  218 |       
  219 |       const queueDetails = await page.locator('.segmentation-queue-details');
  220 |       
  221 |       // Verify priority indicator
  222 |       const priorityItem = await queueDetails.locator('.queue-item[data-priority="high"]').first();
  223 |       await expect(priorityItem).toBeVisible();
  224 |       await expect(priorityItem.locator('.priority-indicator')).toBeVisible();
  225 |     }
  226 |   });
  227 |
  228 |   test('should clear completed tasks from queue view', async ({ page }) => {
  229 |     // Navigate to project
  230 |     await navigateToProject(page, 'test2');
  231 |     
  232 |     // Open queue details
  233 |     const queueIndicator = await page.locator('.segmentation-queue-indicator');
  234 |     await queueIndicator.click();
  235 |     
  236 |     const queueDetails = await page.locator('.segmentation-queue-details');
  237 |     
  238 |     // Check if there are any completed tasks
  239 |     const completedTasks = await queueDetails.locator('.queue-item[data-status="completed"]').count();
  240 |     
  241 |     if (completedTasks > 0) {
  242 |       // Tasks should auto-clear after a delay
  243 |       await page.waitForTimeout(5000);
  244 |       
  245 |       // Verify completed tasks are removed
  246 |       const remainingCompleted = await queueDetails.locator('.queue-item[data-status="completed"]').count();
  247 |       expect(remainingCompleted).toBeLessThan(completedTasks);
  248 |     }
  249 |   });
  250 |
  251 |   test('should handle queue errors gracefully', async ({ page }) => {
  252 |     // Navigate to project
  253 |     await navigateToProject(page, 'test2');
  254 |     
  255 |     // Open queue details
  256 |     const queueIndicator = await page.locator('.segmentation-queue-indicator');
  257 |     await queueIndicator.click();
  258 |     
  259 |     const queueDetails = await page.locator('.segmentation-queue-details');
  260 |     
  261 |     // Check for any failed tasks
  262 |     const failedTasks = await queueDetails.locator('.queue-item[data-status="failed"]');
  263 |     
  264 |     if (await failedTasks.count() > 0) {
  265 |       const failedTask = failedTasks.first();
  266 |       
  267 |       // Verify error indicator
  268 |       await expect(failedTask.locator('.error-indicator')).toBeVisible();
  269 |       
  270 |       // Verify retry option
  271 |       await failedTask.hover();
  272 |       await expect(failedTask.locator('button:has-text("Retry")')).toBeVisible();
  273 |     }
  274 |   });
  275 |
  276 |   test('should sync queue state across browser tabs', async ({ page, context }) => {
  277 |     // Open project in first tab
  278 |     await navigateToProject(page, 'test2');
  279 |     
  280 |     // Open same project in second tab
  281 |     const page2 = await context.newPage();
  282 |     await loginAsTestUser(page2);
  283 |     await navigateToProject(page2, 'test2');
  284 |     
  285 |     // Get initial queue status in both tabs
  286 |     const queue1 = await page.locator('.segmentation-queue-indicator');
  287 |     const queue2 = await page2.locator('.segmentation-queue-indicator');
  288 |     
  289 |     const initialStatus1 = await queue1.textContent();
  290 |     const initialStatus2 = await queue2.textContent();
  291 |     expect(initialStatus1).toBe(initialStatus2);
  292 |     
  293 |     // Add task in first tab
  294 |     const imageItem = await page.locator('.image-gallery .image-item[data-status="without_segmentation"]').first();
  295 |     await imageItem.hover();
  296 |     await imageItem.click('button:has-text("Segment")');
  297 |     
  298 |     // Verify queue updates in both tabs
  299 |     await expect(queue1).not.toHaveText(initialStatus1 || '', { timeout: 5000 });
  300 |     await expect(queue2).not.toHaveText(initialStatus2 || '', { timeout: 10000 });
  301 |     
  302 |     // Verify both show same status
  303 |     const newStatus1 = await queue1.textContent();
  304 |     const newStatus2 = await queue2.textContent();
  305 |     expect(newStatus1).toBe(newStatus2);
  306 |     
  307 |     // Close second tab
  308 |     await page2.close();
  309 |   });
  310 |
> 311 |   test('should show estimated time for queue completion', async ({ page }) => {
      |   ^ Error: browserType.launch: Executable doesn't exist at /home/cvat/.cache/ms-playwright/firefox-1482/firefox/firefox
  312 |     // Navigate to project
  313 |     await navigateToProject(page, 'test2');
  314 |     
  315 |     // Add multiple tasks to queue
  316 |     await page.click('button:has-text("Select")');
  317 |     const images = await page.locator('.image-gallery .image-item[data-status="without_segmentation"]').all();
  318 |     const imagesToSelect = images.slice(0, Math.min(3, images.length));
  319 |     
  320 |     if (imagesToSelect.length > 0) {
  321 |       for (const img of imagesToSelect) {
  322 |         await img.click();
  323 |       }
  324 |       
  325 |       await page.click('button:has-text("Segment Selected")');
  326 |       
  327 |       // Open queue details
  328 |       const queueIndicator = await page.locator('.segmentation-queue-indicator');
  329 |       await queueIndicator.click();
  330 |       
  331 |       const queueDetails = await page.locator('.segmentation-queue-details');
  332 |       
  333 |       // Look for time estimate
  334 |       const timeEstimate = await queueDetails.locator('.queue-time-estimate');
  335 |       if (await timeEstimate.isVisible()) {
  336 |         const estimateText = await timeEstimate.textContent();
  337 |         expect(estimateText).toMatch(/\d+ (seconds?|minutes?|hours?)/);
  338 |       }
  339 |     }
  340 |   });
  341 | });
```