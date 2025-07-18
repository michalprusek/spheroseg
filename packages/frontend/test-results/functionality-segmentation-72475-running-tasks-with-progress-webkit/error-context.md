# Test info

- Name: Segmentation Queue Updates >> should show running tasks with progress
- Location: /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/functionality/segmentation-queue-updates.spec.ts:91:3

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
   1 | import { test, expect } from '@playwright/test';
   2 |
   3 | // Test user credentials
   4 | const TEST_USER = {
   5 |   email: 'testuser@test.com',
   6 |   password: 'testuser123'
   7 | };
   8 |
   9 | // Helper to login
   10 | async function loginAsTestUser(page: any) {
   11 |   await page.goto('/signin');
   12 |   await page.fill('input[type="email"]', TEST_USER.email);
   13 |   await page.fill('input[type="password"]', TEST_USER.password);
   14 |   await page.click('button[type="submit"]');
   15 |   await page.waitForURL('/dashboard');
   16 | }
   17 |
   18 | // Helper to navigate to a project
   19 | async function navigateToProject(page: any, projectName: string) {
   20 |   await page.goto('/dashboard');
   21 |   await page.waitForSelector('text=' + projectName);
   22 |   await page.click(`text=${projectName}`);
   23 |   await page.waitForSelector('h1:has-text("' + projectName + '")');
   24 | }
   25 |
   26 | test.describe('Segmentation Queue Updates', () => {
   27 |   test.beforeEach(async ({ page }) => {
   28 |     await loginAsTestUser(page);
   29 |   });
   30 |
   31 |   test('should display queue status indicator', async ({ page }) => {
   32 |     // Navigate to project
   33 |     await navigateToProject(page, 'test2');
   34 |     
   35 |     // Verify queue status indicator is visible
   36 |     const queueIndicator = await page.locator('.segmentation-queue-indicator');
   37 |     await expect(queueIndicator).toBeVisible();
   38 |     
   39 |     // Verify it shows current status
   40 |     const statusText = await queueIndicator.textContent();
   41 |     expect(statusText).toMatch(/Ready|Processing \d+|Queued: \d+/);
   42 |   });
   43 |
   44 |   test('should update queue count when adding tasks', async ({ page }) => {
   45 |     // Navigate to project
   46 |     await navigateToProject(page, 'test2');
   47 |     
   48 |     // Get initial queue status
   49 |     const queueIndicator = await page.locator('.segmentation-queue-indicator');
   50 |     const initialStatus = await queueIndicator.textContent();
   51 |     
   52 |     // Add a task to queue
   53 |     const imageItem = await page.locator('.image-gallery .image-item[data-status="without_segmentation"]').first();
   54 |     await imageItem.hover();
   55 |     await imageItem.click('button:has-text("Segment")');
   56 |     
   57 |     // Verify queue count increases
   58 |     await expect(queueIndicator).not.toHaveText(initialStatus || '', { timeout: 5000 });
   59 |     const newStatus = await queueIndicator.textContent();
   60 |     expect(newStatus).toMatch(/Processing|Queued/);
   61 |   });
   62 |
   63 |   test('should show queue details on click', async ({ page }) => {
   64 |     // Navigate to project
   65 |     await navigateToProject(page, 'test2');
   66 |     
   67 |     // Click queue indicator
   68 |     const queueIndicator = await page.locator('.segmentation-queue-indicator');
   69 |     await queueIndicator.click();
   70 |     
   71 |     // Verify queue details dropdown appears
   72 |     const queueDetails = await page.locator('.segmentation-queue-details');
   73 |     await expect(queueDetails).toBeVisible();
   74 |     
   75 |     // Verify queue sections
   76 |     await expect(queueDetails.locator('h3:has-text("Segmentation Queue")')).toBeVisible();
   77 |     
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
>  91 |   test('should show running tasks with progress', async ({ page }) => {
      |   ^ Error: browserType.launch: Executable doesn't exist at /home/cvat/.cache/ms-playwright/webkit-2158/pw_run.sh
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
  178 |   test('should show queue progress bar', async ({ page }) => {
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
```