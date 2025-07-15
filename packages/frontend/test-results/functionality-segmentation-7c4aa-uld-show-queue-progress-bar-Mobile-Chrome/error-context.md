# Test info

- Name: Segmentation Queue Updates >> should show queue progress bar
- Location: /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/functionality/segmentation-queue-updates.spec.ts:178:3

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
   78 |     // Check for queue items or empty state
   79 |     const queueItems = await queueDetails.locator('.queue-item').count();
   80 |     if (queueItems > 0) {
   81 |       // Verify queue item structure
   82 |       const firstItem = await queueDetails.locator('.queue-item').first();
   83 |       await expect(firstItem.locator('.queue-item-name')).toBeVisible();
   84 |       await expect(firstItem.locator('.queue-item-status')).toBeVisible();
   85 |     } else {
   86 |       // Verify empty state
   87 |       await expect(queueDetails.locator('text=No tasks in queue')).toBeVisible();
   88 |     }
   89 |   });
   90 |
   91 |   test('should show running tasks with progress', async ({ page }) => {
   92 |     // Navigate to project
   93 |     await navigateToProject(page, 'test2');
   94 |     
   95 |     // Trigger segmentation to have running task
   96 |     const imageItem = await page.locator('.image-gallery .image-item[data-status="without_segmentation"]').first();
   97 |     await imageItem.hover();
   98 |     await imageItem.click('button:has-text("Segment")');
   99 |     
  100 |     // Wait for task to start processing
  101 |     await page.waitForTimeout(2000);
  102 |     
  103 |     // Open queue details
  104 |     const queueIndicator = await page.locator('.segmentation-queue-indicator');
  105 |     await queueIndicator.click();
  106 |     
  107 |     const queueDetails = await page.locator('.segmentation-queue-details');
  108 |     
  109 |     // Look for running tasks
  110 |     const runningTask = await queueDetails.locator('.queue-item[data-status="running"]').first();
  111 |     if (await runningTask.isVisible()) {
  112 |       // Verify running indicator
  113 |       await expect(runningTask.locator('.loading-spinner')).toBeVisible();
  114 |       await expect(runningTask.locator('text=Processing')).toBeVisible();
  115 |     }
  116 |   });
  117 |
  118 |   test('should update queue in real-time', async ({ page }) => {
  119 |     // Navigate to project
  120 |     await navigateToProject(page, 'test2');
  121 |     
  122 |     // Open queue details
  123 |     const queueIndicator = await page.locator('.segmentation-queue-indicator');
  124 |     await queueIndicator.click();
  125 |     
  126 |     const queueDetails = await page.locator('.segmentation-queue-details');
  127 |     await expect(queueDetails).toBeVisible();
  128 |     
  129 |     // Get initial queue state
  130 |     const initialQueueItems = await queueDetails.locator('.queue-item').count();
  131 |     
  132 |     // Add new task
  133 |     const imageItem = await page.locator('.image-gallery .image-item[data-status="without_segmentation"]').first();
  134 |     await imageItem.hover();
  135 |     await imageItem.click('button:has-text("Segment")');
  136 |     
  137 |     // Verify queue updates without closing/reopening
  138 |     await expect(queueDetails.locator('.queue-item')).toHaveCount(initialQueueItems + 1, { timeout: 5000 });
  139 |     
  140 |     // Verify new item appears
  141 |     const newItem = await queueDetails.locator('.queue-item').last();
  142 |     await expect(newItem).toBeVisible();
  143 |   });
  144 |
  145 |   test('should handle batch queue operations', async ({ page }) => {
  146 |     // Navigate to project
  147 |     await navigateToProject(page, 'test2');
  148 |     
  149 |     // Select multiple images
  150 |     await page.click('button:has-text("Select")');
  151 |     
  152 |     const images = await page.locator('.image-gallery .image-item[data-status="without_segmentation"]').all();
  153 |     const imagesToSelect = images.slice(0, Math.min(5, images.length));
  154 |     
  155 |     for (const img of imagesToSelect) {
  156 |       await img.click();
  157 |     }
  158 |     
  159 |     // Get initial queue status
  160 |     const queueIndicator = await page.locator('.segmentation-queue-indicator');
  161 |     const initialStatus = await queueIndicator.textContent();
  162 |     
  163 |     // Trigger batch segmentation
  164 |     await page.click('button:has-text("Segment Selected")');
  165 |     
  166 |     // Verify queue updates with batch count
  167 |     await expect(queueIndicator).not.toHaveText(initialStatus || '', { timeout: 5000 });
  168 |     
  169 |     // Open queue details
  170 |     await queueIndicator.click();
  171 |     const queueDetails = await page.locator('.segmentation-queue-details');
  172 |     
  173 |     // Verify all items appear in queue
  174 |     const queuedItems = await queueDetails.locator('.queue-item[data-status="queued"]').count();
  175 |     expect(queuedItems).toBeGreaterThanOrEqual(imagesToSelect.length);
  176 |   });
  177 |
> 178 |   test('should show queue progress bar', async ({ page }) => {
      |   ^ Error: browserType.launch: Executable doesn't exist at /home/cvat/.cache/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell
  179 |     // Navigate to project
  180 |     await navigateToProject(page, 'test2');
  181 |     
  182 |     const queueIndicator = await page.locator('.segmentation-queue-indicator');
  183 |     
  184 |     // Check if there's a progress bar
  185 |     const progressBar = await queueIndicator.locator('.queue-progress-bar');
  186 |     
  187 |     if (await progressBar.isVisible()) {
  188 |       // Verify progress bar has value
  189 |       const progressValue = await progressBar.getAttribute('value');
  190 |       expect(progressValue).toBeTruthy();
  191 |       
  192 |       // Verify progress percentage
  193 |       const progressPercent = parseInt(progressValue || '0');
  194 |       expect(progressPercent).toBeGreaterThanOrEqual(0);
  195 |       expect(progressPercent).toBeLessThanOrEqual(100);
  196 |     }
  197 |   });
  198 |
  199 |   test('should prioritize user-triggered tasks', async ({ page }) => {
  200 |     // Navigate to project
  201 |     await navigateToProject(page, 'test2');
  202 |     
  203 |     // Add some background tasks first (if possible)
  204 |     // This would require backend support for priority queuing
  205 |     
  206 |     // Trigger high-priority segmentation
  207 |     const imageItem = await page.locator('.image-gallery .image-item[data-status="without_segmentation"]').first();
  208 |     await imageItem.hover();
  209 |     
  210 |     // Look for priority option
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
```