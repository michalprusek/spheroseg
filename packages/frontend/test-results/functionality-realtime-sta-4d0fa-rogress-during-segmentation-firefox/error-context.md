# Test info

- Name: Real-time Status Updates >> should show real-time progress during segmentation
- Location: /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/functionality/realtime-status-updates.spec.ts:61:3

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
   1 | import { test, expect } from '@playwright/test';
   2 | import path from 'path';
   3 |
   4 | // Test user credentials
   5 | const TEST_USER = {
   6 |   email: 'testuser@test.com',
   7 |   password: 'testuser123'
   8 | };
   9 |
   10 | // Helper to login
   11 | async function loginAsTestUser(page: any) {
   12 |   await page.goto('/signin');
   13 |   await page.fill('input[type="email"]', TEST_USER.email);
   14 |   await page.fill('input[type="password"]', TEST_USER.password);
   15 |   await page.click('button[type="submit"]');
   16 |   await page.waitForURL('/dashboard');
   17 | }
   18 |
   19 | // Helper to navigate to a project
   20 | async function navigateToProject(page: any, projectName: string) {
   21 |   await page.goto('/dashboard');
   22 |   await page.waitForSelector('text=' + projectName);
   23 |   await page.click(`text=${projectName}`);
   24 |   await page.waitForSelector('h1:has-text("' + projectName + '")');
   25 | }
   26 |
   27 | test.describe('Real-time Status Updates', () => {
   28 |   test.beforeEach(async ({ page }) => {
   29 |     await loginAsTestUser(page);
   30 |   });
   31 |
   32 |   test('should update image status from queued to processing', async ({ page }) => {
   33 |     // Navigate to project
   34 |     await navigateToProject(page, 'test2');
   35 |     
   36 |     // Find an image with status "without_segmentation"
   37 |     const imageItem = await page.locator('.image-gallery .image-item[data-status="without_segmentation"]').first();
   38 |     await expect(imageItem).toBeVisible();
   39 |     
   40 |     // Get image ID
   41 |     const imageId = await imageItem.getAttribute('data-id');
   42 |     expect(imageId).toBeTruthy();
   43 |     
   44 |     // Trigger segmentation
   45 |     await imageItem.hover();
   46 |     await imageItem.click('button:has-text("Segment")');
   47 |     
   48 |     // Verify status changes to queued immediately
   49 |     await expect(imageItem).toHaveAttribute('data-status', 'queued', { timeout: 5000 });
   50 |     
   51 |     // Verify visual indicator changes
   52 |     await expect(imageItem.locator('.status-indicator.queued')).toBeVisible();
   53 |     
   54 |     // Wait for status to change to processing (simulating ML service pickup)
   55 |     await expect(imageItem).toHaveAttribute('data-status', 'processing', { timeout: 30000 });
   56 |     
   57 |     // Verify processing animation appears
   58 |     await expect(imageItem.locator('.processing-spinner')).toBeVisible();
   59 |   });
   60 |
>  61 |   test('should show real-time progress during segmentation', async ({ page }) => {
      |   ^ Error: browserType.launch: Executable doesn't exist at /home/cvat/.cache/ms-playwright/firefox-1482/firefox/firefox
   62 |     // Navigate to project
   63 |     await navigateToProject(page, 'test2');
   64 |     
   65 |     // Start segmentation on an image
   66 |     const imageItem = await page.locator('.image-gallery .image-item[data-status="without_segmentation"]').first();
   67 |     await imageItem.hover();
   68 |     await imageItem.click('button:has-text("Segment")');
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
```