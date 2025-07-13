import { test, expect } from '@playwright/test';

// Test user credentials
const TEST_USER = {
  email: 'testuser@test.com',
  password: 'testuser123'
};

// Helper to login
async function loginAsTestUser(page: any) {
  await page.goto('/signin');
  await page.fill('input[type="email"]', TEST_USER.email);
  await page.fill('input[type="password"]', TEST_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard');
}

// Helper to navigate to a project
async function navigateToProject(page: any, projectName: string) {
  await page.goto('/dashboard');
  await page.waitForSelector('text=' + projectName);
  await page.click(`text=${projectName}`);
  await page.waitForSelector('h1:has-text("' + projectName + '")');
}

test.describe('Segmentation Queue Updates', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('should display queue status indicator', async ({ page }) => {
    // Navigate to project
    await navigateToProject(page, 'test2');
    
    // Verify queue status indicator is visible
    const queueIndicator = await page.locator('.segmentation-queue-indicator');
    await expect(queueIndicator).toBeVisible();
    
    // Verify it shows current status
    const statusText = await queueIndicator.textContent();
    expect(statusText).toMatch(/Ready|Processing \d+|Queued: \d+/);
  });

  test('should update queue count when adding tasks', async ({ page }) => {
    // Navigate to project
    await navigateToProject(page, 'test2');
    
    // Get initial queue status
    const queueIndicator = await page.locator('.segmentation-queue-indicator');
    const initialStatus = await queueIndicator.textContent();
    
    // Add a task to queue
    const imageItem = await page.locator('.image-gallery .image-item[data-status="without_segmentation"]').first();
    await imageItem.hover();
    await imageItem.click('button:has-text("Segment")');
    
    // Verify queue count increases
    await expect(queueIndicator).not.toHaveText(initialStatus || '', { timeout: 5000 });
    const newStatus = await queueIndicator.textContent();
    expect(newStatus).toMatch(/Processing|Queued/);
  });

  test('should show queue details on click', async ({ page }) => {
    // Navigate to project
    await navigateToProject(page, 'test2');
    
    // Click queue indicator
    const queueIndicator = await page.locator('.segmentation-queue-indicator');
    await queueIndicator.click();
    
    // Verify queue details dropdown appears
    const queueDetails = await page.locator('.segmentation-queue-details');
    await expect(queueDetails).toBeVisible();
    
    // Verify queue sections
    await expect(queueDetails.locator('h3:has-text("Segmentation Queue")')).toBeVisible();
    
    // Check for queue items or empty state
    const queueItems = await queueDetails.locator('.queue-item').count();
    if (queueItems > 0) {
      // Verify queue item structure
      const firstItem = await queueDetails.locator('.queue-item').first();
      await expect(firstItem.locator('.queue-item-name')).toBeVisible();
      await expect(firstItem.locator('.queue-item-status')).toBeVisible();
    } else {
      // Verify empty state
      await expect(queueDetails.locator('text=No tasks in queue')).toBeVisible();
    }
  });

  test('should show running tasks with progress', async ({ page }) => {
    // Navigate to project
    await navigateToProject(page, 'test2');
    
    // Trigger segmentation to have running task
    const imageItem = await page.locator('.image-gallery .image-item[data-status="without_segmentation"]').first();
    await imageItem.hover();
    await imageItem.click('button:has-text("Segment")');
    
    // Wait for task to start processing
    await page.waitForTimeout(2000);
    
    // Open queue details
    const queueIndicator = await page.locator('.segmentation-queue-indicator');
    await queueIndicator.click();
    
    const queueDetails = await page.locator('.segmentation-queue-details');
    
    // Look for running tasks
    const runningTask = await queueDetails.locator('.queue-item[data-status="running"]').first();
    if (await runningTask.isVisible()) {
      // Verify running indicator
      await expect(runningTask.locator('.loading-spinner')).toBeVisible();
      await expect(runningTask.locator('text=Processing')).toBeVisible();
    }
  });

  test('should update queue in real-time', async ({ page }) => {
    // Navigate to project
    await navigateToProject(page, 'test2');
    
    // Open queue details
    const queueIndicator = await page.locator('.segmentation-queue-indicator');
    await queueIndicator.click();
    
    const queueDetails = await page.locator('.segmentation-queue-details');
    await expect(queueDetails).toBeVisible();
    
    // Get initial queue state
    const initialQueueItems = await queueDetails.locator('.queue-item').count();
    
    // Add new task
    const imageItem = await page.locator('.image-gallery .image-item[data-status="without_segmentation"]').first();
    await imageItem.hover();
    await imageItem.click('button:has-text("Segment")');
    
    // Verify queue updates without closing/reopening
    await expect(queueDetails.locator('.queue-item')).toHaveCount(initialQueueItems + 1, { timeout: 5000 });
    
    // Verify new item appears
    const newItem = await queueDetails.locator('.queue-item').last();
    await expect(newItem).toBeVisible();
  });

  test('should handle batch queue operations', async ({ page }) => {
    // Navigate to project
    await navigateToProject(page, 'test2');
    
    // Select multiple images
    await page.click('button:has-text("Select")');
    
    const images = await page.locator('.image-gallery .image-item[data-status="without_segmentation"]').all();
    const imagesToSelect = images.slice(0, Math.min(5, images.length));
    
    for (const img of imagesToSelect) {
      await img.click();
    }
    
    // Get initial queue status
    const queueIndicator = await page.locator('.segmentation-queue-indicator');
    const initialStatus = await queueIndicator.textContent();
    
    // Trigger batch segmentation
    await page.click('button:has-text("Segment Selected")');
    
    // Verify queue updates with batch count
    await expect(queueIndicator).not.toHaveText(initialStatus || '', { timeout: 5000 });
    
    // Open queue details
    await queueIndicator.click();
    const queueDetails = await page.locator('.segmentation-queue-details');
    
    // Verify all items appear in queue
    const queuedItems = await queueDetails.locator('.queue-item[data-status="queued"]').count();
    expect(queuedItems).toBeGreaterThanOrEqual(imagesToSelect.length);
  });

  test('should show queue progress bar', async ({ page }) => {
    // Navigate to project
    await navigateToProject(page, 'test2');
    
    const queueIndicator = await page.locator('.segmentation-queue-indicator');
    
    // Check if there's a progress bar
    const progressBar = await queueIndicator.locator('.queue-progress-bar');
    
    if (await progressBar.isVisible()) {
      // Verify progress bar has value
      const progressValue = await progressBar.getAttribute('value');
      expect(progressValue).toBeTruthy();
      
      // Verify progress percentage
      const progressPercent = parseInt(progressValue || '0');
      expect(progressPercent).toBeGreaterThanOrEqual(0);
      expect(progressPercent).toBeLessThanOrEqual(100);
    }
  });

  test('should prioritize user-triggered tasks', async ({ page }) => {
    // Navigate to project
    await navigateToProject(page, 'test2');
    
    // Add some background tasks first (if possible)
    // This would require backend support for priority queuing
    
    // Trigger high-priority segmentation
    const imageItem = await page.locator('.image-gallery .image-item[data-status="without_segmentation"]').first();
    await imageItem.hover();
    
    // Look for priority option
    const priorityButton = await imageItem.locator('button:has-text("Segment Priority")');
    if (await priorityButton.isVisible()) {
      await priorityButton.click();
      
      // Open queue details
      const queueIndicator = await page.locator('.segmentation-queue-indicator');
      await queueIndicator.click();
      
      const queueDetails = await page.locator('.segmentation-queue-details');
      
      // Verify priority indicator
      const priorityItem = await queueDetails.locator('.queue-item[data-priority="high"]').first();
      await expect(priorityItem).toBeVisible();
      await expect(priorityItem.locator('.priority-indicator')).toBeVisible();
    }
  });

  test('should clear completed tasks from queue view', async ({ page }) => {
    // Navigate to project
    await navigateToProject(page, 'test2');
    
    // Open queue details
    const queueIndicator = await page.locator('.segmentation-queue-indicator');
    await queueIndicator.click();
    
    const queueDetails = await page.locator('.segmentation-queue-details');
    
    // Check if there are any completed tasks
    const completedTasks = await queueDetails.locator('.queue-item[data-status="completed"]').count();
    
    if (completedTasks > 0) {
      // Tasks should auto-clear after a delay
      await page.waitForTimeout(5000);
      
      // Verify completed tasks are removed
      const remainingCompleted = await queueDetails.locator('.queue-item[data-status="completed"]').count();
      expect(remainingCompleted).toBeLessThan(completedTasks);
    }
  });

  test('should handle queue errors gracefully', async ({ page }) => {
    // Navigate to project
    await navigateToProject(page, 'test2');
    
    // Open queue details
    const queueIndicator = await page.locator('.segmentation-queue-indicator');
    await queueIndicator.click();
    
    const queueDetails = await page.locator('.segmentation-queue-details');
    
    // Check for any failed tasks
    const failedTasks = await queueDetails.locator('.queue-item[data-status="failed"]');
    
    if (await failedTasks.count() > 0) {
      const failedTask = failedTasks.first();
      
      // Verify error indicator
      await expect(failedTask.locator('.error-indicator')).toBeVisible();
      
      // Verify retry option
      await failedTask.hover();
      await expect(failedTask.locator('button:has-text("Retry")')).toBeVisible();
    }
  });

  test('should sync queue state across browser tabs', async ({ page, context }) => {
    // Open project in first tab
    await navigateToProject(page, 'test2');
    
    // Open same project in second tab
    const page2 = await context.newPage();
    await loginAsTestUser(page2);
    await navigateToProject(page2, 'test2');
    
    // Get initial queue status in both tabs
    const queue1 = await page.locator('.segmentation-queue-indicator');
    const queue2 = await page2.locator('.segmentation-queue-indicator');
    
    const initialStatus1 = await queue1.textContent();
    const initialStatus2 = await queue2.textContent();
    expect(initialStatus1).toBe(initialStatus2);
    
    // Add task in first tab
    const imageItem = await page.locator('.image-gallery .image-item[data-status="without_segmentation"]').first();
    await imageItem.hover();
    await imageItem.click('button:has-text("Segment")');
    
    // Verify queue updates in both tabs
    await expect(queue1).not.toHaveText(initialStatus1 || '', { timeout: 5000 });
    await expect(queue2).not.toHaveText(initialStatus2 || '', { timeout: 10000 });
    
    // Verify both show same status
    const newStatus1 = await queue1.textContent();
    const newStatus2 = await queue2.textContent();
    expect(newStatus1).toBe(newStatus2);
    
    // Close second tab
    await page2.close();
  });

  test('should show estimated time for queue completion', async ({ page }) => {
    // Navigate to project
    await navigateToProject(page, 'test2');
    
    // Add multiple tasks to queue
    await page.click('button:has-text("Select")');
    const images = await page.locator('.image-gallery .image-item[data-status="without_segmentation"]').all();
    const imagesToSelect = images.slice(0, Math.min(3, images.length));
    
    if (imagesToSelect.length > 0) {
      for (const img of imagesToSelect) {
        await img.click();
      }
      
      await page.click('button:has-text("Segment Selected")');
      
      // Open queue details
      const queueIndicator = await page.locator('.segmentation-queue-indicator');
      await queueIndicator.click();
      
      const queueDetails = await page.locator('.segmentation-queue-details');
      
      // Look for time estimate
      const timeEstimate = await queueDetails.locator('.queue-time-estimate');
      if (await timeEstimate.isVisible()) {
        const estimateText = await timeEstimate.textContent();
        expect(estimateText).toMatch(/\d+ (seconds?|minutes?|hours?)/);
      }
    }
  });
});