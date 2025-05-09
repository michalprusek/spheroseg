import { test } from './setupVisualRegression';
import { expect } from '@playwright/test';

test.describe('Segmentation Editor Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set viewport size to consistent dimensions
    await page.setViewportSize({ width: 1280, height: 800 });
    
    // Mock API responses
    await page.route('**/api/auth/current-user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'test-user-id',
            name: 'Test User',
            email: 'test@example.com',
            role: 'user'
          }
        })
      });
    });
    
    // Mock project data
    await page.route('**/api/projects/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-project-id',
          name: 'Test Project',
          description: 'A test project',
          status: 'active',
          createdAt: '2023-06-01T10:00:00Z',
          updatedAt: '2023-06-01T10:00:00Z'
        })
      });
    });
    
    // Mock image data
    await page.route('**/api/projects/*/images/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-image-id',
          projectId: 'test-project-id',
          filename: 'test-image.jpg',
          originalFilename: 'test-image.jpg',
          width: 800,
          height: 600,
          url: 'https://via.placeholder.com/800x600',
          thumbnailUrl: 'https://via.placeholder.com/200x150',
          status: 'processed',
          createdAt: '2023-06-01T10:00:00Z',
          updatedAt: '2023-06-01T10:00:00Z'
        })
      });
    });
    
    // Mock segmentation data
    await page.route('**/api/segmentation/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          imageId: 'test-image-id',
          polygons: [
            {
              points: [
                { x: 100, y: 100 },
                { x: 200, y: 100 },
                { x: 200, y: 200 },
                { x: 100, y: 200 }
              ],
              closed: true,
              color: '#FF0000'
            },
            {
              points: [
                { x: 300, y: 300 },
                { x: 400, y: 300 },
                { x: 350, y: 400 }
              ],
              closed: true,
              color: '#00FF00'
            }
          ],
          version: 1,
          createdAt: '2023-06-01T10:00:00Z',
          updatedAt: '2023-06-01T10:00:00Z'
        })
      });
    });
    
    // Intercept image loading and replace with placeholder
    await page.route('**/*.jpg', async (route) => {
      const width = 800;
      const height = 600;
      const placeholderUrl = `https://via.placeholder.com/${width}x${height}`;
      await route.continue({ url: placeholderUrl });
    });
    
    // Navigate to segmentation editor
    await page.goto('/projects/test-project-id/images/test-image-id/edit');
    
    // Wait for the canvas to be fully rendered
    await page.waitForSelector('[data-testid="segmentation-canvas"]');
    await page.waitForTimeout(1000); // Extra time for canvas rendering
  });
  
  test('Segmentation editor layout matches snapshot', async ({ page }) => {
    await page.compareScreenshot('segmentation-editor-full');
  });
  
  test('Canvas area matches snapshot', async ({ page }) => {
    await page.compareElement('[data-testid="canvas-container"]', 'segmentation-canvas-area');
  });
  
  test('Toolbar matches snapshot', async ({ page }) => {
    await page.compareElement('[data-testid="toolbar"]', 'segmentation-toolbar');
  });
  
  test('Information panel matches snapshot', async ({ page }) => {
    await page.compareElement('[data-testid="info-panel"]', 'segmentation-info-panel');
  });
  
  test('Edit mode view matches snapshot', async ({ page }) => {
    // Click the Edit button
    await page.click('button:has-text("Edit")');
    await page.waitForTimeout(500); // Wait for UI update
    
    await page.compareScreenshot('segmentation-edit-mode');
  });
  
  test('Create mode view matches snapshot', async ({ page }) => {
    // Click the Create button
    await page.click('button:has-text("Create")');
    await page.waitForTimeout(500); // Wait for UI update
    
    await page.compareScreenshot('segmentation-create-mode');
  });
  
  test('Zoomed view matches snapshot', async ({ page }) => {
    // Click zoom in button twice
    await page.click('button:has-text("Zoom In")');
    await page.click('button:has-text("Zoom In")');
    await page.waitForTimeout(500); // Wait for UI update
    
    await page.compareScreenshot('segmentation-zoomed-view');
  });
  
  test('Selected polygon view matches snapshot', async ({ page }) => {
    // Click on the first polygon to select it
    const canvas = await page.$('[data-testid="segmentation-canvas"]');
    const box = await canvas.boundingBox();
    
    // Click in the middle of the first polygon
    await page.mouse.click(box.x + 150, box.y + 150);
    await page.waitForTimeout(500); // Wait for UI update
    
    await page.compareScreenshot('segmentation-selected-polygon');
  });
  
  test('Dark theme matches snapshot', async ({ page }) => {
    // Enable dark theme
    await page.click('button:has-text("Theme")');
    await page.click('button:has-text("Dark")');
    await page.waitForTimeout(500); // Wait for UI update
    
    await page.compareScreenshot('segmentation-dark-theme');
  });
});

test.describe('Export Dialog Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set viewport size to consistent dimensions
    await page.setViewportSize({ width: 1280, height: 800 });
    
    // Similar mocking setup as above...
    await page.goto('/projects/test-project-id/export');
    
    // Wait for the export options to load
    await page.waitForSelector('[data-testid="export-options"]');
  });
  
  test('Export dialog layout matches snapshot', async ({ page }) => {
    await page.compareScreenshot('export-dialog-layout');
  });
  
  test('Export options panel matches snapshot', async ({ page }) => {
    await page.compareElement('[data-testid="export-options"]', 'export-options-panel');
  });
  
  test('Format selection dropdown matches snapshot', async ({ page }) => {
    // Click to open the dropdown
    await page.click('text=Select Format');
    await page.waitForTimeout(300); // Wait for dropdown to open
    
    await page.compareScreenshot('export-format-dropdown');
  });
});