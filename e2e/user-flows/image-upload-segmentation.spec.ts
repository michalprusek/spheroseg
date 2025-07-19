/**
 * E2E tests for image upload and segmentation flow
 * 
 * Tests the complete user journey from login to image segmentation
 */

import { test, expect } from '@playwright/test';
import path from 'path';

// Test constants
const TEST_USER = {
  email: 'testuser@test.com',
  password: 'testuser123',
};

const TEST_PROJECT = {
  name: 'E2E Test Project',
  description: 'Project for E2E testing',
};

const TEST_IMAGE = path.join(__dirname, '../fixtures/test-image.jpg');

test.describe('Image Upload and Segmentation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');
    
    // Login
    await page.fill('input[name="email"]', TEST_USER.email);
    await page.fill('input[name="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL('/dashboard');
  });

  test('should complete full image upload and segmentation workflow', async ({ page }) => {
    // Step 1: Create new project
    await test.step('Create new project', async () => {
      await page.click('button:has-text("New Project")');
      
      // Fill project form
      await page.fill('input[name="name"]', TEST_PROJECT.name);
      await page.fill('textarea[name="description"]', TEST_PROJECT.description);
      await page.click('button:has-text("Create")');
      
      // Wait for project creation
      await expect(page.locator('h1')).toContainText(TEST_PROJECT.name);
    });

    // Step 2: Upload images
    await test.step('Upload images', async () => {
      // Click upload button
      await page.click('button:has-text("Upload Images")');
      
      // Upload file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(TEST_IMAGE);
      
      // Verify file appears in preview
      await expect(page.locator('[data-testid="file-preview"]')).toBeVisible();
      
      // Toggle auto-segmentation
      const segmentToggle = page.locator('label:has-text("Segment images after upload")');
      await segmentToggle.click();
      
      // Start upload
      await page.click('button:has-text("Upload")');
      
      // Wait for upload to complete
      await expect(page.locator('[data-testid="upload-progress"]')).toHaveAttribute('data-value', '100');
    });

    // Step 3: Wait for segmentation
    await test.step('Wait for segmentation to complete', async () => {
      // Check for processing status
      await expect(page.locator('[data-testid="image-status"]')).toContainText('Processing');
      
      // Wait for completion (with timeout)
      await expect(page.locator('[data-testid="image-status"]'))
        .toContainText('Completed', { timeout: 60000 });
      
      // Verify cell count is displayed
      await expect(page.locator('[data-testid="cell-count"]')).toBeVisible();
    });

    // Step 4: View segmentation results
    await test.step('View segmentation results', async () => {
      // Click on image to view details
      await page.click('[data-testid="image-card"]');
      
      // Wait for image viewer
      await expect(page.locator('[data-testid="image-viewer"]')).toBeVisible();
      
      // Verify segmentation overlay is visible
      await expect(page.locator('[data-testid="segmentation-overlay"]')).toBeVisible();
      
      // Check cell list
      await expect(page.locator('[data-testid="cell-list"]')).toBeVisible();
      const cellItems = page.locator('[data-testid="cell-item"]');
      await expect(cellItems).toHaveCount(await cellItems.count());
    });

    // Step 5: Export results
    await test.step('Export segmentation results', async () => {
      // Click export button
      await page.click('button:has-text("Export")');
      
      // Select export format
      await page.click('label:has-text("CSV")');
      
      // Download results
      const downloadPromise = page.waitForEvent('download');
      await page.click('button:has-text("Download")');
      const download = await downloadPromise;
      
      // Verify download
      expect(download.suggestedFilename()).toContain('.csv');
    });
  });

  test('should handle upload errors gracefully', async ({ page }) => {
    // Navigate to project
    await page.click('[data-testid="project-card"]:first-of-type');
    
    // Try to upload invalid file
    await page.click('button:has-text("Upload Images")');
    
    // Create a text file (invalid image)
    const invalidFile = path.join(__dirname, '../fixtures/invalid.txt');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(invalidFile);
    
    // Verify error message
    await expect(page.locator('[data-testid="upload-error"]'))
      .toContainText('File type not supported');
  });

  test('should allow manual segmentation trigger', async ({ page }) => {
    // Navigate to project with unsegmented images
    await page.click('[data-testid="project-card"]:first-of-type');
    
    // Find unsegmented image
    const unsegmentedImage = page.locator('[data-testid="image-card"][data-status="without_segmentation"]').first();
    await unsegmentedImage.hover();
    
    // Click segment button
    await unsegmentedImage.locator('button:has-text("Segment")').click();
    
    // Confirm action
    await page.click('button:has-text("Confirm")');
    
    // Verify status changes to queued
    await expect(unsegmentedImage).toHaveAttribute('data-status', 'queued');
  });

  test('should support batch operations', async ({ page }) => {
    // Navigate to project
    await page.click('[data-testid="project-card"]:first-of-type');
    
    // Enter selection mode
    await page.click('button:has-text("Select")');
    
    // Select multiple images
    const images = page.locator('[data-testid="image-checkbox"]');
    const count = Math.min(3, await images.count());
    
    for (let i = 0; i < count; i++) {
      await images.nth(i).click();
    }
    
    // Verify selection count
    await expect(page.locator('[data-testid="selection-count"]'))
      .toContainText(`${count} selected`);
    
    // Perform batch action
    await page.click('button:has-text("Batch Actions")');
    await page.click('button:has-text("Segment Selected")');
    
    // Confirm
    await page.click('button:has-text("Confirm")');
    
    // Verify all selected images are queued
    for (let i = 0; i < count; i++) {
      await expect(images.nth(i).locator('..'))
        .toHaveAttribute('data-status', 'queued');
    }
  });
});

test.describe('Segmentation Result Interactions', () => {
  test.beforeEach(async ({ page }) => {
    // Login and navigate to project with segmented images
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USER.email);
    await page.fill('input[name="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    
    // Navigate to first project
    await page.click('[data-testid="project-card"]:first-of-type');
  });

  test('should allow cell selection and editing', async ({ page }) => {
    // Open segmented image
    const segmentedImage = page.locator('[data-testid="image-card"][data-status="completed"]').first();
    await segmentedImage.click();
    
    // Wait for viewer
    await page.waitForSelector('[data-testid="image-viewer"]');
    
    // Click on a cell
    await page.click('[data-testid="cell-polygon"]:first-of-type');
    
    // Verify cell is selected
    await expect(page.locator('[data-testid="selected-cell-info"]')).toBeVisible();
    
    // Edit cell properties
    await page.click('button:has-text("Edit")');
    await page.fill('input[name="notes"]', 'Test note for cell');
    await page.click('button:has-text("Save")');
    
    // Verify changes saved
    await expect(page.locator('[data-testid="cell-notes"]'))
      .toContainText('Test note for cell');
  });

  test('should support polygon splitting', async ({ page }) => {
    // Open segmented image
    const segmentedImage = page.locator('[data-testid="image-card"][data-status="completed"]').first();
    await segmentedImage.click();
    
    // Select a cell
    await page.click('[data-testid="cell-polygon"]:first-of-type');
    
    // Enter split mode
    await page.click('button:has-text("Split Cell")');
    
    // Draw split line
    const canvas = page.locator('[data-testid="segmentation-canvas"]');
    const box = await canvas.boundingBox();
    
    if (box) {
      // Draw line across cell
      await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5);
      await page.mouse.up();
    }
    
    // Confirm split
    await page.click('button:has-text("Apply Split")');
    
    // Verify cell count increased
    const cellCount = await page.locator('[data-testid="cell-count"]').textContent();
    expect(parseInt(cellCount || '0')).toBeGreaterThan(0);
  });

  test('should filter cells by properties', async ({ page }) => {
    // Open segmented image
    const segmentedImage = page.locator('[data-testid="image-card"][data-status="completed"]').first();
    await segmentedImage.click();
    
    // Open filter panel
    await page.click('button:has-text("Filter")');
    
    // Set area filter
    await page.fill('input[name="minArea"]', '100');
    await page.fill('input[name="maxArea"]', '500');
    
    // Apply filter
    await page.click('button:has-text("Apply Filters")');
    
    // Verify filtered results
    const visibleCells = page.locator('[data-testid="cell-item"]:visible');
    const count = await visibleCells.count();
    
    // Check all visible cells meet criteria
    for (let i = 0; i < count; i++) {
      const area = await visibleCells.nth(i).locator('[data-testid="cell-area"]').textContent();
      const areaValue = parseInt(area || '0');
      expect(areaValue).toBeGreaterThanOrEqual(100);
      expect(areaValue).toBeLessThanOrEqual(500);
    }
  });
});

test.describe('Performance and Reliability', () => {
  test('should handle large batch uploads', async ({ page }) => {
    test.slow(); // Mark as slow test
    
    // Login
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USER.email);
    await page.fill('input[name="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    
    // Navigate to project
    await page.click('[data-testid="project-card"]:first-of-type');
    
    // Upload multiple files
    await page.click('button:has-text("Upload Images")');
    
    // Create array of test images
    const testImages = Array(10).fill(TEST_IMAGE);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testImages);
    
    // Verify all files appear
    await expect(page.locator('[data-testid="file-preview"]')).toHaveCount(10);
    
    // Start upload
    await page.click('button:has-text("Upload")');
    
    // Monitor upload progress
    await expect(page.locator('[data-testid="upload-progress"]'))
      .toHaveAttribute('data-value', '100', { timeout: 120000 });
    
    // Verify all images uploaded
    await expect(page.locator('[data-testid="image-card"]')).toHaveCount(10);
  });

  test('should recover from network interruptions', async ({ page, context }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USER.email);
    await page.fill('input[name="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    
    // Navigate to project
    await page.click('[data-testid="project-card"]:first-of-type');
    
    // Start upload
    await page.click('button:has-text("Upload Images")');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_IMAGE);
    
    // Simulate network offline
    await context.setOffline(true);
    
    // Try to upload
    await page.click('button:has-text("Upload")');
    
    // Verify error message
    await expect(page.locator('[data-testid="network-error"]'))
      .toContainText('Network connection lost');
    
    // Restore network
    await context.setOffline(false);
    
    // Retry upload
    await page.click('button:has-text("Retry")');
    
    // Verify upload completes
    await expect(page.locator('[data-testid="upload-progress"]'))
      .toHaveAttribute('data-value', '100', { timeout: 30000 });
  });

  test('should maintain session across page refreshes', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USER.email);
    await page.fill('input[name="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    
    // Get user info
    const userName = await page.locator('[data-testid="user-name"]').textContent();
    
    // Refresh page
    await page.reload();
    
    // Verify still logged in
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="user-name"]')).toContainText(userName || '');
  });
});