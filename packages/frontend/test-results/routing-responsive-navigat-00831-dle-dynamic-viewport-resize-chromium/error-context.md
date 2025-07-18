# Test info

- Name: Responsive Navigation >> should handle dynamic viewport resize
- Location: /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/routing/responsive-navigation.spec.ts:128:3

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
   28 |     });
   29 |
   30 |     test('should navigate using mobile menu', async ({ page }) => {
   31 |       // Set mobile viewport size
   32 |       await page.setViewportSize({ width: 390, height: 844 });
   33 |       
   34 |       await navigateAndWaitForLoad(page, urls.home);
   35 |       
   36 |       // Open mobile menu
   37 |       const mobileMenuButton = page.locator('button[aria-label="Toggle navigation menu"]');
   38 |       await mobileMenuButton.click();
   39 |       
   40 |       // Navigate to documentation
   41 |       await page.getByRole('link', { name: 'Documentation' }).click();
   42 |       await expect(page).toHaveURL(urls.documentation);
   43 |       
   44 |       // Menu should close after navigation
   45 |       await expect(page.getByRole('link', { name: 'Documentation' }).first()).toBeHidden();
   46 |     });
   47 |
   48 |     test('should handle mobile viewport for all pages', async ({ page }) => {
   49 |       // Set mobile viewport size
   50 |       await page.setViewportSize({ width: 390, height: 844 });
   51 |       
   52 |       const pagesToTest = [
   53 |         { url: urls.home, title: 'AI-powered Cell Analysis' },
   54 |         { url: urls.documentation, title: 'SpheroSeg Documentation' },
   55 |         { url: urls.about, title: 'About SpheroSeg' },
   56 |         { url: urls.termsOfService, title: 'Terms of Service' },
   57 |         { url: urls.privacyPolicy, title: 'Privacy Policy' },
   58 |       ];
   59 |
   60 |       for (const pageInfo of pagesToTest) {
   61 |         await navigateAndWaitForLoad(page, pageInfo.url);
   62 |         
   63 |         // Check that content is visible and not cut off
   64 |         await expect(page.locator('h1').filter({ hasText: pageInfo.title })).toBeVisible();
   65 |         
   66 |         // Check horizontal scroll
   67 |         const hasHorizontalScroll = await page.evaluate(() => {
   68 |           return document.documentElement.scrollWidth > document.documentElement.clientWidth;
   69 |         });
   70 |         expect(hasHorizontalScroll).toBe(false);
   71 |       }
   72 |     });
   73 |   });
   74 |
   75 |   test.describe('Tablet Navigation', () => {
   76 |     test('should display appropriate navigation on tablet', async ({ page }) => {
   77 |       // Set tablet viewport size
   78 |       await page.setViewportSize({ width: 768, height: 1024 });
   79 |       await navigateAndWaitForLoad(page, urls.home);
   80 |       
   81 |       // Check if navigation is properly displayed
   82 |       await expect(page.locator(selectors.navigation.documentation).first()).toBeVisible();
   83 |       await expect(page.locator(selectors.navigation.termsOfService).first()).toBeVisible();
   84 |       
   85 |       // Check layout is appropriate for tablet
   86 |       const viewportSize = page.viewportSize();
   87 |       expect(viewportSize?.width).toBeGreaterThan(700);
   88 |     });
   89 |   });
   90 |
   91 |   test.describe('Desktop Navigation', () => {
   92 |     test.use({ viewport: { width: 1920, height: 1080 } });
   93 |
   94 |     test('should display full navigation on desktop', async ({ page }) => {
   95 |       await navigateAndWaitForLoad(page, urls.home);
   96 |       
   97 |       // All navigation items should be visible
   98 |       await expect(page.locator(selectors.navigation.home).first()).toBeVisible();
   99 |       await expect(page.locator(selectors.navigation.documentation).first()).toBeVisible();
  100 |       await expect(page.locator(selectors.navigation.termsOfService).first()).toBeVisible();
  101 |       await expect(page.locator(selectors.navigation.privacyPolicy).first()).toBeVisible();
  102 |       await expect(page.locator(selectors.navigation.signIn).first()).toBeVisible();
  103 |       await expect(page.locator(selectors.navigation.requestAccess).first()).toBeVisible();
  104 |       
  105 |       // Language switcher and theme toggle should be visible
  106 |       await expect(page.locator(selectors.languageSwitcher)).toBeVisible();
  107 |       await expect(page.locator(selectors.themeToggle)).toBeVisible();
  108 |     });
  109 |   });
  110 |
  111 |   test('should handle orientation change', async ({ page, context }) => {
  112 |     // Start in portrait mode
  113 |     await context.setViewportSize({ width: 414, height: 896 });
  114 |     await navigateAndWaitForLoad(page, urls.home);
  115 |     
  116 |     // Check mobile menu is visible
  117 |     const mobileMenuButton = page.locator('button[aria-label="Toggle navigation menu"]');
  118 |     await expect(mobileMenuButton).toBeVisible();
  119 |     
  120 |     // Change to landscape
  121 |     await context.setViewportSize({ width: 896, height: 414 });
  122 |     
  123 |     // Navigation might change based on breakpoints
  124 |     // This test ensures the page handles orientation change without breaking
  125 |     await expect(page.locator('h1')).toBeVisible();
  126 |   });
  127 |
> 128 |   test('should handle dynamic viewport resize', async ({ page }) => {
      |   ^ Error: browserType.launch: Executable doesn't exist at /home/cvat/.cache/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell
  129 |     await navigateAndWaitForLoad(page, urls.home);
  130 |     
  131 |     // Start with desktop size
  132 |     await page.setViewportSize({ width: 1200, height: 800 });
  133 |     await expect(page.locator(selectors.navigation.documentation).first()).toBeVisible();
  134 |     
  135 |     // Resize to mobile
  136 |     await page.setViewportSize({ width: 375, height: 667 });
  137 |     
  138 |     // Mobile menu should appear
  139 |     const mobileMenuButton = page.locator('button[aria-label="Toggle navigation menu"]');
  140 |     await expect(mobileMenuButton).toBeVisible();
  141 |     
  142 |     // Resize back to desktop
  143 |     await page.setViewportSize({ width: 1200, height: 800 });
  144 |     
  145 |     // Desktop navigation should reappear
  146 |     await expect(page.locator(selectors.navigation.documentation).first()).toBeVisible();
  147 |   });
  148 |
  149 |   test('should maintain functionality across different screen sizes', async ({ page }) => {
  150 |     const viewports = [
  151 |       { name: 'Mobile', width: 375, height: 667 },
  152 |       { name: 'Tablet', width: 768, height: 1024 },
  153 |       { name: 'Desktop', width: 1920, height: 1080 },
  154 |     ];
  155 |
  156 |     for (const viewport of viewports) {
  157 |       await page.setViewportSize({ width: viewport.width, height: viewport.height });
  158 |       await navigateAndWaitForLoad(page, urls.home);
  159 |       
  160 |       // Core elements should be visible at all sizes
  161 |       await expect(page.locator('h1')).toBeVisible();
  162 |       await expect(page.locator(selectors.logo)).toBeVisible();
  163 |       
  164 |       // Footer should be accessible
  165 |       await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  166 |       await expect(page.locator('footer')).toBeVisible();
  167 |     }
  168 |   });
  169 | });
```