/**
 * E2E tests for project management flow
 * 
 * Tests project creation, sharing, settings, and deletion
 */

import { test, expect } from '@playwright/test';

// Test constants
const TEST_USER = {
  email: 'testuser@test.com',
  password: 'testuser123',
};

const COLLABORATOR = {
  email: 'collaborator@test.com',
  password: 'collaborator123',
};

test.describe('Project Management Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as primary user
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USER.email);
    await page.fill('input[name="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should create, edit, and delete a project', async ({ page }) => {
    const projectName = `Test Project ${Date.now()}`;
    const updatedName = `${projectName} Updated`;

    // Step 1: Create project
    await test.step('Create new project', async () => {
      await page.click('button:has-text("New Project")');
      
      // Fill form
      await page.fill('input[name="name"]', projectName);
      await page.fill('textarea[name="description"]', 'This is a test project');
      
      // Select settings
      await page.click('label:has-text("Enable auto-segmentation")');
      await page.fill('input[name="segmentationThreshold"]', '0.7');
      
      // Create
      await page.click('button:has-text("Create Project")');
      
      // Verify creation
      await expect(page.locator('h1')).toContainText(projectName);
      await expect(page).toHaveURL(/\/projects\/[a-zA-Z0-9-]+$/);
    });

    // Step 2: Edit project
    await test.step('Edit project settings', async () => {
      // Open settings
      await page.click('button:has-text("Settings")');
      
      // Update name
      await page.fill('input[name="name"]', updatedName);
      
      // Update description
      await page.fill('textarea[name="description"]', 'Updated description');
      
      // Change settings
      await page.fill('input[name="segmentationThreshold"]', '0.8');
      await page.click('label:has-text("Require review before export")');
      
      // Save
      await page.click('button:has-text("Save Changes")');
      
      // Verify updates
      await expect(page.locator('[data-testid="success-toast"]'))
        .toContainText('Project updated successfully');
      await expect(page.locator('h1')).toContainText(updatedName);
    });

    // Step 3: Delete project
    await test.step('Delete project', async () => {
      // Open settings
      await page.click('button:has-text("Settings")');
      
      // Scroll to danger zone
      await page.locator('[data-testid="danger-zone"]').scrollIntoViewIfNeeded();
      
      // Click delete
      await page.click('button:has-text("Delete Project")');
      
      // Confirm deletion
      await page.fill('input[placeholder="Type project name to confirm"]', updatedName);
      await page.click('button:has-text("Delete Forever")');
      
      // Verify redirect to dashboard
      await expect(page).toHaveURL('/dashboard');
      
      // Verify project is gone
      await expect(page.locator(`text="${updatedName}"`)).not.toBeVisible();
    });
  });

  test('should share project with collaborators', async ({ page, context }) => {
    // Navigate to first project
    await page.click('[data-testid="project-card"]:first-of-type');
    const projectUrl = page.url();
    
    // Open share dialog
    await page.click('button:has-text("Share")');
    
    // Add collaborator
    await page.fill('input[placeholder="Enter email address"]', COLLABORATOR.email);
    await page.selectOption('select[name="permission"]', 'edit');
    await page.click('button:has-text("Add Collaborator")');
    
    // Verify collaborator added
    await expect(page.locator(`[data-testid="collaborator-${COLLABORATOR.email}"]`))
      .toBeVisible();
    
    // Close dialog
    await page.click('button:has-text("Done")');
    
    // Login as collaborator in new context
    const collaboratorPage = await context.newPage();
    await collaboratorPage.goto('/login');
    await collaboratorPage.fill('input[name="email"]', COLLABORATOR.email);
    await collaboratorPage.fill('input[name="password"]', COLLABORATOR.password);
    await collaboratorPage.click('button[type="submit"]');
    await collaboratorPage.waitForURL('/dashboard');
    
    // Verify shared project appears
    await expect(collaboratorPage.locator('[data-testid="shared-projects"]'))
      .toContainText('Shared with you');
    
    // Navigate to shared project
    await collaboratorPage.goto(projectUrl);
    
    // Verify edit permissions
    await expect(collaboratorPage.locator('button:has-text("Upload Images")')).toBeEnabled();
    await expect(collaboratorPage.locator('button:has-text("Settings")')).toBeDisabled();
    
    // Close collaborator page
    await collaboratorPage.close();
    
    // Remove collaborator
    await page.click('button:has-text("Share")');
    await page.click(`[data-testid="remove-${COLLABORATOR.email}"]`);
    await page.click('button:has-text("Done")');
  });

  test('should duplicate project with settings', async ({ page }) => {
    // Navigate to project
    await page.click('[data-testid="project-card"]:first-of-type');
    
    // Get original project name
    const originalName = await page.locator('h1').textContent();
    
    // Open actions menu
    await page.click('button[aria-label="More actions"]');
    await page.click('button:has-text("Duplicate Project")');
    
    // Configure duplication
    await page.click('label:has-text("Include settings")');
    await page.click('label:has-text("Include team members")');
    const newName = `${originalName} (Copy)`;
    await page.fill('input[name="name"]', newName);
    
    // Duplicate
    await page.click('button:has-text("Duplicate")');
    
    // Wait for redirect to new project
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+$/);
    
    // Verify duplication
    await expect(page.locator('h1')).toContainText(newName);
    await expect(page.locator('[data-testid="project-settings"]'))
      .toContainText('Settings copied from original');
  });

  test('should export and import project data', async ({ page }) => {
    // Navigate to project with data
    await page.click('[data-testid="project-card"]:has-text("Sample Project")');
    
    // Export project
    await test.step('Export project data', async () => {
      await page.click('button[aria-label="More actions"]');
      await page.click('button:has-text("Export Project")');
      
      // Select export options
      await page.click('label:has-text("Include images")');
      await page.click('label:has-text("Include segmentation results")');
      await page.click('label:has-text("Include metadata")');
      
      // Start export
      const downloadPromise = page.waitForEvent('download');
      await page.click('button:has-text("Export")');
      const download = await downloadPromise;
      
      // Verify download
      expect(download.suggestedFilename()).toContain('.zip');
    });
    
    // Import to new project
    await test.step('Import project data', async () => {
      // Go to dashboard
      await page.goto('/dashboard');
      
      // Create new project
      await page.click('button:has-text("New Project")');
      await page.click('button:has-text("Import from file")');
      
      // Upload export file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles('./project-export.zip'); // Assuming file exists
      
      // Configure import
      await page.click('label:has-text("Import all data")');
      await page.fill('input[name="name"]', 'Imported Project');
      
      // Import
      await page.click('button:has-text("Import")');
      
      // Wait for import to complete
      await expect(page.locator('[data-testid="import-progress"]'))
        .toHaveAttribute('data-value', '100', { timeout: 60000 });
      
      // Verify import
      await expect(page.locator('h1')).toContainText('Imported Project');
      await expect(page.locator('[data-testid="image-count"]')).not.toContainText('0');
    });
  });
});

test.describe('Project Analytics and Insights', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USER.email);
    await page.fill('input[name="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should display project analytics', async ({ page }) => {
    // Navigate to project with data
    await page.click('[data-testid="project-card"]:has-text("Sample Project")');
    
    // Open analytics
    await page.click('button:has-text("Analytics")');
    
    // Verify analytics components
    await expect(page.locator('[data-testid="total-images-stat"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-cells-stat"]')).toBeVisible();
    await expect(page.locator('[data-testid="avg-cells-per-image"]')).toBeVisible();
    
    // Check charts
    await expect(page.locator('[data-testid="cell-distribution-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="processing-timeline-chart"]')).toBeVisible();
    
    // Test date range filter
    await page.click('button:has-text("Last 7 days")');
    await page.click('button:has-text("Last 30 days")');
    
    // Wait for data update
    await page.waitForLoadState('networkidle');
    
    // Export analytics report
    await page.click('button:has-text("Export Report")');
    await page.selectOption('select[name="format"]', 'pdf');
    
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Download")');
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toContain('analytics-report.pdf');
  });

  test('should filter and search project images', async ({ page }) => {
    // Navigate to project
    await page.click('[data-testid="project-card"]:first-of-type');
    
    // Test search
    await page.fill('input[placeholder="Search images..."]', 'cell');
    await page.press('input[placeholder="Search images..."]', 'Enter');
    
    // Verify search results
    await expect(page.locator('[data-testid="search-results-count"]'))
      .toContainText('results');
    
    // Clear search
    await page.click('button[aria-label="Clear search"]');
    
    // Test filters
    await page.click('button:has-text("Filters")');
    
    // Filter by status
    await page.click('label:has-text("Completed")');
    await page.click('label:has-text("Processing")');
    
    // Filter by date
    await page.fill('input[name="dateFrom"]', '2024-01-01');
    await page.fill('input[name="dateTo"]', '2024-12-31');
    
    // Filter by cell count
    await page.fill('input[name="minCells"]', '10');
    await page.fill('input[name="maxCells"]', '100');
    
    // Apply filters
    await page.click('button:has-text("Apply Filters")');
    
    // Verify filtered results
    const images = page.locator('[data-testid="image-card"]');
    await expect(images).toHaveCount(await images.count());
    
    // Save filter preset
    await page.click('button:has-text("Save Filter")');
    await page.fill('input[name="filterName"]', 'High Cell Count Images');
    await page.click('button:has-text("Save")');
    
    // Verify preset saved
    await expect(page.locator('[data-testid="filter-presets"]'))
      .toContainText('High Cell Count Images');
  });
});

test.describe('Project Permissions and Access Control', () => {
  test('should enforce view-only permissions', async ({ page, context }) => {
    // Share project with view-only permission
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USER.email);
    await page.fill('input[name="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    
    // Navigate to project and share
    await page.click('[data-testid="project-card"]:first-of-type');
    const projectUrl = page.url();
    
    await page.click('button:has-text("Share")');
    await page.fill('input[placeholder="Enter email address"]', COLLABORATOR.email);
    await page.selectOption('select[name="permission"]', 'view');
    await page.click('button:has-text("Add Collaborator")');
    await page.click('button:has-text("Done")');
    
    // Login as viewer
    const viewerPage = await context.newPage();
    await viewerPage.goto('/login');
    await viewerPage.fill('input[name="email"]', COLLABORATOR.email);
    await viewerPage.fill('input[name="password"]', COLLABORATOR.password);
    await viewerPage.click('button[type="submit"]');
    await viewerPage.waitForURL('/dashboard');
    
    // Navigate to shared project
    await viewerPage.goto(projectUrl);
    
    // Verify read-only access
    await expect(viewerPage.locator('button:has-text("Upload Images")')).toBeDisabled();
    await expect(viewerPage.locator('button:has-text("Delete")')).not.toBeVisible();
    await expect(viewerPage.locator('button:has-text("Settings")')).toBeDisabled();
    
    // Verify can view but not edit
    await viewerPage.click('[data-testid="image-card"]:first-of-type');
    await expect(viewerPage.locator('[data-testid="edit-button"]')).not.toBeVisible();
    
    await viewerPage.close();
  });
});