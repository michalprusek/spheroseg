import { test, expect, selectors, urls, navigateAndWaitForLoad, checkPageTitle, checkHeading, checkNavigationLinks, checkFooterLinks, checkNoTranslationKeys } from '../fixtures';

test.describe('Public Routes Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await navigateAndWaitForLoad(page, urls.home);
  });

  test('should navigate to home page and display correct content', async ({ page }) => {
    await checkPageTitle(page, 'SpheroSeg - Spheroid Segmentation Platform');
    await checkHeading(page, 'h1', 'AI-powered Cell Analysis for Biomedical Research');
    
    // Check key elements
    await expect(page.locator(selectors.logo)).toBeVisible();
    await expect(page.getByText('Advanced Spheroid Segmentation Platform')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Get Started' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Learn More' })).toBeVisible();
    
    // Check navigation
    await checkNavigationLinks(page);
    await checkFooterLinks(page);
  });

  test('should navigate to documentation page', async ({ page }) => {
    await page.click(selectors.navigation.documentation);
    await page.waitForURL(urls.documentation);
    
    await checkPageTitle(page, 'SpheroSeg - Spheroid Segmentation Platform');
    await checkHeading(page, 'h1', 'SpheroSeg Documentation');
    
    // Check documentation sections
    await expect(page.getByText('Introduction')).toBeVisible();
    await expect(page.getByText('Getting Started')).toBeVisible();
    await expect(page.getByText('Uploading Images')).toBeVisible();
    await expect(page.getByText('Segmentation Process')).toBeVisible();
    await expect(page.getByText('API Reference')).toBeVisible();
    
    // Check sidebar navigation
    await expect(page.locator('nav').getByRole('link', { name: 'Introduction' })).toBeVisible();
  });

  test('should navigate to terms of service page', async ({ page }) => {
    await page.click(selectors.navigation.termsOfService);
    await page.waitForURL(urls.termsOfService);
    
    await checkPageTitle(page, 'SpheroSeg - Spheroid Segmentation Platform');
    await checkHeading(page, 'h1', 'Terms of Service');
    
    // Check terms sections
    await expect(page.getByText('1. Acceptance of Terms')).toBeVisible();
    await expect(page.getByText('2. Use License')).toBeVisible();
    await expect(page.getByText('3. Data Usage')).toBeVisible();
    await expect(page.getByText('4. Service Limitations')).toBeVisible();
    await expect(page.getByText('5. Revisions')).toBeVisible();
    await expect(page.getByText('6. Governing Law')).toBeVisible();
    await expect(page.getByText('Last Updated: January 7, 2025')).toBeVisible();
  });

  test('should navigate to privacy policy page', async ({ page }) => {
    await page.click(selectors.navigation.privacyPolicy);
    await page.waitForURL(urls.privacyPolicy);
    
    await checkPageTitle(page, 'SpheroSeg - Spheroid Segmentation Platform');
    await checkHeading(page, 'h1', 'Privacy Policy');
    
    // Check privacy sections
    await expect(page.getByText('1. Introduction')).toBeVisible();
    await expect(page.getByText('2. Information We Collect')).toBeVisible();
    await expect(page.getByText('3. How We Use Your Information')).toBeVisible();
    await expect(page.getByText('4. Data Storage and Security')).toBeVisible();
    await expect(page.getByText('5. Data Sharing')).toBeVisible();
    await expect(page.getByText('6. Your Rights')).toBeVisible();
    await expect(page.getByText('7. Cookies and Tracking Technologies')).toBeVisible();
    await expect(page.getByText('8. Changes to This Policy')).toBeVisible();
    await expect(page.getByText('9. Contact Us')).toBeVisible();
  });

  test('should navigate to sign in page', async ({ page }) => {
    await page.click(selectors.navigation.signIn);
    await page.waitForURL(urls.signIn);
    
    await checkPageTitle(page, 'SpheroSeg - Spheroid Segmentation Platform');
    await checkHeading(page, 'h2', 'Sign In');
    
    // Check sign in form elements
    await expect(page.getByPlaceholder('Enter your email')).toBeVisible();
    await expect(page.getByPlaceholder('Enter your password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    await expect(page.getByText('Forgot password?')).toBeVisible();
    await expect(page.getByText("Don't have an account?")).toBeVisible();
  });

  test('should navigate to sign up page', async ({ page }) => {
    // Navigate through sign in page link
    await page.click(selectors.navigation.signIn);
    await page.waitForURL(urls.signIn);
    await page.click('text=Sign Up');
    await page.waitForURL(urls.signUp);
    
    await checkPageTitle(page, 'SpheroSeg - Spheroid Segmentation Platform');
    await checkHeading(page, 'h2', 'Create Account');
    
    // Check sign up form elements
    await expect(page.getByPlaceholder('Enter your email')).toBeVisible();
    await expect(page.getByPlaceholder('Enter your password')).toBeVisible();
    await expect(page.getByPlaceholder('Confirm your password')).toBeVisible();
    await expect(page.getByPlaceholder('e.g. John')).toBeVisible();
    await expect(page.getByPlaceholder('e.g. Smith')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
  });

  test('should navigate to request access page', async ({ page }) => {
    await page.click(selectors.navigation.requestAccess);
    await page.waitForURL(urls.requestAccess);
    
    await checkPageTitle(page, 'SpheroSeg - Spheroid Segmentation Platform');
    await checkHeading(page, 'h2', 'Request Access to Spheroid Segmentation Platform');
    
    // Check request access form
    await expect(page.getByText('Your Email Address')).toBeVisible();
    await expect(page.getByText('Your Name')).toBeVisible();
    await expect(page.getByText('Institution/Company')).toBeVisible();
    await expect(page.getByText('Reason for Access')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit Request' })).toBeVisible();
  });

  test('should navigate to about page', async ({ page }) => {
    // Navigate via footer link
    await page.locator('footer').getByRole('link', { name: 'Documentation' }).scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    // Direct navigation to about page
    await navigateAndWaitForLoad(page, urls.about);
    
    await checkPageTitle(page, 'SpheroSeg - Spheroid Segmentation Platform');
    await checkHeading(page, 'h1', 'About SpheroSeg');
    
    // Check about page content
    await expect(page.getByText('Our Mission')).toBeVisible();
    await expect(page.getByText('Our Technology')).toBeVisible();
    await expect(page.getByText('Our Team')).toBeVisible();
    await expect(page.getByText('Contact Us')).toBeVisible();
    
    // Check team members
    await expect(page.getByText('Michal Průšek')).toBeVisible();
    await expect(page.getByText('Adam Novozámský')).toBeVisible();
    
    // Check no translation keys are visible
    await checkNoTranslationKeys(page);
    
    // Check dynamic copyright year
    const currentYear = new Date().getFullYear();
    await expect(page.getByText(`© ${currentYear} Spheroid Segmentation Platform`)).toBeVisible();
  });

  test('should handle 404 page for invalid routes', async ({ page }) => {
    await navigateAndWaitForLoad(page, '/invalid-route-that-does-not-exist');
    
    await checkPageTitle(page, 'SpheroSeg - Spheroid Segmentation Platform');
    await checkHeading(page, 'h1', 'Page not found');
    await expect(page.getByText('The page you requested could not be found')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Return to Home' })).toBeVisible();
  });
});