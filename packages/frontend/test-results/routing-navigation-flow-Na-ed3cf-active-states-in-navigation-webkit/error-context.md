# Test info

- Name: Navigation Flow and Links >> should display correct active states in navigation
- Location: /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/routing/navigation-flow.spec.ts:137:3

# Error details

```
Error: browserType.launch: Executable doesn't exist at /home/cvat/.cache/ms-playwright/webkit-2158/pw_run.sh
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
  125 |
  126 |   test('should handle external links correctly', async ({ page }) => {
  127 |     // Check external links in footer open in new tab
  128 |     const [newPage] = await Promise.all([
  129 |       page.waitForEvent('popup'),
  130 |       page.locator('footer').getByRole('link', { name: 'FNSPE CTU in Prague' }).click()
  131 |     ]);
  132 |     
  133 |     await expect(newPage).toHaveURL(/fjfi\.cvut\.cz/);
  134 |     await newPage.close();
  135 |   });
  136 |
> 137 |   test('should display correct active states in navigation', async ({ page }) => {
      |   ^ Error: browserType.launch: Executable doesn't exist at /home/cvat/.cache/ms-playwright/webkit-2158/pw_run.sh
  138 |     // Check documentation page
  139 |     await page.click(selectors.navigation.documentation);
  140 |     const docLink = page.locator(selectors.navigation.documentation).first();
  141 |     
  142 |     // The active link might have different styling - check if it's visible and enabled
  143 |     await expect(docLink).toBeVisible();
  144 |     await expect(docLink).toBeEnabled();
  145 |   });
  146 |
  147 |   test('should handle navigation with hash links correctly', async ({ page }) => {
  148 |     await page.click(selectors.navigation.documentation);
  149 |     await expect(page).toHaveURL(urls.documentation);
  150 |     
  151 |     // Click on section link
  152 |     await page.click('a[href="#getting-started"]');
  153 |     await expect(page).toHaveURL(urls.documentation + '#getting-started');
  154 |     
  155 |     // Check that the section is visible
  156 |     await expect(page.locator('#getting-started')).toBeInViewport();
  157 |   });
  158 |
  159 |   test('should preserve query parameters during navigation', async ({ page }) => {
  160 |     // Navigate with query params
  161 |     await navigateAndWaitForLoad(page, urls.home + '?ref=test&utm_source=e2e');
  162 |     
  163 |     // Click on documentation link
  164 |     await page.click(selectors.navigation.documentation);
  165 |     
  166 |     // Query params might not be preserved by default - this is expected behavior
  167 |     await expect(page).toHaveURL(urls.documentation);
  168 |   });
  169 | });
```