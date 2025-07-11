import { test, expect } from '@playwright/test';

test.describe('Project Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/signin');
    await page.locator('input[type="email"]').fill('testuser@test.com');
    await page.locator('input[type="password"]').fill('testuser123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL('/dashboard');
  });

  test('should display project list', async ({ page }) => {
    // Navigate to projects tab
    await page.getByRole('tab', { name: /Projects/i }).click();
    
    // Check if project list is visible
    await expect(page.getByText(/Your Projects/i)).toBeVisible();
  });

  test('should open create project dialog', async ({ page }) => {
    // Click create project button
    await page.getByRole('button', { name: /new project/i }).click();
    
    // Check if dialog is open
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.locator('input[name="name"], input[placeholder*="project name" i]')).toBeVisible();
    await expect(page.locator('textarea[name="description"], textarea[placeholder*="description" i]')).toBeVisible();
  });

  test('should create a new project', async ({ page }) => {
    // Open create project dialog
    await page.getByRole('button', { name: /new project/i }).click();
    
    // Fill in project details
    const projectName = `Test Project ${Date.now()}`;
    await page.locator('input[name="name"], input[placeholder*="project name" i]').fill(projectName);
    await page.locator('textarea[name="description"], textarea[placeholder*="description" i]').fill('This is a test project created by E2E tests');
    
    // Submit form
    await page.getByRole('button', { name: /create/i }).click();
    
    // Check if project was created and appears in list
    await expect(page.getByText(projectName)).toBeVisible();
  });

  test('should navigate to project detail page', async ({ page }) => {
    // Navigate to projects tab
    await page.getByRole('tab', { name: /Projects/i }).click();
    
    // Click on first project card
    const firstProject = page.locator('.project-card').first();
    await firstProject.click();
    
    // Check if on project detail page
    await expect(page.url()).toMatch(/\/project\/\d+/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('should upload an image to project', async ({ page }) => {
    // Navigate to a project
    await page.getByRole('tab', { name: /projects/i }).click();
    const firstProject = page.locator('.project-card, [data-testid="project-card"]').first();
    await firstProject.click();
    
    // Open upload dialog
    await page.getByRole('button', { name: /upload.*image/i }).click();
    
    // Check if upload dialog is visible
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/drop.*image|drag.*drop/i)).toBeVisible();
  });
});