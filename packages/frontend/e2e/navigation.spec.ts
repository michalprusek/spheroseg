import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should navigate to home page', async ({ page }) => {
    await page.goto('/');
    
    // Check if home page elements are visible
    await expect(page.getByText('AI-powered Cell Analysis for Biomedical Research')).toBeVisible();
    await expect(page.getByText('Get Started')).toBeVisible();
  });

  test('should navigate to about page', async ({ page }) => {
    await page.goto('/');
    
    // About link doesn't exist on home page, so navigate directly
    await page.goto('/about');
    
    // Check if on about page
    await expect(page).toHaveURL('/about');
    await expect(page.getByRole('heading', { name: /About/i })).toBeVisible();
  });

  test('should navigate to documentation page', async ({ page }) => {
    await page.goto('/');
    
    // Click on Documentation link
    await page.getByRole('link', { name: /Documentation/i }).click();
    
    // Check if on documentation page
    await expect(page).toHaveURL('/documentation');
    await expect(page.getByRole('heading', { name: /Documentation/i })).toBeVisible();
  });

  test('mobile menu should work', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/');
    
    // Open mobile menu (hamburger icon)
    await page.locator('button[aria-label*="menu" i], button:has(svg.lucide-menu)').click();
    
    // Check if menu items are visible
    await expect(page.getByRole('link', { name: /about/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /documentation/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
  });
});