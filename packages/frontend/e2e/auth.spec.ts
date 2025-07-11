import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/sign-in');
    
    // Check if login form is visible
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should show error on invalid credentials', async ({ page }) => {
    await page.goto('/sign-in');
    
    // Fill in invalid credentials
    await page.locator('input[type="email"]').fill('invalid@example.com');
    await page.locator('input[type="password"]').fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Check for error message (toast notification)
    await expect(page.getByText(/invalid/i)).toBeVisible();
  });

  test('should redirect to dashboard after successful login', async ({ page }) => {
    await page.goto('/sign-in');
    
    // Fill in valid test credentials
    await page.locator('input[type="email"]').fill('testuser@test.com');
    await page.locator('input[type="password"]').fill('testuser123');
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText(/dashboard|welcome/i)).toBeVisible();
  });

  test('should allow user to sign out', async ({ page }) => {
    // First login
    await page.goto('/sign-in');
    await page.locator('input[type="email"]').fill('testuser@test.com');
    await page.locator('input[type="password"]').fill('testuser123');
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Wait for dashboard
    await expect(page).toHaveURL('/dashboard');
    
    // Click user menu and sign out
    await page.getByRole('button', { name: /menu|profile|user/i }).click();
    await page.getByRole('menuitem', { name: /sign out|logout/i }).click();
    
    // Should redirect to home or signin
    await expect(page).toHaveURL(/\/(signin|$)/);
  });
});