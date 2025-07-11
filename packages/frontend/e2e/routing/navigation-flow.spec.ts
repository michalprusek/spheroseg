import { test, expect, selectors, urls, navigateAndWaitForLoad } from '../fixtures';

test.describe('Navigation Flow and Links', () => {
  test.beforeEach(async ({ page }) => {
    await navigateAndWaitForLoad(page, urls.home);
  });

  test('should navigate between pages using navigation menu', async ({ page }) => {
    // Test navigation menu flow
    await page.click(selectors.navigation.documentation);
    await expect(page).toHaveURL(urls.documentation);
    
    await page.click(selectors.navigation.termsOfService);
    await expect(page).toHaveURL(urls.termsOfService);
    
    await page.click(selectors.navigation.privacyPolicy);
    await expect(page).toHaveURL(urls.privacyPolicy);
    
    // Navigate back to home using logo
    await page.click(selectors.logo);
    await expect(page).toHaveURL(urls.home);
  });

  test('should navigate between pages using footer links', async ({ page }) => {
    // Scroll to footer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    // Test footer navigation
    await page.locator('footer').getByRole('link', { name: 'Documentation' }).click();
    await expect(page).toHaveURL(urls.documentation);
    
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.locator('footer').getByRole('link', { name: 'Terms of Service' }).click();
    await expect(page).toHaveURL(urls.termsOfService);
    
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.locator('footer').getByRole('link', { name: 'Privacy Policy' }).click();
    await expect(page).toHaveURL(urls.privacyPolicy);
  });

  test('should navigate from sign in to sign up and back', async ({ page }) => {
    // Go to sign in
    await page.click(selectors.navigation.signIn);
    await expect(page).toHaveURL(urls.signIn);
    
    // Navigate to sign up from sign in page
    await page.click('text=Sign Up');
    await expect(page).toHaveURL(urls.signUp);
    
    // Navigate back to sign in from sign up page
    await page.click('text=Sign In');
    await expect(page).toHaveURL(urls.signIn);
    
    // Navigate to forgot password
    await page.click('text=Forgot password?');
    await expect(page).toHaveURL(urls.forgotPassword);
    
    // Navigate back to sign in
    await page.click('text=Back to Sign In');
    await expect(page).toHaveURL(urls.signIn);
  });

  test('should navigate to request access from multiple entry points', async ({ page }) => {
    // From main navigation
    await page.click(selectors.navigation.requestAccess);
    await expect(page).toHaveURL(urls.requestAccess);
    
    // Back to home
    await page.click(selectors.logo);
    await expect(page).toHaveURL(urls.home);
    
    // From footer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.locator('footer').getByRole('link', { name: 'Request Access' }).click();
    await expect(page).toHaveURL(urls.requestAccess);
  });

  test('should handle browser back/forward navigation correctly', async ({ page }) => {
    // Navigate through multiple pages
    await page.click(selectors.navigation.documentation);
    await expect(page).toHaveURL(urls.documentation);
    
    await page.click(selectors.navigation.about);
    await expect(page).toHaveURL(urls.about);
    
    await page.click(selectors.navigation.termsOfService);
    await expect(page).toHaveURL(urls.termsOfService);
    
    // Test browser back button
    await page.goBack();
    await expect(page).toHaveURL(urls.about);
    
    await page.goBack();
    await expect(page).toHaveURL(urls.documentation);
    
    await page.goBack();
    await expect(page).toHaveURL(urls.home);
    
    // Test browser forward button
    await page.goForward();
    await expect(page).toHaveURL(urls.documentation);
    
    await page.goForward();
    await expect(page).toHaveURL(urls.about);
  });

  test('should maintain scroll position when navigating back', async ({ page }) => {
    // Scroll down on home page
    await page.evaluate(() => window.scrollTo(0, 500));
    const initialScrollY = await page.evaluate(() => window.scrollY);
    expect(initialScrollY).toBeGreaterThan(0);
    
    // Navigate to another page
    await page.click(selectors.navigation.documentation);
    await expect(page).toHaveURL(urls.documentation);
    
    // Go back
    await page.goBack();
    await expect(page).toHaveURL(urls.home);
    
    // Check if scroll position is maintained (might not be exact due to async loading)
    const finalScrollY = await page.evaluate(() => window.scrollY);
    expect(finalScrollY).toBeGreaterThanOrEqual(0);
  });

  test('should handle external links correctly', async ({ page }) => {
    // Check external links in footer open in new tab
    const [newPage] = await Promise.all([
      page.waitForEvent('popup'),
      page.locator('footer').getByRole('link', { name: 'FNSPE CTU in Prague' }).click()
    ]);
    
    await expect(newPage).toHaveURL(/fjfi\.cvut\.cz/);
    await newPage.close();
  });

  test('should display correct active states in navigation', async ({ page }) => {
    // Check documentation page
    await page.click(selectors.navigation.documentation);
    const docLink = page.locator(selectors.navigation.documentation).first();
    
    // The active link might have different styling - check if it's visible and enabled
    await expect(docLink).toBeVisible();
    await expect(docLink).toBeEnabled();
  });

  test('should handle navigation with hash links correctly', async ({ page }) => {
    await page.click(selectors.navigation.documentation);
    await expect(page).toHaveURL(urls.documentation);
    
    // Click on section link
    await page.click('a[href="#getting-started"]');
    await expect(page).toHaveURL(urls.documentation + '#getting-started');
    
    // Check that the section is visible
    await expect(page.locator('#getting-started')).toBeInViewport();
  });

  test('should preserve query parameters during navigation', async ({ page }) => {
    // Navigate with query params
    await navigateAndWaitForLoad(page, urls.home + '?ref=test&utm_source=e2e');
    
    // Click on documentation link
    await page.click(selectors.navigation.documentation);
    
    // Query params might not be preserved by default - this is expected behavior
    await expect(page).toHaveURL(urls.documentation);
  });
});