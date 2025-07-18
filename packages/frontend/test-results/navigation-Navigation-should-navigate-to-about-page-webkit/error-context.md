# Test info

- Name: Navigation >> should navigate to about page
- Location: /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/navigation.spec.ts:12:3

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
   1 | import { test, expect } from '@playwright/test';
   2 |
   3 | test.describe('Navigation', () => {
   4 |   test('should navigate to home page', async ({ page }) => {
   5 |     await page.goto('/');
   6 |     
   7 |     // Check if home page elements are visible
   8 |     await expect(page.getByText('AI-powered Cell Analysis for Biomedical Research')).toBeVisible();
   9 |     await expect(page.getByText('Get Started')).toBeVisible();
  10 |   });
  11 |
> 12 |   test('should navigate to about page', async ({ page }) => {
     |   ^ Error: browserType.launch: Executable doesn't exist at /home/cvat/.cache/ms-playwright/webkit-2158/pw_run.sh
  13 |     await page.goto('/');
  14 |     
  15 |     // About link doesn't exist on home page, so navigate directly
  16 |     await page.goto('/about');
  17 |     
  18 |     // Check if on about page
  19 |     await expect(page).toHaveURL('/about');
  20 |     await expect(page.getByRole('heading', { name: /About/i })).toBeVisible();
  21 |   });
  22 |
  23 |   test('should navigate to documentation page', async ({ page }) => {
  24 |     await page.goto('/');
  25 |     
  26 |     // Click on Documentation link
  27 |     await page.getByRole('link', { name: /Documentation/i }).click();
  28 |     
  29 |     // Check if on documentation page
  30 |     await expect(page).toHaveURL('/documentation');
  31 |     await expect(page.getByRole('heading', { name: /Documentation/i })).toBeVisible();
  32 |   });
  33 |
  34 |   test('mobile menu should work', async ({ page }) => {
  35 |     // Set mobile viewport
  36 |     await page.setViewportSize({ width: 375, height: 667 });
  37 |     
  38 |     await page.goto('/');
  39 |     
  40 |     // Open mobile menu (hamburger icon)
  41 |     await page.locator('button[aria-label*="menu" i], button:has(svg.lucide-menu)').click();
  42 |     
  43 |     // Check if menu items are visible
  44 |     await expect(page.getByRole('link', { name: /about/i })).toBeVisible();
  45 |     await expect(page.getByRole('link', { name: /documentation/i })).toBeVisible();
  46 |     await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
  47 |   });
  48 | });
```