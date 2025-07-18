# Test info

- Name: Navigation Flow and Links >> should navigate between pages using footer links
- Location: /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/routing/navigation-flow.spec.ts:24:3

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
   1 | import { test, expect, selectors, urls, navigateAndWaitForLoad } from '../fixtures';
   2 |
   3 | test.describe('Navigation Flow and Links', () => {
   4 |   test.beforeEach(async ({ page }) => {
   5 |     await navigateAndWaitForLoad(page, urls.home);
   6 |   });
   7 |
   8 |   test('should navigate between pages using navigation menu', async ({ page }) => {
   9 |     // Test navigation menu flow
   10 |     await page.click(selectors.navigation.documentation);
   11 |     await expect(page).toHaveURL(urls.documentation);
   12 |     
   13 |     await page.click(selectors.navigation.termsOfService);
   14 |     await expect(page).toHaveURL(urls.termsOfService);
   15 |     
   16 |     await page.click(selectors.navigation.privacyPolicy);
   17 |     await expect(page).toHaveURL(urls.privacyPolicy);
   18 |     
   19 |     // Navigate back to home using logo
   20 |     await page.click(selectors.logo);
   21 |     await expect(page).toHaveURL(urls.home);
   22 |   });
   23 |
>  24 |   test('should navigate between pages using footer links', async ({ page }) => {
      |   ^ Error: browserType.launch: Executable doesn't exist at /home/cvat/.cache/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell
   25 |     // Scroll to footer
   26 |     await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
   27 |     
   28 |     // Test footer navigation
   29 |     await page.locator('footer').getByRole('link', { name: 'Documentation' }).click();
   30 |     await expect(page).toHaveURL(urls.documentation);
   31 |     
   32 |     await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
   33 |     await page.locator('footer').getByRole('link', { name: 'Terms of Service' }).click();
   34 |     await expect(page).toHaveURL(urls.termsOfService);
   35 |     
   36 |     await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
   37 |     await page.locator('footer').getByRole('link', { name: 'Privacy Policy' }).click();
   38 |     await expect(page).toHaveURL(urls.privacyPolicy);
   39 |   });
   40 |
   41 |   test('should navigate from sign in to sign up and back', async ({ page }) => {
   42 |     // Go to sign in
   43 |     await page.click(selectors.navigation.signIn);
   44 |     await expect(page).toHaveURL(urls.signIn);
   45 |     
   46 |     // Navigate to sign up from sign in page
   47 |     await page.click('text=Sign Up');
   48 |     await expect(page).toHaveURL(urls.signUp);
   49 |     
   50 |     // Navigate back to sign in from sign up page
   51 |     await page.click('text=Sign In');
   52 |     await expect(page).toHaveURL(urls.signIn);
   53 |     
   54 |     // Navigate to forgot password
   55 |     await page.click('text=Forgot password?');
   56 |     await expect(page).toHaveURL(urls.forgotPassword);
   57 |     
   58 |     // Navigate back to sign in
   59 |     await page.click('text=Back to Sign In');
   60 |     await expect(page).toHaveURL(urls.signIn);
   61 |   });
   62 |
   63 |   test('should navigate to request access from multiple entry points', async ({ page }) => {
   64 |     // From main navigation
   65 |     await page.click(selectors.navigation.requestAccess);
   66 |     await expect(page).toHaveURL(urls.requestAccess);
   67 |     
   68 |     // Back to home
   69 |     await page.click(selectors.logo);
   70 |     await expect(page).toHaveURL(urls.home);
   71 |     
   72 |     // From footer
   73 |     await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
   74 |     await page.locator('footer').getByRole('link', { name: 'Request Access' }).click();
   75 |     await expect(page).toHaveURL(urls.requestAccess);
   76 |   });
   77 |
   78 |   test('should handle browser back/forward navigation correctly', async ({ page }) => {
   79 |     // Navigate through multiple pages
   80 |     await page.click(selectors.navigation.documentation);
   81 |     await expect(page).toHaveURL(urls.documentation);
   82 |     
   83 |     await page.click(selectors.navigation.about);
   84 |     await expect(page).toHaveURL(urls.about);
   85 |     
   86 |     await page.click(selectors.navigation.termsOfService);
   87 |     await expect(page).toHaveURL(urls.termsOfService);
   88 |     
   89 |     // Test browser back button
   90 |     await page.goBack();
   91 |     await expect(page).toHaveURL(urls.about);
   92 |     
   93 |     await page.goBack();
   94 |     await expect(page).toHaveURL(urls.documentation);
   95 |     
   96 |     await page.goBack();
   97 |     await expect(page).toHaveURL(urls.home);
   98 |     
   99 |     // Test browser forward button
  100 |     await page.goForward();
  101 |     await expect(page).toHaveURL(urls.documentation);
  102 |     
  103 |     await page.goForward();
  104 |     await expect(page).toHaveURL(urls.about);
  105 |   });
  106 |
  107 |   test('should maintain scroll position when navigating back', async ({ page }) => {
  108 |     // Scroll down on home page
  109 |     await page.evaluate(() => window.scrollTo(0, 500));
  110 |     const initialScrollY = await page.evaluate(() => window.scrollY);
  111 |     expect(initialScrollY).toBeGreaterThan(0);
  112 |     
  113 |     // Navigate to another page
  114 |     await page.click(selectors.navigation.documentation);
  115 |     await expect(page).toHaveURL(urls.documentation);
  116 |     
  117 |     // Go back
  118 |     await page.goBack();
  119 |     await expect(page).toHaveURL(urls.home);
  120 |     
  121 |     // Check if scroll position is maintained (might not be exact due to async loading)
  122 |     const finalScrollY = await page.evaluate(() => window.scrollY);
  123 |     expect(finalScrollY).toBeGreaterThanOrEqual(0);
  124 |   });
```