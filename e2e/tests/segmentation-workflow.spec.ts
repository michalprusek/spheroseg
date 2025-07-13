import { test, expect, Page } from '@playwright/test';
import path from 'path';

// Test data
const TEST_USER = {
  email: 'testuser@test.com',
  password: 'testuser123',
};

const TEST_PROJECT = {
  name: 'E2E Test Project',
  description: 'Project for E2E testing',
};

// Helper functions
async function login(page: Page) {
  await page.goto('/sign-in');
  await page.fill('input[name="email"]', TEST_USER.email);
  await page.fill('input[name="password"]', TEST_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard');
}

async function createProject(page: Page, projectName: string) {
  await page.click('button:has-text("New Project")');
  await page.fill('input[name="name"]', projectName);
  await page.fill('textarea[name="description"]', TEST_PROJECT.description);
  await page.click('button:has-text("Create")');
  await page.waitForSelector(`text="${projectName}"`);
}

test.describe('Segmentation Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Complete segmentation workflow', async ({ page }) => {
    // 1. Create a new project
    await test.step('Create project', async () => {
      await createProject(page, `Test Project ${Date.now()}`);
      expect(await page.locator('.toast-success').textContent()).toContain('Project created');
    });

    // 2. Navigate to the created project
    await test.step('Open project', async () => {
      await page.click(`text="${TEST_PROJECT.name}"`);
      await page.waitForSelector('text="Upload Images"');
    });

    // 3. Upload images
    await test.step('Upload images', async () => {
      const fileChooserPromise = page.waitForEvent('filechooser');
      await page.click('text="Click to browse files"');
      const fileChooser = await fileChooserPromise;
      
      // Upload test images
      await fileChooser.setFiles([
        path.join(__dirname, '../fixtures/test-image-1.jpg'),
        path.join(__dirname, '../fixtures/test-image-2.jpg'),
      ]);

      // Check "Segment after upload" checkbox
      await page.check('input[type="checkbox"][name="segmentAfterUpload"]');
      
      // Click upload button
      await page.click('button:has-text("Upload")');
      
      // Wait for upload to complete
      await page.waitForSelector('text="Upload complete"');
    });

    // 4. Wait for segmentation to complete
    await test.step('Wait for segmentation', async () => {
      // Wait for at least one image to show "Completed" status
      await page.waitForSelector('text="Completed"', { timeout: 60000 });
    });

    // 5. Open segmentation editor
    await test.step('Open segmentation editor', async () => {
      // Click on the first completed image
      await page.click('.image-card:has-text("Completed"):first-child');
      
      // Wait for segmentation page to load
      await page.waitForSelector('canvas#segmentation-canvas');
      await page.waitForSelector('text="Edit Mode"');
    });

    // 6. Edit segmentation
    await test.step('Edit segmentation', async () => {
      // Switch to edit mode
      await page.click('button:has-text("Edit Mode")');
      
      // Wait for edit mode to be active
      await expect(page.locator('button:has-text("Edit Mode")')).toHaveClass(/active/);
      
      // Click on a polygon to select it
      const canvas = await page.locator('canvas#segmentation-canvas');
      await canvas.click({ position: { x: 200, y: 200 } });
      
      // Delete the selected polygon
      await page.keyboard.press('Delete');
      
      // Confirm deletion
      await page.click('button:has-text("Delete"):visible');
      
      // Save changes
      await page.click('button:has-text("Save")');
      await page.waitForSelector('text="Changes saved"');
    });

    // 7. Add new polygon
    await test.step('Add new polygon', async () => {
      // Switch to add points mode
      await page.click('button:has-text("Add Points")');
      
      const canvas = await page.locator('canvas#segmentation-canvas');
      
      // Create a triangle
      await canvas.click({ position: { x: 300, y: 300 } });
      await canvas.click({ position: { x: 400, y: 300 } });
      await canvas.click({ position: { x: 350, y: 400 } });
      
      // Close the polygon
      await canvas.click({ position: { x: 300, y: 300 } });
      
      // Save
      await page.click('button:has-text("Save")');
      await page.waitForSelector('text="Changes saved"');
    });

    // 8. Test slice functionality
    await test.step('Slice polygon', async () => {
      // Switch to slice mode
      await page.click('button:has-text("Slice Mode")');
      
      const canvas = await page.locator('canvas#segmentation-canvas');
      
      // Draw a slice line
      await canvas.click({ position: { x: 250, y: 350 } });
      await canvas.click({ position: { x: 450, y: 350 } });
      
      // Confirm slice
      await page.click('button:has-text("Apply Slice")');
      
      // Save
      await page.click('button:has-text("Save")');
      await page.waitForSelector('text="Changes saved"');
    });

    // 9. Navigate between images
    await test.step('Navigate between images', async () => {
      // Click next image button
      await page.click('button[aria-label="Next image"]');
      
      // Wait for new image to load
      await page.waitForTimeout(1000);
      
      // Go back to previous image
      await page.click('button[aria-label="Previous image"]');
    });

    // 10. Export results
    await test.step('Export segmentation results', async () => {
      // Click export button
      await page.click('button:has-text("Export")');
      
      // Select export format
      await page.click('input[value="COCO"]');
      
      // Include metadata
      await page.check('input[name="includeMetadata"]');
      
      // Start export
      const downloadPromise = page.waitForEvent('download');
      await page.click('button:has-text("Export Now")');
      
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toContain('.zip');
    });

    // 11. Test keyboard shortcuts
    await test.step('Test keyboard shortcuts', async () => {
      // Undo
      await page.keyboard.press('Control+z');
      
      // Redo
      await page.keyboard.press('Control+y');
      
      // Toggle edit mode
      await page.keyboard.press('e');
      
      // Save
      await page.keyboard.press('Control+s');
      await page.waitForSelector('text="Changes saved"');
    });
  });

  test('Batch operations', async ({ page }) => {
    // Navigate to project with multiple images
    await page.goto('/project/test-project-id');
    
    await test.step('Select multiple images', async () => {
      // Enable selection mode
      await page.check('input[type="checkbox"]:first-child');
      
      // Select first 3 images
      const checkboxes = await page.locator('.image-checkbox').all();
      for (let i = 0; i < Math.min(3, checkboxes.length); i++) {
        await checkboxes[i].check();
      }
      
      expect(await page.locator('text="3 selected"').isVisible()).toBeTruthy();
    });

    await test.step('Batch delete', async () => {
      await page.click('button:has-text("Delete Selected")');
      
      // Confirm deletion
      await page.click('button:has-text("Delete"):visible');
      
      await page.waitForSelector('text="3 images deleted"');
    });

    await test.step('Batch segment', async () => {
      // Select unsegmented images
      await page.click('button:has-text("Select All")');
      await page.click('button:has-text("Segment Selected")');
      
      await page.waitForSelector('text="Segmentation started"');
    });
  });

  test('Error handling', async ({ page }) => {
    await test.step('Handle network errors', async () => {
      // Simulate offline mode
      await page.context().setOffline(true);
      
      // Try to create a project
      await page.click('button:has-text("New Project")');
      await page.fill('input[name="name"]', 'Offline Test');
      await page.click('button:has-text("Create")');
      
      // Should show error message
      await expect(page.locator('.toast-error')).toContainText('Network error');
      
      // Go back online
      await page.context().setOffline(false);
    });

    await test.step('Handle invalid file upload', async () => {
      await page.goto('/project/test-project-id');
      
      const fileChooserPromise = page.waitForEvent('filechooser');
      await page.click('text="Click to browse files"');
      const fileChooser = await fileChooserPromise;
      
      // Try to upload non-image file
      await fileChooser.setFiles([
        path.join(__dirname, '../fixtures/test-document.pdf'),
      ]);
      
      await expect(page.locator('.toast-error')).toContainText('Invalid file type');
    });
  });

  test('Responsive design', async ({ page }) => {
    // Test mobile viewport
    await test.step('Mobile view', async () => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/dashboard');
      
      // Mobile menu should be visible
      await expect(page.locator('button[aria-label="Menu"]')).toBeVisible();
      
      // Open mobile menu
      await page.click('button[aria-label="Menu"]');
      await expect(page.locator('.mobile-menu')).toBeVisible();
    });

    // Test tablet viewport
    await test.step('Tablet view', async () => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.reload();
      
      // Layout should adapt
      await expect(page.locator('.sidebar')).toBeVisible();
    });

    // Test desktop viewport
    await test.step('Desktop view', async () => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.reload();
      
      // Full layout should be visible
      await expect(page.locator('.sidebar')).toBeVisible();
      await expect(page.locator('.main-content')).toBeVisible();
    });
  });

  test('Accessibility', async ({ page }) => {
    await test.step('Keyboard navigation', async () => {
      await page.goto('/dashboard');
      
      // Tab through interactive elements
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toBeVisible();
      
      // Navigate with arrow keys
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
    });

    await test.step('Screen reader labels', async () => {
      // Check for proper ARIA labels
      const buttons = await page.locator('button').all();
      for (const button of buttons) {
        const ariaLabel = await button.getAttribute('aria-label');
        const text = await button.textContent();
        expect(ariaLabel || text).toBeTruthy();
      }
    });

    await test.step('Color contrast', async () => {
      // This would typically use axe-core or similar
      // For now, just check that important elements are visible
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
    });
  });
});

test.describe('Performance', () => {
  test('Page load performance', async ({ page }) => {
    const metrics = [];
    
    page.on('load', async () => {
      const performance = await page.evaluate(() => 
        JSON.stringify(window.performance.timing)
      );
      metrics.push(JSON.parse(performance));
    });

    await page.goto('/');
    await page.goto('/dashboard');
    await page.goto('/project/test-project-id');

    // Analyze metrics
    for (const metric of metrics) {
      const loadTime = metric.loadEventEnd - metric.navigationStart;
      expect(loadTime).toBeLessThan(3000); // 3 seconds max
    }
  });

  test('Large dataset handling', async ({ page }) => {
    // Navigate to project with many images
    await page.goto('/project/large-dataset-project');
    
    // Should implement virtual scrolling
    const visibleImages = await page.locator('.image-card').count();
    expect(visibleImages).toBeLessThan(50); // Should not render all at once
    
    // Scroll down
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    
    // More images should load
    const newVisibleImages = await page.locator('.image-card').count();
    expect(newVisibleImages).toBeGreaterThan(visibleImages);
  });
});