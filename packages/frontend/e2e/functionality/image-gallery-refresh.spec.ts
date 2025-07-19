import { test, expect, type Page } from '@playwright/test';
import path from 'path';

// Test user credentials
const TEST_USER = {
  email: 'testuser@test.com',
  password: 'testuser123'
};

// Helper to login
async function loginAsTestUser(page: Page) {
  await page.goto('/signin');
  await page.fill('input[type="email"]', TEST_USER.email);
  await page.fill('input[type="password"]', TEST_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard');
}

// Helper to navigate to a project
async function navigateToProject(page: Page, projectName: string) {
  await page.goto('/dashboard');
  await page.waitForSelector('text=' + projectName);
  await page.click(`text=${projectName}`);
  await page.waitForSelector('h1:has-text("' + projectName + '")');
}

test.describe('Image Gallery Refresh After Upload', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('should immediately show uploaded image in gallery', async ({ page }) => {
    // Navigate to project
    await navigateToProject(page, 'test2');
    
    // Get initial gallery state
    const galleryContainer = await page.locator('.image-gallery');
    const initialImageCount = await galleryContainer.locator('.image-item').count();
    
    // Take screenshot of initial state
    const initialGalleryState = await galleryContainer.screenshot();
    
    // Upload new image
    await page.click('button:has-text("Upload Images")');
    const fileInput = await page.locator('input[type="file"]');
    const testImagePath = path.join(__dirname, '../fixtures/gallery-test-1.png');
    await fileInput.setInputFiles(testImagePath);
    
    // Wait for upload completion
    await page.waitForSelector('text=Upload complete', { timeout: 30000 });
    
    // Verify gallery updated without page refresh
    const newImageCount = await galleryContainer.locator('.image-item').count();
    expect(newImageCount).toBe(initialImageCount + 1);
    
    // Verify the new image is visible
    const newImage = await galleryContainer.locator('.image-item').last();
    await expect(newImage).toBeVisible();
    
    // Verify gallery visually changed
    const newGalleryState = await galleryContainer.screenshot();
    expect(Buffer.compare(initialGalleryState, newGalleryState)).not.toBe(0);
  });

  test('should maintain gallery sort order after upload', async ({ page }) => {
    // Navigate to project
    await navigateToProject(page, 'test2');
    
    // Check current sort order
    const sortSelector = await page.locator('.gallery-sort-selector');
    const currentSort = await sortSelector.inputValue();
    
    // Get first few image names before upload
    const imageItems = await page.locator('.image-gallery .image-item').all();
    const initialOrder = await Promise.all(
      imageItems.slice(0, 3).map(item => item.getAttribute('data-name'))
    );
    
    // Upload new image
    await page.click('button:has-text("Upload Images")');
    const fileInput = await page.locator('input[type="file"]');
    const testImagePath = path.join(__dirname, '../fixtures/gallery-test-2.png');
    await fileInput.setInputFiles(testImagePath);
    
    await page.waitForSelector('text=Upload complete', { timeout: 30000 });
    
    // Verify sort order is maintained
    const newSortValue = await sortSelector.inputValue();
    expect(newSortValue).toBe(currentSort);
    
    // If sorted by date (newest first), new image should be first
    if (currentSort === 'date-desc') {
      const firstImage = await page.locator('.image-gallery .image-item').first();
      const firstName = await firstImage.getAttribute('data-name');
      expect(firstName).toContain('gallery-test-2');
    }
  });

  test('should update gallery pagination after upload', async ({ page }) => {
    // Navigate to project
    await navigateToProject(page, 'test2');
    
    // Check if pagination exists
    const pagination = await page.locator('.gallery-pagination');
    if (await pagination.isVisible()) {
      // Get current page info
      const pageInfo = await pagination.locator('.page-info').textContent();
      const totalMatch = pageInfo?.match(/of (\d+)/);
      const initialTotal = totalMatch ? parseInt(totalMatch[1]) : 0;
      
      // Upload new image
      await page.click('button:has-text("Upload Images")');
      const fileInput = await page.locator('input[type="file"]');
      const testImagePath = path.join(__dirname, '../fixtures/gallery-test-3.png');
      await fileInput.setInputFiles(testImagePath);
      
      await page.waitForSelector('text=Upload complete', { timeout: 30000 });
      
      // Verify total count increased
      const newPageInfo = await pagination.locator('.page-info').textContent();
      const newTotalMatch = newPageInfo?.match(/of (\d+)/);
      const newTotal = newTotalMatch ? parseInt(newTotalMatch[1]) : 0;
      
      expect(newTotal).toBe(initialTotal + 1);
    }
  });

  test('should preserve gallery filters after upload', async ({ page }) => {
    // Navigate to project
    await navigateToProject(page, 'test2');
    
    // Apply a filter (e.g., show only completed)
    const filterButton = await page.locator('button:has-text("Filter")');
    if (await filterButton.isVisible()) {
      await filterButton.click();
      await page.click('label:has-text("Completed")');
      await page.click('button:has-text("Apply")');
      
      // Get filtered count
      const filteredCount = await page.locator('.image-gallery .image-item').count();
      
      // Upload new image
      await page.click('button:has-text("Upload Images")');
      const fileInput = await page.locator('input[type="file"]');
      const testImagePath = path.join(__dirname, '../fixtures/gallery-test-4.png');
      await fileInput.setInputFiles(testImagePath);
      
      await page.waitForSelector('text=Upload complete', { timeout: 30000 });
      
      // Verify filter is still active
      const filterIndicator = await page.locator('.active-filters');
      await expect(filterIndicator).toBeVisible();
      
      // New image shouldn't appear in filtered view (as it's not completed)
      const newFilteredCount = await page.locator('.image-gallery .image-item').count();
      expect(newFilteredCount).toBe(filteredCount);
    }
  });

  test('should update gallery in grid view', async ({ page }) => {
    // Navigate to project
    await navigateToProject(page, 'test2');
    
    // Switch to grid view if not already
    const gridViewButton = await page.locator('button[aria-label="Grid view"]');
    if (await gridViewButton.isVisible()) {
      await gridViewButton.click();
    }
    
    // Verify grid layout
    const gallery = await page.locator('.image-gallery');
    await expect(gallery).toHaveClass(/grid-view/);
    
    // Count grid items
    const initialGridItems = await gallery.locator('.grid-item').count();
    
    // Upload image
    await page.click('button:has-text("Upload Images")');
    const fileInput = await page.locator('input[type="file"]');
    const testImagePath = path.join(__dirname, '../fixtures/gallery-test-5.png');
    await fileInput.setInputFiles(testImagePath);
    
    await page.waitForSelector('text=Upload complete', { timeout: 30000 });
    
    // Verify grid updated
    const newGridItems = await gallery.locator('.grid-item').count();
    expect(newGridItems).toBe(initialGridItems + 1);
  });

  test('should update gallery in list view', async ({ page }) => {
    // Navigate to project
    await navigateToProject(page, 'test2');
    
    // Switch to list view
    const listViewButton = await page.locator('button[aria-label="List view"]');
    if (await listViewButton.isVisible()) {
      await listViewButton.click();
    }
    
    // Verify list layout
    const gallery = await page.locator('.image-gallery');
    await expect(gallery).toHaveClass(/list-view/);
    
    // Count list items
    const initialListItems = await gallery.locator('.list-item').count();
    
    // Upload image
    await page.click('button:has-text("Upload Images")');
    const fileInput = await page.locator('input[type="file"]');
    const testImagePath = path.join(__dirname, '../fixtures/gallery-test-6.png');
    await fileInput.setInputFiles(testImagePath);
    
    await page.waitForSelector('text=Upload complete', { timeout: 30000 });
    
    // Verify list updated
    const newListItems = await gallery.locator('.list-item').count();
    expect(newListItems).toBe(initialListItems + 1);
  });

  test('should handle rapid consecutive uploads', async ({ page }) => {
    // Navigate to project
    await navigateToProject(page, 'test2');
    
    const gallery = await page.locator('.image-gallery');
    const initialCount = await gallery.locator('.image-item').count();
    
    // Upload multiple images rapidly
    const uploads = [];
    for (let i = 1; i <= 3; i++) {
      const uploadPromise = (async () => {
        await page.click('button:has-text("Upload Images")');
        const fileInput = await page.locator('input[type="file"]');
        const testImagePath = path.join(__dirname, `../fixtures/rapid-test-${i}.png`);
        await fileInput.setInputFiles(testImagePath);
      })();
      uploads.push(uploadPromise);
    }
    
    // Wait for all uploads to start
    await Promise.all(uploads);
    
    // Wait for all uploads to complete
    await page.waitForSelector('text=3 files uploaded', { timeout: 60000 });
    
    // Verify all images appear
    const finalCount = await gallery.locator('.image-item').count();
    expect(finalCount).toBe(initialCount + 3);
  });

  test('should update gallery across multiple browser tabs', async ({ page, context }) => {
    // Open project in first tab
    await navigateToProject(page, 'test2');
    
    // Open same project in second tab
    const page2 = await context.newPage();
    await loginAsTestUser(page2);
    await navigateToProject(page2, 'test2');
    
    // Get initial counts in both tabs
    const gallery1 = await page.locator('.image-gallery');
    const gallery2 = await page2.locator('.image-gallery');
    
    const initialCount1 = await gallery1.locator('.image-item').count();
    const initialCount2 = await gallery2.locator('.image-item').count();
    expect(initialCount1).toBe(initialCount2);
    
    // Upload image in first tab
    await page.click('button:has-text("Upload Images")');
    const fileInput = await page.locator('input[type="file"]');
    const testImagePath = path.join(__dirname, '../fixtures/cross-tab-test.png');
    await fileInput.setInputFiles(testImagePath);
    
    await page.waitForSelector('text=Upload complete', { timeout: 30000 });
    
    // Verify gallery updated in first tab
    const newCount1 = await gallery1.locator('.image-item').count();
    expect(newCount1).toBe(initialCount1 + 1);
    
    // Verify gallery updated in second tab (with a small delay for sync)
    await page2.waitForTimeout(2000);
    const newCount2 = await gallery2.locator('.image-item').count();
    expect(newCount2).toBe(initialCount2 + 1);
    
    // Close second tab
    await page2.close();
  });

  test('should show upload progress in gallery', async ({ page }) => {
    // Navigate to project
    await navigateToProject(page, 'test2');
    
    // Start upload
    await page.click('button:has-text("Upload Images")');
    const fileInput = await page.locator('input[type="file"]');
    const testImagePath = path.join(__dirname, '../fixtures/progress-test.png');
    await fileInput.setInputFiles(testImagePath);
    
    // Look for upload placeholder in gallery
    const uploadPlaceholder = await page.locator('.image-gallery .upload-placeholder');
    await expect(uploadPlaceholder).toBeVisible({ timeout: 5000 });
    
    // Verify it shows progress
    const progressIndicator = await uploadPlaceholder.locator('.upload-progress');
    await expect(progressIndicator).toBeVisible();
    
    // Wait for upload to complete
    await page.waitForSelector('text=Upload complete', { timeout: 30000 });
    
    // Verify placeholder is replaced with actual image
    await expect(uploadPlaceholder).not.toBeVisible();
    const newImage = await page.locator('.image-gallery .image-item').last();
    await expect(newImage).toBeVisible();
  });

  test('should handle gallery refresh errors gracefully', async ({ page }) => {
    // Navigate to project
    await navigateToProject(page, 'test2');
    
    // Simulate network issue
    await page.route('**/api/images/**', route => {
      if (route.request().method() === 'GET') {
        route.abort('failed');
      } else {
        route.continue();
      }
    });
    
    // Upload image
    await page.click('button:has-text("Upload Images")');
    const fileInput = await page.locator('input[type="file"]');
    const testImagePath = path.join(__dirname, '../fixtures/error-test.png');
    await fileInput.setInputFiles(testImagePath);
    
    // Upload should still work
    await page.waitForSelector('text=Upload complete', { timeout: 30000 });
    
    // Gallery might show error but shouldn't crash
    const errorMessage = await page.locator('.gallery-error-message');
    if (await errorMessage.isVisible()) {
      // Verify retry option
      await expect(page.locator('button:has-text("Retry")')).toBeVisible();
    }
    
    // Remove network simulation
    await page.unroute('**/api/images/**');
  });
});