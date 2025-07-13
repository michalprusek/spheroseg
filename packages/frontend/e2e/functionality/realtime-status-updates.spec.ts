import { test, expect } from '@playwright/test';
import path from 'path';

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

test.describe('Real-time Status Updates', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('should update image status from queued to processing', async ({ page }) => {
    // Navigate to project
    await navigateToProject(page, 'test2');
    
    // Find an image with status "without_segmentation"
    const imageItem = await page.locator('.image-gallery .image-item[data-status="without_segmentation"]').first();
    await expect(imageItem).toBeVisible();
    
    // Get image ID
    const imageId = await imageItem.getAttribute('data-id');
    expect(imageId).toBeTruthy();
    
    // Trigger segmentation
    await imageItem.hover();
    await imageItem.click('button:has-text("Segment")');
    
    // Verify status changes to queued immediately
    await expect(imageItem).toHaveAttribute('data-status', 'queued', { timeout: 5000 });
    
    // Verify visual indicator changes
    await expect(imageItem.locator('.status-indicator.queued')).toBeVisible();
    
    // Wait for status to change to processing (simulating ML service pickup)
    await expect(imageItem).toHaveAttribute('data-status', 'processing', { timeout: 30000 });
    
    // Verify processing animation appears
    await expect(imageItem.locator('.processing-spinner')).toBeVisible();
  });

  test('should show real-time progress during segmentation', async ({ page }) => {
    // Navigate to project
    await navigateToProject(page, 'test2');
    
    // Start segmentation on an image
    const imageItem = await page.locator('.image-gallery .image-item[data-status="without_segmentation"]').first();
    await imageItem.hover();
    await imageItem.click('button:has-text("Segment")');
    
    // Wait for processing to start
    await expect(imageItem).toHaveAttribute('data-status', 'processing', { timeout: 30000 });
    
    // Verify progress indicator appears
    const progressBar = await imageItem.locator('.segmentation-progress');
    await expect(progressBar).toBeVisible();
    
    // Verify progress updates (checking multiple times)
    let previousProgress = 0;
    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(2000);
      const currentProgress = await progressBar.getAttribute('data-progress');
      const progressValue = parseInt(currentProgress || '0');
      expect(progressValue).toBeGreaterThanOrEqual(previousProgress);
      previousProgress = progressValue;
    }
  });

  test('should update status to completed with results', async ({ page }) => {
    // Navigate to project
    await navigateToProject(page, 'test2');
    
    // Find an image in processing state or trigger segmentation
    let imageItem = await page.locator('.image-gallery .image-item[data-status="processing"]').first();
    
    if (!await imageItem.isVisible()) {
      // No processing images, trigger segmentation
      imageItem = await page.locator('.image-gallery .image-item[data-status="without_segmentation"]').first();
      await imageItem.hover();
      await imageItem.click('button:has-text("Segment")');
      await expect(imageItem).toHaveAttribute('data-status', 'processing', { timeout: 30000 });
    }
    
    // Wait for completion (this might take a while in real scenarios)
    await expect(imageItem).toHaveAttribute('data-status', 'completed', { timeout: 120000 });
    
    // Verify completion indicators
    await expect(imageItem.locator('.status-indicator.completed')).toBeVisible();
    await expect(imageItem.locator('.cell-count')).toBeVisible();
    
    // Verify cell count is displayed
    const cellCount = await imageItem.locator('.cell-count').textContent();
    expect(cellCount).toMatch(/\d+ cells?/);
  });

  test('should handle segmentation failure gracefully', async ({ page }) => {
    // This test would require backend setup to simulate failure
    // For now, we'll test the UI's ability to display failed status
    
    // Navigate to project
    await navigateToProject(page, 'test2');
    
    // Look for any failed segmentations
    const failedItem = await page.locator('.image-gallery .image-item[data-status="failed"]').first();
    
    if (await failedItem.isVisible()) {
      // Verify failed status indicators
      await expect(failedItem.locator('.status-indicator.failed')).toBeVisible();
      await expect(failedItem.locator('.error-message')).toBeVisible();
      
      // Verify retry button is available
      await failedItem.hover();
      await expect(failedItem.locator('button:has-text("Retry")')).toBeVisible();
    }
  });

  test('should update multiple images simultaneously', async ({ page }) => {
    // Navigate to project
    await navigateToProject(page, 'test2');
    
    // Select multiple images for batch segmentation
    const images = await page.locator('.image-gallery .image-item[data-status="without_segmentation"]').all();
    const imagesToProcess = images.slice(0, Math.min(3, images.length));
    
    if (imagesToProcess.length > 0) {
      // Enable selection mode
      await page.click('button:has-text("Select")');
      
      // Select images
      for (const img of imagesToProcess) {
        await img.click();
        await expect(img).toHaveClass(/selected/);
      }
      
      // Trigger batch segmentation
      await page.click('button:has-text("Segment Selected")');
      
      // Verify all selected images change to queued
      for (const img of imagesToProcess) {
        await expect(img).toHaveAttribute('data-status', 'queued', { timeout: 5000 });
      }
      
      // Verify queue counter updates
      const queueCounter = await page.locator('.segmentation-queue-count');
      const queueCount = await queueCounter.textContent();
      expect(parseInt(queueCount || '0')).toBeGreaterThanOrEqual(imagesToProcess.length);
    }
  });

  test('should reflect status updates across different views', async ({ page, context }) => {
    // Open project in first tab
    await navigateToProject(page, 'test2');
    
    // Open same project in second tab
    const page2 = await context.newPage();
    await loginAsTestUser(page2);
    await navigateToProject(page2, 'test2');
    
    // Trigger segmentation in first tab
    const imageItem = await page.locator('.image-gallery .image-item[data-status="without_segmentation"]').first();
    const imageId = await imageItem.getAttribute('data-id');
    await imageItem.hover();
    await imageItem.click('button:has-text("Segment")');
    
    // Verify status changes in first tab
    await expect(imageItem).toHaveAttribute('data-status', 'queued', { timeout: 5000 });
    
    // Verify same status change appears in second tab
    const imageItemPage2 = await page2.locator(`.image-gallery .image-item[data-id="${imageId}"]`);
    await expect(imageItemPage2).toHaveAttribute('data-status', 'queued', { timeout: 10000 });
    
    // Close second tab
    await page2.close();
  });

  test('should persist status updates after page refresh', async ({ page }) => {
    // Navigate to project
    await navigateToProject(page, 'test2');
    
    // Trigger segmentation
    const imageItem = await page.locator('.image-gallery .image-item[data-status="without_segmentation"]').first();
    const imageId = await imageItem.getAttribute('data-id');
    await imageItem.hover();
    await imageItem.click('button:has-text("Segment")');
    
    // Wait for status change
    await expect(imageItem).toHaveAttribute('data-status', 'queued', { timeout: 5000 });
    
    // Refresh page
    await page.reload();
    
    // Verify status persists after refresh
    const imageItemAfterRefresh = await page.locator(`.image-gallery .image-item[data-id="${imageId}"]`);
    await expect(imageItemAfterRefresh).toHaveAttribute('data-status', 'queued');
  });

  test('should show toast notifications for status changes', async ({ page }) => {
    // Navigate to project
    await navigateToProject(page, 'test2');
    
    // Trigger segmentation
    const imageItem = await page.locator('.image-gallery .image-item[data-status="without_segmentation"]').first();
    await imageItem.hover();
    await imageItem.click('button:has-text("Segment")');
    
    // Verify toast notification appears
    await expect(page.locator('.toast-notification:has-text("Segmentation queued")')).toBeVisible();
    
    // Wait for processing notification
    await expect(page.locator('.toast-notification:has-text("Segmentation started")')).toBeVisible({ timeout: 30000 });
  });

  test('should update project statistics in real-time', async ({ page }) => {
    // Navigate to project
    await navigateToProject(page, 'test2');
    
    // Get initial statistics
    const statsSection = await page.locator('.project-statistics');
    const initialCompleted = await statsSection.locator('.stat-completed').textContent();
    const initialQueued = await statsSection.locator('.stat-queued').textContent();
    
    // Trigger segmentation
    const imageItem = await page.locator('.image-gallery .image-item[data-status="without_segmentation"]').first();
    await imageItem.hover();
    await imageItem.click('button:has-text("Segment")');
    
    // Verify statistics update
    await expect(statsSection.locator('.stat-queued')).not.toHaveText(initialQueued || '', { timeout: 5000 });
    
    // The queued count should increase
    const newQueued = await statsSection.locator('.stat-queued').textContent();
    expect(parseInt(newQueued || '0')).toBeGreaterThan(parseInt(initialQueued || '0'));
  });

  test('should handle WebSocket disconnection gracefully', async ({ page }) => {
    // Navigate to project
    await navigateToProject(page, 'test2');
    
    // Simulate WebSocket disconnection by going offline
    await page.context().setOffline(true);
    
    // Verify offline indicator appears
    await expect(page.locator('.connection-status.offline')).toBeVisible({ timeout: 10000 });
    
    // Try to trigger segmentation while offline
    const imageItem = await page.locator('.image-gallery .image-item[data-status="without_segmentation"]').first();
    await imageItem.hover();
    await imageItem.click('button:has-text("Segment")');
    
    // Verify offline message
    await expect(page.locator('.toast-notification:has-text("offline")')).toBeVisible();
    
    // Go back online
    await page.context().setOffline(false);
    
    // Verify reconnection
    await expect(page.locator('.connection-status.online')).toBeVisible({ timeout: 10000 });
  });
});