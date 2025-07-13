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

test.describe('Image Upload Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('should upload a single image successfully', async ({ page }) => {
    // Navigate to a project
    await navigateToProject(page, 'test2');
    
    // Click upload button
    await page.click('button:has-text("Upload Images")');
    
    // Wait for file input to be ready
    const fileInput = await page.locator('input[type="file"]');
    
    // Upload a test image
    const testImagePath = path.join(__dirname, '../fixtures/test-image.png');
    await fileInput.setInputFiles(testImagePath);
    
    // Wait for upload to complete
    await page.waitForSelector('text=Upload complete', { timeout: 30000 });
    
    // Verify image appears in gallery
    await expect(page.locator('.image-gallery img').last()).toBeVisible();
    
    // Verify the uploaded image has the correct status
    const lastImageStatus = await page.locator('.image-gallery .image-item').last().getAttribute('data-status');
    expect(lastImageStatus).toBe('without_segmentation');
  });

  test('should upload multiple images successfully', async ({ page }) => {
    // Navigate to a project
    await navigateToProject(page, 'test2');
    
    // Get initial image count
    const initialImageCount = await page.locator('.image-gallery .image-item').count();
    
    // Click upload button
    await page.click('button:has-text("Upload Images")');
    
    // Upload multiple test images
    const fileInput = await page.locator('input[type="file"]');
    const testImages = [
      path.join(__dirname, '../fixtures/test-image-1.png'),
      path.join(__dirname, '../fixtures/test-image-2.png'),
      path.join(__dirname, '../fixtures/test-image-3.png')
    ];
    await fileInput.setInputFiles(testImages);
    
    // Wait for all uploads to complete
    await page.waitForSelector('text=3 files uploaded successfully', { timeout: 30000 });
    
    // Verify all images appear in gallery
    const newImageCount = await page.locator('.image-gallery .image-item').count();
    expect(newImageCount).toBe(initialImageCount + 3);
  });

  test('should show upload progress', async ({ page }) => {
    // Navigate to a project
    await navigateToProject(page, 'test2');
    
    // Click upload button
    await page.click('button:has-text("Upload Images")');
    
    // Upload a large test image to see progress
    const fileInput = await page.locator('input[type="file"]');
    const testImagePath = path.join(__dirname, '../fixtures/large-test-image.png');
    await fileInput.setInputFiles(testImagePath);
    
    // Verify progress bar appears
    await expect(page.locator('.upload-progress')).toBeVisible();
    await expect(page.locator('.upload-progress .progress-bar')).toBeVisible();
    
    // Wait for upload to complete
    await page.waitForSelector('text=Upload complete', { timeout: 30000 });
    
    // Verify progress bar disappears
    await expect(page.locator('.upload-progress')).not.toBeVisible();
  });

  test('should handle upload errors gracefully', async ({ page }) => {
    // Navigate to a project
    await navigateToProject(page, 'test2');
    
    // Click upload button
    await page.click('button:has-text("Upload Images")');
    
    // Try to upload an invalid file type
    const fileInput = await page.locator('input[type="file"]');
    const invalidFilePath = path.join(__dirname, '../fixtures/invalid-file.txt');
    await fileInput.setInputFiles(invalidFilePath);
    
    // Verify error message appears
    await expect(page.locator('text=Only image files are allowed')).toBeVisible();
  });

  test('should update image gallery immediately after upload', async ({ page }) => {
    // Navigate to a project
    await navigateToProject(page, 'test2');
    
    // Get initial gallery state
    const initialImages = await page.locator('.image-gallery .image-item').all();
    const initialImageNames = await Promise.all(
      initialImages.map(img => img.getAttribute('data-name'))
    );
    
    // Upload new image
    await page.click('button:has-text("Upload Images")');
    const fileInput = await page.locator('input[type="file"]');
    const testImagePath = path.join(__dirname, '../fixtures/unique-test-image.png');
    await fileInput.setInputFiles(testImagePath);
    
    // Wait for upload to complete
    await page.waitForSelector('text=Upload complete', { timeout: 30000 });
    
    // Verify gallery updated without page refresh
    const newImages = await page.locator('.image-gallery .image-item').all();
    const newImageNames = await Promise.all(
      newImages.map(img => img.getAttribute('data-name'))
    );
    
    // Should have one more image
    expect(newImages.length).toBe(initialImages.length + 1);
    
    // New image should be in the list
    const addedImageName = newImageNames.find(name => !initialImageNames.includes(name));
    expect(addedImageName).toBeTruthy();
    expect(addedImageName).toContain('unique-test-image');
  });

  test('should show thumbnail immediately after upload', async ({ page }) => {
    // Navigate to a project
    await navigateToProject(page, 'test2');
    
    // Upload image
    await page.click('button:has-text("Upload Images")');
    const fileInput = await page.locator('input[type="file"]');
    const testImagePath = path.join(__dirname, '../fixtures/test-thumbnail.png');
    await fileInput.setInputFiles(testImagePath);
    
    // Wait for upload
    await page.waitForSelector('text=Upload complete', { timeout: 30000 });
    
    // Find the newly uploaded image
    const newImage = await page.locator('.image-gallery .image-item').last();
    
    // Verify thumbnail is loaded
    const thumbnail = await newImage.locator('img');
    await expect(thumbnail).toBeVisible();
    
    // Verify thumbnail has valid src
    const thumbnailSrc = await thumbnail.getAttribute('src');
    expect(thumbnailSrc).toBeTruthy();
    expect(thumbnailSrc).toMatch(/\.(png|jpg|jpeg|webp)/i);
  });

  test('should allow drag and drop upload', async ({ page }) => {
    // Navigate to a project
    await navigateToProject(page, 'test2');
    
    // Click upload button to open upload area
    await page.click('button:has-text("Upload Images")');
    
    // Get the drop zone
    const dropZone = await page.locator('.upload-drop-zone');
    await expect(dropZone).toBeVisible();
    
    // Create a DataTransfer to simulate file drop
    const testImagePath = path.join(__dirname, '../fixtures/drag-drop-test.png');
    
    // Simulate drag over
    await dropZone.dispatchEvent('dragover', {
      dataTransfer: { types: ['Files'] }
    });
    
    // Verify drop zone shows active state
    await expect(dropZone).toHaveClass(/drag-active/);
    
    // Note: Full drag-drop simulation requires browser APIs not available in Playwright
    // This test verifies the UI responds to drag events
  });

  test('should cancel upload in progress', async ({ page }) => {
    // Navigate to a project
    await navigateToProject(page, 'test2');
    
    // Start upload
    await page.click('button:has-text("Upload Images")');
    const fileInput = await page.locator('input[type="file"]');
    const testImagePath = path.join(__dirname, '../fixtures/large-test-image.png');
    await fileInput.setInputFiles(testImagePath);
    
    // Wait for upload to start
    await expect(page.locator('.upload-progress')).toBeVisible();
    
    // Click cancel button
    await page.click('button:has-text("Cancel")');
    
    // Verify upload was cancelled
    await expect(page.locator('text=Upload cancelled')).toBeVisible();
    await expect(page.locator('.upload-progress')).not.toBeVisible();
  });

  test('should validate file size limits', async ({ page }) => {
    // Navigate to a project
    await navigateToProject(page, 'test2');
    
    // Try to upload a file that's too large
    await page.click('button:has-text("Upload Images")');
    const fileInput = await page.locator('input[type="file"]');
    
    // Create a mock large file (this would need actual implementation)
    // For now, we'll verify the UI shows size limits
    await expect(page.locator('text=/Maximum file size.*MB/')).toBeVisible();
  });

  test('should maintain upload queue for multiple files', async ({ page }) => {
    // Navigate to a project
    await navigateToProject(page, 'test2');
    
    // Upload multiple files
    await page.click('button:has-text("Upload Images")');
    const fileInput = await page.locator('input[type="file"]');
    const testImages = [
      path.join(__dirname, '../fixtures/queue-test-1.png'),
      path.join(__dirname, '../fixtures/queue-test-2.png'),
      path.join(__dirname, '../fixtures/queue-test-3.png'),
      path.join(__dirname, '../fixtures/queue-test-4.png'),
      path.join(__dirname, '../fixtures/queue-test-5.png')
    ];
    await fileInput.setInputFiles(testImages);
    
    // Verify upload queue shows all files
    await expect(page.locator('.upload-queue-item')).toHaveCount(5);
    
    // Verify files are processed in order
    const firstItem = await page.locator('.upload-queue-item').first();
    await expect(firstItem).toHaveClass(/uploading/);
    
    // Wait for all uploads
    await page.waitForSelector('text=5 files uploaded successfully', { timeout: 60000 });
  });
});