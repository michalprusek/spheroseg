# Test info

- Name: Navigation >> should navigate to about page
- Location: /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/navigation.spec.ts:12:3

# Error details

```
Error: browserType.launch: 
╔══════════════════════════════════════════════════════╗
║ Host system is missing dependencies to run browsers. ║
║ Missing libraries:                                   ║
║     libgtk-4.so.1                                    ║
║     libgraphene-1.0.so.0                             ║
║     libwoff2dec.so.1.0.2                             ║
║     libvpx.so.9                                      ║
║     libevent-2.1.so.7                                ║
║     libgstallocators-1.0.so.0                        ║
║     libgstapp-1.0.so.0                               ║
║     libgstpbutils-1.0.so.0                           ║
║     libgstaudio-1.0.so.0                             ║
║     libgsttag-1.0.so.0                               ║
║     libgstvideo-1.0.so.0                             ║
║     libgstgl-1.0.so.0                                ║
║     libgstcodecparsers-1.0.so.0                      ║
║     libgstfft-1.0.so.0                               ║
║     libflite.so.1                                    ║
║     libflite_usenglish.so.1                          ║
║     libflite_cmu_grapheme_lang.so.1                  ║
║     libflite_cmu_grapheme_lex.so.1                   ║
║     libflite_cmu_indic_lang.so.1                     ║
║     libflite_cmu_indic_lex.so.1                      ║
║     libflite_cmulex.so.1                             ║
║     libflite_cmu_time_awb.so.1                       ║
║     libflite_cmu_us_awb.so.1                         ║
║     libflite_cmu_us_kal16.so.1                       ║
║     libflite_cmu_us_kal.so.1                         ║
║     libflite_cmu_us_rms.so.1                         ║
║     libflite_cmu_us_slt.so.1                         ║
║     libwebpdemux.so.2                                ║
║     libavif.so.16                                    ║
║     libharfbuzz-icu.so.0                             ║
║     libwebpmux.so.3                                  ║
║     libenchant-2.so.2                                ║
║     libsecret-1.so.0                                 ║
║     libhyphen.so.0                                   ║
║     libmanette-0.2.so.0                              ║
║     libx264.so                                       ║
╚══════════════════════════════════════════════════════╝
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
     |   ^ Error: browserType.launch: 
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