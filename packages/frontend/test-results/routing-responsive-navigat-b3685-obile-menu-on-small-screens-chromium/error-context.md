# Test info

- Name: Responsive Navigation >> Mobile Navigation >> should display mobile menu on small screens
- Location: /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/routing/responsive-navigation.spec.ts:6:5

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
   2 | import { devices } from '@playwright/test';
   3 |
   4 | test.describe('Responsive Navigation', () => {
   5 |   test.describe('Mobile Navigation', () => {
>  6 |     test('should display mobile menu on small screens', async ({ page, context }) => {
     |     ^ Error: browserType.launch: Executable doesn't exist at /home/cvat/.cache/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell
   7 |       // Set mobile viewport size
   8 |       await page.setViewportSize({ width: 390, height: 844 });
   9 |       
   10 |       await navigateAndWaitForLoad(page, urls.home);
   11 |       
   12 |       // Mobile menu button should be visible
   13 |       const mobileMenuButton = page.locator('button[aria-label="Toggle navigation menu"]');
   14 |       await expect(mobileMenuButton).toBeVisible();
   15 |       
   16 |       // Desktop navigation should be hidden
   17 |       const desktopNav = page.locator('nav').filter({ hasText: 'Documentation' }).first();
   18 |       await expect(desktopNav).toBeHidden();
   19 |       
   20 |       // Open mobile menu
   21 |       await mobileMenuButton.click();
   22 |       
   23 |       // Mobile navigation links should be visible
   24 |       await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
   25 |       await expect(page.getByRole('link', { name: 'Documentation' })).toBeVisible();
   26 |       await expect(page.getByRole('link', { name: 'Terms' })).toBeVisible();
   27 |       await expect(page.getByRole('link', { name: 'Privacy' })).toBeVisible();
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
```