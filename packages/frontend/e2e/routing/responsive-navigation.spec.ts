import { test, expect, selectors, urls, navigateAndWaitForLoad } from '../fixtures';
import { devices } from '@playwright/test';

test.describe('Responsive Navigation', () => {
  test.describe('Mobile Navigation', () => {
    test.use({ ...devices['iPhone 12'] });

    test('should display mobile menu on small screens', async ({ page }) => {
      await navigateAndWaitForLoad(page, urls.home);
      
      // Mobile menu button should be visible
      const mobileMenuButton = page.locator('button[aria-label="Toggle navigation menu"]');
      await expect(mobileMenuButton).toBeVisible();
      
      // Desktop navigation should be hidden
      const desktopNav = page.locator('nav').filter({ hasText: 'Documentation' }).first();
      await expect(desktopNav).toBeHidden();
      
      // Open mobile menu
      await mobileMenuButton.click();
      
      // Mobile navigation links should be visible
      await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Documentation' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Terms' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Privacy' })).toBeVisible();
    });

    test('should navigate using mobile menu', async ({ page }) => {
      await navigateAndWaitForLoad(page, urls.home);
      
      // Open mobile menu
      const mobileMenuButton = page.locator('button[aria-label="Toggle navigation menu"]');
      await mobileMenuButton.click();
      
      // Navigate to documentation
      await page.getByRole('link', { name: 'Documentation' }).click();
      await expect(page).toHaveURL(urls.documentation);
      
      // Menu should close after navigation
      await expect(page.getByRole('link', { name: 'Documentation' }).first()).toBeHidden();
    });

    test('should handle mobile viewport for all pages', async ({ page }) => {
      const pagesToTest = [
        { url: urls.home, title: 'AI-powered Cell Analysis' },
        { url: urls.documentation, title: 'SpheroSeg Documentation' },
        { url: urls.about, title: 'About SpheroSeg' },
        { url: urls.termsOfService, title: 'Terms of Service' },
        { url: urls.privacyPolicy, title: 'Privacy Policy' },
      ];

      for (const pageInfo of pagesToTest) {
        await navigateAndWaitForLoad(page, pageInfo.url);
        
        // Check that content is visible and not cut off
        await expect(page.locator('h1').filter({ hasText: pageInfo.title })).toBeVisible();
        
        // Check horizontal scroll
        const hasHorizontalScroll = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });
        expect(hasHorizontalScroll).toBe(false);
      }
    });
  });

  test.describe('Tablet Navigation', () => {
    test.use({ ...devices['iPad'] });

    test('should display appropriate navigation on tablet', async ({ page }) => {
      await navigateAndWaitForLoad(page, urls.home);
      
      // Check if navigation is properly displayed
      await expect(page.locator(selectors.navigation.documentation).first()).toBeVisible();
      await expect(page.locator(selectors.navigation.termsOfService).first()).toBeVisible();
      
      // Check layout is appropriate for tablet
      const viewportSize = page.viewportSize();
      expect(viewportSize?.width).toBeGreaterThan(700);
    });
  });

  test.describe('Desktop Navigation', () => {
    test.use({ viewport: { width: 1920, height: 1080 } });

    test('should display full navigation on desktop', async ({ page }) => {
      await navigateAndWaitForLoad(page, urls.home);
      
      // All navigation items should be visible
      await expect(page.locator(selectors.navigation.home).first()).toBeVisible();
      await expect(page.locator(selectors.navigation.documentation).first()).toBeVisible();
      await expect(page.locator(selectors.navigation.termsOfService).first()).toBeVisible();
      await expect(page.locator(selectors.navigation.privacyPolicy).first()).toBeVisible();
      await expect(page.locator(selectors.navigation.signIn).first()).toBeVisible();
      await expect(page.locator(selectors.navigation.requestAccess).first()).toBeVisible();
      
      // Language switcher and theme toggle should be visible
      await expect(page.locator(selectors.languageSwitcher)).toBeVisible();
      await expect(page.locator(selectors.themeToggle)).toBeVisible();
    });
  });

  test('should handle orientation change', async ({ page, context }) => {
    // Start in portrait mode
    await context.setViewportSize({ width: 414, height: 896 });
    await navigateAndWaitForLoad(page, urls.home);
    
    // Check mobile menu is visible
    const mobileMenuButton = page.locator('button[aria-label="Toggle navigation menu"]');
    await expect(mobileMenuButton).toBeVisible();
    
    // Change to landscape
    await context.setViewportSize({ width: 896, height: 414 });
    
    // Navigation might change based on breakpoints
    // This test ensures the page handles orientation change without breaking
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should handle dynamic viewport resize', async ({ page }) => {
    await navigateAndWaitForLoad(page, urls.home);
    
    // Start with desktop size
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(page.locator(selectors.navigation.documentation).first()).toBeVisible();
    
    // Resize to mobile
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Mobile menu should appear
    const mobileMenuButton = page.locator('button[aria-label="Toggle navigation menu"]');
    await expect(mobileMenuButton).toBeVisible();
    
    // Resize back to desktop
    await page.setViewportSize({ width: 1200, height: 800 });
    
    // Desktop navigation should reappear
    await expect(page.locator(selectors.navigation.documentation).first()).toBeVisible();
  });

  test('should maintain functionality across different screen sizes', async ({ page }) => {
    const viewports = [
      { name: 'Mobile', width: 375, height: 667 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Desktop', width: 1920, height: 1080 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await navigateAndWaitForLoad(page, urls.home);
      
      // Core elements should be visible at all sizes
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator(selectors.logo)).toBeVisible();
      
      // Footer should be accessible
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await expect(page.locator('footer')).toBeVisible();
    }
  });
});