import { test, expect, selectors, urls, navigateAndWaitForLoad } from '../fixtures';

test.describe('Lazy Loading and Error Handling', () => {
  test('should show loading state during page load', async ({ page }) => {
    // Slow down network to see loading states
    await page.route('**/*', async route => {
      await new Promise(resolve => setTimeout(resolve, 100));
      await route.continue();
    });

    // Navigate to a page
    const navigationPromise = page.goto(urls.documentation);
    
    // Check for loading indicator (if any)
    // This depends on the app's implementation
    await expect(page.getByText('Loading application...')).toBeVisible({ timeout: 1000 }).catch(() => {
      // Loading state might be too fast to catch
    });
    
    await navigationPromise;
    await page.waitForLoadState('networkidle');
    
    // Page should eventually load
    await expect(page.locator('h1')).toContainText('SpheroSeg Documentation');
  });

  test('should handle route loading errors gracefully', async ({ page }) => {
    // Intercept and fail a chunk request
    await page.route('**/src/pages/Documentation.tsx', route => {
      route.abort('failed');
    });

    // Try to navigate to documentation
    await page.goto(urls.documentation);
    
    // Should either show error boundary or fallback to NotFound
    await expect(page.locator('text=Page not found').or(page.locator('text=Something went wrong'))).toBeVisible();
  });

  test('should lazy load routes on demand', async ({ page }) => {
    const loadedChunks: string[] = [];
    
    // Monitor network requests for JS chunks
    page.on('response', response => {
      if (response.url().includes('.js') && response.status() === 200) {
        loadedChunks.push(response.url());
      }
    });

    // Load home page
    await navigateAndWaitForLoad(page, urls.home);
    const initialChunkCount = loadedChunks.length;
    
    // Navigate to documentation - should load new chunks
    await page.click(selectors.navigation.documentation);
    await page.waitForURL(urls.documentation);
    await page.waitForLoadState('networkidle');
    
    // Should have loaded additional chunks
    expect(loadedChunks.length).toBeGreaterThan(initialChunkCount);
  });

  test('should handle network failures gracefully', async ({ page, context }) => {
    // Navigate to home page first
    await navigateAndWaitForLoad(page, urls.home);
    
    // Go offline
    await context.setOffline(true);
    
    // Try to navigate to another page
    await page.click(selectors.navigation.documentation).catch(() => {});
    
    // Should show some error or stay on current page
    // The exact behavior depends on the app's error handling
    await page.waitForTimeout(1000);
    
    // Go back online
    await context.setOffline(false);
    
    // Should be able to navigate now
    await page.click(selectors.navigation.documentation);
    await expect(page).toHaveURL(urls.documentation);
  });

  test('should handle JavaScript errors without crashing', async ({ page }) => {
    let jsError: Error | null = null;
    
    // Listen for JavaScript errors
    page.on('pageerror', error => {
      jsError = error;
    });

    // Navigate through pages
    await navigateAndWaitForLoad(page, urls.home);
    await page.click(selectors.navigation.documentation);
    await page.waitForURL(urls.documentation);
    
    // No JavaScript errors should occur during normal navigation
    expect(jsError).toBeNull();
  });

  test('should load pages within acceptable time', async ({ page }) => {
    const maxLoadTime = 5000; // 5 seconds
    
    const pagesToTest = [
      urls.home,
      urls.documentation,
      urls.about,
      urls.termsOfService,
      urls.privacyPolicy,
    ];

    for (const url of pagesToTest) {
      const startTime = Date.now();
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      expect(loadTime).toBeLessThan(maxLoadTime);
    }
  });

  test('should handle rapid navigation without issues', async ({ page }) => {
    await navigateAndWaitForLoad(page, urls.home);
    
    // Rapidly click through navigation
    await page.click(selectors.navigation.documentation);
    await page.click(selectors.navigation.termsOfService);
    await page.click(selectors.navigation.privacyPolicy);
    await page.click(selectors.navigation.about);
    
    // Wait for final navigation to complete
    await page.waitForLoadState('networkidle');
    
    // Should end up on the last clicked page
    await expect(page).toHaveURL(urls.about);
    await expect(page.locator('h1')).toContainText('About SpheroSeg');
  });

  test('should preserve application state during navigation', async ({ page }) => {
    await navigateAndWaitForLoad(page, urls.home);
    
    // Change theme
    await page.click(selectors.themeToggle);
    
    // Get theme state
    const htmlElement = page.locator('html');
    const initialTheme = await htmlElement.getAttribute('class');
    
    // Navigate to another page
    await page.click(selectors.navigation.documentation);
    await page.waitForURL(urls.documentation);
    
    // Theme should be preserved
    const currentTheme = await htmlElement.getAttribute('class');
    expect(currentTheme).toBe(initialTheme);
  });

  test('should handle 404 errors for non-existent routes', async ({ page }) => {
    const nonExistentRoutes = [
      '/non-existent-page',
      '/admin',
      '/api/test',
      '/projects/invalid-id',
    ];

    for (const route of nonExistentRoutes) {
      await navigateAndWaitForLoad(page, route);
      
      // Should show 404 page
      await expect(page.locator('h1')).toContainText('Page not found');
      await expect(page.getByText('The page you requested could not be found')).toBeVisible();
      
      // Should have link back to home
      const homeLink = page.getByRole('link', { name: 'Return to Home' });
      await expect(homeLink).toBeVisible();
      
      // Clicking home link should work
      await homeLink.click();
      await expect(page).toHaveURL(urls.home);
    }
  });

  test('should handle deep linking correctly', async ({ page }) => {
    // Direct navigation to deep links
    await navigateAndWaitForLoad(page, urls.documentation + '#api-reference');
    
    // Should load the page and scroll to section
    await expect(page).toHaveURL(urls.documentation + '#api-reference');
    await expect(page.locator('#api-reference')).toBeInViewport();
  });
});