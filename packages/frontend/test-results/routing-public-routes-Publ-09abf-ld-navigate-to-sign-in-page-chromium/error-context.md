# Test info

- Name: Public Routes Navigation >> should navigate to sign in page
- Location: /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/routing/public-routes.spec.ts:77:3

# Error details

```
Error: browserType.launch: Executable doesn't exist at /home/cvat/.cache/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell
╔═════════════════════════════════════════════════════════════════════════╗
║ Looks like Playwright Test or Playwright was just installed or updated. ║
║ Please run the following command to download new browsers:              ║
║                                                                         ║
║     npx playwright install                                              ║
║                                                                         ║
║ <3 Playwright Team                                                      ║
╚═════════════════════════════════════════════════════════════════════════╝
```

# Test source

```ts
   1 | import { test, expect, selectors, urls, navigateAndWaitForLoad, checkPageTitle, checkHeading, checkNavigationLinks, checkFooterLinks, checkNoTranslationKeys } from '../fixtures';
   2 |
   3 | test.describe('Public Routes Navigation', () => {
   4 |   test.beforeEach(async ({ page }) => {
   5 |     await navigateAndWaitForLoad(page, urls.home);
   6 |   });
   7 |
   8 |   test('should navigate to home page and display correct content', async ({ page }) => {
   9 |     await checkPageTitle(page, 'SpheroSeg - Spheroid Segmentation Platform');
   10 |     await checkHeading(page, 'h1', 'AI-powered Cell Analysis for Biomedical Research');
   11 |     
   12 |     // Check key elements
   13 |     await expect(page.locator(selectors.logo)).toBeVisible();
   14 |     await expect(page.getByText('Advanced Spheroid Segmentation Platform')).toBeVisible();
   15 |     await expect(page.getByRole('link', { name: 'Get Started' })).toBeVisible();
   16 |     await expect(page.getByRole('link', { name: 'Learn More' })).toBeVisible();
   17 |     
   18 |     // Check navigation
   19 |     await checkNavigationLinks(page);
   20 |     await checkFooterLinks(page);
   21 |   });
   22 |
   23 |   test('should navigate to documentation page', async ({ page }) => {
   24 |     await page.click(selectors.navigation.documentation);
   25 |     await page.waitForURL(urls.documentation);
   26 |     
   27 |     await checkPageTitle(page, 'SpheroSeg - Spheroid Segmentation Platform');
   28 |     await checkHeading(page, 'h1', 'SpheroSeg Documentation');
   29 |     
   30 |     // Check documentation sections
   31 |     await expect(page.getByText('Introduction')).toBeVisible();
   32 |     await expect(page.getByText('Getting Started')).toBeVisible();
   33 |     await expect(page.getByText('Uploading Images')).toBeVisible();
   34 |     await expect(page.getByText('Segmentation Process')).toBeVisible();
   35 |     await expect(page.getByText('API Reference')).toBeVisible();
   36 |     
   37 |     // Check sidebar navigation
   38 |     await expect(page.locator('nav').getByRole('link', { name: 'Introduction' })).toBeVisible();
   39 |   });
   40 |
   41 |   test('should navigate to terms of service page', async ({ page }) => {
   42 |     await page.click(selectors.navigation.termsOfService);
   43 |     await page.waitForURL(urls.termsOfService);
   44 |     
   45 |     await checkPageTitle(page, 'SpheroSeg - Spheroid Segmentation Platform');
   46 |     await checkHeading(page, 'h1', 'Terms of Service');
   47 |     
   48 |     // Check terms sections
   49 |     await expect(page.getByText('1. Acceptance of Terms')).toBeVisible();
   50 |     await expect(page.getByText('2. Use License')).toBeVisible();
   51 |     await expect(page.getByText('3. Data Usage')).toBeVisible();
   52 |     await expect(page.getByText('4. Service Limitations')).toBeVisible();
   53 |     await expect(page.getByText('5. Revisions')).toBeVisible();
   54 |     await expect(page.getByText('6. Governing Law')).toBeVisible();
   55 |     await expect(page.getByText('Last Updated: January 7, 2025')).toBeVisible();
   56 |   });
   57 |
   58 |   test('should navigate to privacy policy page', async ({ page }) => {
   59 |     await page.click(selectors.navigation.privacyPolicy);
   60 |     await page.waitForURL(urls.privacyPolicy);
   61 |     
   62 |     await checkPageTitle(page, 'SpheroSeg - Spheroid Segmentation Platform');
   63 |     await checkHeading(page, 'h1', 'Privacy Policy');
   64 |     
   65 |     // Check privacy sections
   66 |     await expect(page.getByText('1. Introduction')).toBeVisible();
   67 |     await expect(page.getByText('2. Information We Collect')).toBeVisible();
   68 |     await expect(page.getByText('3. How We Use Your Information')).toBeVisible();
   69 |     await expect(page.getByText('4. Data Storage and Security')).toBeVisible();
   70 |     await expect(page.getByText('5. Data Sharing')).toBeVisible();
   71 |     await expect(page.getByText('6. Your Rights')).toBeVisible();
   72 |     await expect(page.getByText('7. Cookies and Tracking Technologies')).toBeVisible();
   73 |     await expect(page.getByText('8. Changes to This Policy')).toBeVisible();
   74 |     await expect(page.getByText('9. Contact Us')).toBeVisible();
   75 |   });
   76 |
>  77 |   test('should navigate to sign in page', async ({ page }) => {
      |   ^ Error: browserType.launch: Executable doesn't exist at /home/cvat/.cache/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell
   78 |     await page.click(selectors.navigation.signIn);
   79 |     await page.waitForURL(urls.signIn);
   80 |     
   81 |     await checkPageTitle(page, 'SpheroSeg - Spheroid Segmentation Platform');
   82 |     await checkHeading(page, 'h2', 'Sign In');
   83 |     
   84 |     // Check sign in form elements
   85 |     await expect(page.getByPlaceholder('Enter your email')).toBeVisible();
   86 |     await expect(page.getByPlaceholder('Enter your password')).toBeVisible();
   87 |     await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
   88 |     await expect(page.getByText('Forgot password?')).toBeVisible();
   89 |     await expect(page.getByText("Don't have an account?")).toBeVisible();
   90 |   });
   91 |
   92 |   test('should navigate to sign up page', async ({ page }) => {
   93 |     // Navigate through sign in page link
   94 |     await page.click(selectors.navigation.signIn);
   95 |     await page.waitForURL(urls.signIn);
   96 |     await page.click('text=Sign Up');
   97 |     await page.waitForURL(urls.signUp);
   98 |     
   99 |     await checkPageTitle(page, 'SpheroSeg - Spheroid Segmentation Platform');
  100 |     await checkHeading(page, 'h2', 'Create Account');
  101 |     
  102 |     // Check sign up form elements
  103 |     await expect(page.getByPlaceholder('Enter your email')).toBeVisible();
  104 |     await expect(page.getByPlaceholder('Enter your password')).toBeVisible();
  105 |     await expect(page.getByPlaceholder('Confirm your password')).toBeVisible();
  106 |     await expect(page.getByPlaceholder('e.g. John')).toBeVisible();
  107 |     await expect(page.getByPlaceholder('e.g. Smith')).toBeVisible();
  108 |     await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
  109 |   });
  110 |
  111 |   test('should navigate to request access page', async ({ page }) => {
  112 |     await page.click(selectors.navigation.requestAccess);
  113 |     await page.waitForURL(urls.requestAccess);
  114 |     
  115 |     await checkPageTitle(page, 'SpheroSeg - Spheroid Segmentation Platform');
  116 |     await checkHeading(page, 'h2', 'Request Access to Spheroid Segmentation Platform');
  117 |     
  118 |     // Check request access form
  119 |     await expect(page.getByText('Your Email Address')).toBeVisible();
  120 |     await expect(page.getByText('Your Name')).toBeVisible();
  121 |     await expect(page.getByText('Institution/Company')).toBeVisible();
  122 |     await expect(page.getByText('Reason for Access')).toBeVisible();
  123 |     await expect(page.getByRole('button', { name: 'Submit Request' })).toBeVisible();
  124 |   });
  125 |
  126 |   test('should navigate to about page', async ({ page }) => {
  127 |     // Navigate via footer link
  128 |     await page.locator('footer').getByRole('link', { name: 'Documentation' }).scrollIntoViewIfNeeded();
  129 |     await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  130 |     
  131 |     // Direct navigation to about page
  132 |     await navigateAndWaitForLoad(page, urls.about);
  133 |     
  134 |     await checkPageTitle(page, 'SpheroSeg - Spheroid Segmentation Platform');
  135 |     await checkHeading(page, 'h1', 'About SpheroSeg');
  136 |     
  137 |     // Check about page content
  138 |     await expect(page.getByText('Our Mission')).toBeVisible();
  139 |     await expect(page.getByText('Our Technology')).toBeVisible();
  140 |     await expect(page.getByText('Our Team')).toBeVisible();
  141 |     await expect(page.getByText('Contact Us')).toBeVisible();
  142 |     
  143 |     // Check team members
  144 |     await expect(page.getByText('Michal Průšek')).toBeVisible();
  145 |     await expect(page.getByText('Adam Novozámský')).toBeVisible();
  146 |     
  147 |     // Check no translation keys are visible
  148 |     await checkNoTranslationKeys(page);
  149 |     
  150 |     // Check dynamic copyright year
  151 |     const currentYear = new Date().getFullYear();
  152 |     await expect(page.getByText(`© ${currentYear} Spheroid Segmentation Platform`)).toBeVisible();
  153 |   });
  154 |
  155 |   test('should handle 404 page for invalid routes', async ({ page }) => {
  156 |     await navigateAndWaitForLoad(page, '/invalid-route-that-does-not-exist');
  157 |     
  158 |     await checkPageTitle(page, 'SpheroSeg - Spheroid Segmentation Platform');
  159 |     await checkHeading(page, 'h1', 'Page not found');
  160 |     await expect(page.getByText('The page you requested could not be found')).toBeVisible();
  161 |     await expect(page.getByRole('link', { name: 'Return to Home' })).toBeVisible();
  162 |   });
  163 | });
```