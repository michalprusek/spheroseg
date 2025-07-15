# Test info

- Name: Real-time Status Updates >> should reflect status updates across different views
- Location: /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/functionality/realtime-status-updates.spec.ts:169:3

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
   69 |     
   70 |     // Wait for processing to start
   71 |     await expect(imageItem).toHaveAttribute('data-status', 'processing', { timeout: 30000 });
   72 |     
   73 |     // Verify progress indicator appears
   74 |     const progressBar = await imageItem.locator('.segmentation-progress');
   75 |     await expect(progressBar).toBeVisible();
   76 |     
   77 |     // Verify progress updates (checking multiple times)
   78 |     let previousProgress = 0;
   79 |     for (let i = 0; i < 3; i++) {
   80 |       await page.waitForTimeout(2000);
   81 |       const currentProgress = await progressBar.getAttribute('data-progress');
   82 |       const progressValue = parseInt(currentProgress || '0');
   83 |       expect(progressValue).toBeGreaterThanOrEqual(previousProgress);
   84 |       previousProgress = progressValue;
   85 |     }
   86 |   });
   87 |
   88 |   test('should update status to completed with results', async ({ page }) => {
   89 |     // Navigate to project
   90 |     await navigateToProject(page, 'test2');
   91 |     
   92 |     // Find an image in processing state or trigger segmentation
   93 |     let imageItem = await page.locator('.image-gallery .image-item[data-status="processing"]').first();
   94 |     
   95 |     if (!await imageItem.isVisible()) {
   96 |       // No processing images, trigger segmentation
   97 |       imageItem = await page.locator('.image-gallery .image-item[data-status="without_segmentation"]').first();
   98 |       await imageItem.hover();
   99 |       await imageItem.click('button:has-text("Segment")');
  100 |       await expect(imageItem).toHaveAttribute('data-status', 'processing', { timeout: 30000 });
  101 |     }
  102 |     
  103 |     // Wait for completion (this might take a while in real scenarios)
  104 |     await expect(imageItem).toHaveAttribute('data-status', 'completed', { timeout: 120000 });
  105 |     
  106 |     // Verify completion indicators
  107 |     await expect(imageItem.locator('.status-indicator.completed')).toBeVisible();
  108 |     await expect(imageItem.locator('.cell-count')).toBeVisible();
  109 |     
  110 |     // Verify cell count is displayed
  111 |     const cellCount = await imageItem.locator('.cell-count').textContent();
  112 |     expect(cellCount).toMatch(/\d+ cells?/);
  113 |   });
  114 |
  115 |   test('should handle segmentation failure gracefully', async ({ page }) => {
  116 |     // This test would require backend setup to simulate failure
  117 |     // For now, we'll test the UI's ability to display failed status
  118 |     
  119 |     // Navigate to project
  120 |     await navigateToProject(page, 'test2');
  121 |     
  122 |     // Look for any failed segmentations
  123 |     const failedItem = await page.locator('.image-gallery .image-item[data-status="failed"]').first();
  124 |     
  125 |     if (await failedItem.isVisible()) {
  126 |       // Verify failed status indicators
  127 |       await expect(failedItem.locator('.status-indicator.failed')).toBeVisible();
  128 |       await expect(failedItem.locator('.error-message')).toBeVisible();
  129 |       
  130 |       // Verify retry button is available
  131 |       await failedItem.hover();
  132 |       await expect(failedItem.locator('button:has-text("Retry")')).toBeVisible();
  133 |     }
  134 |   });
  135 |
  136 |   test('should update multiple images simultaneously', async ({ page }) => {
  137 |     // Navigate to project
  138 |     await navigateToProject(page, 'test2');
  139 |     
  140 |     // Select multiple images for batch segmentation
  141 |     const images = await page.locator('.image-gallery .image-item[data-status="without_segmentation"]').all();
  142 |     const imagesToProcess = images.slice(0, Math.min(3, images.length));
  143 |     
  144 |     if (imagesToProcess.length > 0) {
  145 |       // Enable selection mode
  146 |       await page.click('button:has-text("Select")');
  147 |       
  148 |       // Select images
  149 |       for (const img of imagesToProcess) {
  150 |         await img.click();
  151 |         await expect(img).toHaveClass(/selected/);
  152 |       }
  153 |       
  154 |       // Trigger batch segmentation
  155 |       await page.click('button:has-text("Segment Selected")');
  156 |       
  157 |       // Verify all selected images change to queued
  158 |       for (const img of imagesToProcess) {
  159 |         await expect(img).toHaveAttribute('data-status', 'queued', { timeout: 5000 });
  160 |       }
  161 |       
  162 |       // Verify queue counter updates
  163 |       const queueCounter = await page.locator('.segmentation-queue-count');
  164 |       const queueCount = await queueCounter.textContent();
  165 |       expect(parseInt(queueCount || '0')).toBeGreaterThanOrEqual(imagesToProcess.length);
  166 |     }
  167 |   });
  168 |
> 169 |   test('should reflect status updates across different views', async ({ page, context }) => {
      |   ^ Error: browserType.launch: Executable doesn't exist at /home/cvat/.cache/ms-playwright/firefox-1482/firefox/firefox
  170 |     // Open project in first tab
  171 |     await navigateToProject(page, 'test2');
  172 |     
  173 |     // Open same project in second tab
  174 |     const page2 = await context.newPage();
  175 |     await loginAsTestUser(page2);
  176 |     await navigateToProject(page2, 'test2');
  177 |     
  178 |     // Trigger segmentation in first tab
  179 |     const imageItem = await page.locator('.image-gallery .image-item[data-status="without_segmentation"]').first();
  180 |     const imageId = await imageItem.getAttribute('data-id');
  181 |     await imageItem.hover();
  182 |     await imageItem.click('button:has-text("Segment")');
  183 |     
  184 |     // Verify status changes in first tab
  185 |     await expect(imageItem).toHaveAttribute('data-status', 'queued', { timeout: 5000 });
  186 |     
  187 |     // Verify same status change appears in second tab
  188 |     const imageItemPage2 = await page2.locator(`.image-gallery .image-item[data-id="${imageId}"]`);
  189 |     await expect(imageItemPage2).toHaveAttribute('data-status', 'queued', { timeout: 10000 });
  190 |     
  191 |     // Close second tab
  192 |     await page2.close();
  193 |   });
  194 |
  195 |   test('should persist status updates after page refresh', async ({ page }) => {
  196 |     // Navigate to project
  197 |     await navigateToProject(page, 'test2');
  198 |     
  199 |     // Trigger segmentation
  200 |     const imageItem = await page.locator('.image-gallery .image-item[data-status="without_segmentation"]').first();
  201 |     const imageId = await imageItem.getAttribute('data-id');
  202 |     await imageItem.hover();
  203 |     await imageItem.click('button:has-text("Segment")');
  204 |     
  205 |     // Wait for status change
  206 |     await expect(imageItem).toHaveAttribute('data-status', 'queued', { timeout: 5000 });
  207 |     
  208 |     // Refresh page
  209 |     await page.reload();
  210 |     
  211 |     // Verify status persists after refresh
  212 |     const imageItemAfterRefresh = await page.locator(`.image-gallery .image-item[data-id="${imageId}"]`);
  213 |     await expect(imageItemAfterRefresh).toHaveAttribute('data-status', 'queued');
  214 |   });
  215 |
  216 |   test('should show toast notifications for status changes', async ({ page }) => {
  217 |     // Navigate to project
  218 |     await navigateToProject(page, 'test2');
  219 |     
  220 |     // Trigger segmentation
  221 |     const imageItem = await page.locator('.image-gallery .image-item[data-status="without_segmentation"]').first();
  222 |     await imageItem.hover();
  223 |     await imageItem.click('button:has-text("Segment")');
  224 |     
  225 |     // Verify toast notification appears
  226 |     await expect(page.locator('.toast-notification:has-text("Segmentation queued")')).toBeVisible();
  227 |     
  228 |     // Wait for processing notification
  229 |     await expect(page.locator('.toast-notification:has-text("Segmentation started")')).toBeVisible({ timeout: 30000 });
  230 |   });
  231 |
  232 |   test('should update project statistics in real-time', async ({ page }) => {
  233 |     // Navigate to project
  234 |     await navigateToProject(page, 'test2');
  235 |     
  236 |     // Get initial statistics
  237 |     const statsSection = await page.locator('.project-statistics');
  238 |     const initialCompleted = await statsSection.locator('.stat-completed').textContent();
  239 |     const initialQueued = await statsSection.locator('.stat-queued').textContent();
  240 |     
  241 |     // Trigger segmentation
  242 |     const imageItem = await page.locator('.image-gallery .image-item[data-status="without_segmentation"]').first();
  243 |     await imageItem.hover();
  244 |     await imageItem.click('button:has-text("Segment")');
  245 |     
  246 |     // Verify statistics update
  247 |     await expect(statsSection.locator('.stat-queued')).not.toHaveText(initialQueued || '', { timeout: 5000 });
  248 |     
  249 |     // The queued count should increase
  250 |     const newQueued = await statsSection.locator('.stat-queued').textContent();
  251 |     expect(parseInt(newQueued || '0')).toBeGreaterThan(parseInt(initialQueued || '0'));
  252 |   });
  253 |
  254 |   test('should handle WebSocket disconnection gracefully', async ({ page }) => {
  255 |     // Navigate to project
  256 |     await navigateToProject(page, 'test2');
  257 |     
  258 |     // Simulate WebSocket disconnection by going offline
  259 |     await page.context().setOffline(true);
  260 |     
  261 |     // Verify offline indicator appears
  262 |     await expect(page.locator('.connection-status.offline')).toBeVisible({ timeout: 10000 });
  263 |     
  264 |     // Try to trigger segmentation while offline
  265 |     const imageItem = await page.locator('.image-gallery .image-item[data-status="without_segmentation"]').first();
  266 |     await imageItem.hover();
  267 |     await imageItem.click('button:has-text("Segment")');
  268 |     
  269 |     // Verify offline message
```