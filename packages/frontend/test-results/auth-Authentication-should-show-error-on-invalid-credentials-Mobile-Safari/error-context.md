# Test info

- Name: Authentication >> should show error on invalid credentials
- Location: /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/auth.spec.ts:14:3

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
   3 | test.describe('Authentication', () => {
   4 |   test('should display login page', async ({ page }) => {
   5 |     await page.goto('/sign-in');
   6 |     
   7 |     // Check if login form is visible
   8 |     await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
   9 |     await expect(page.locator('input[type="email"]')).toBeVisible();
  10 |     await expect(page.locator('input[type="password"]')).toBeVisible();
  11 |     await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  12 |   });
  13 |
> 14 |   test('should show error on invalid credentials', async ({ page }) => {
     |   ^ Error: browserType.launch: 
  15 |     await page.goto('/sign-in');
  16 |     
  17 |     // Fill in invalid credentials
  18 |     await page.locator('input[type="email"]').fill('invalid@example.com');
  19 |     await page.locator('input[type="password"]').fill('wrongpassword');
  20 |     await page.getByRole('button', { name: /sign in/i }).click();
  21 |     
  22 |     // Check for error message (toast notification)
  23 |     await expect(page.getByText(/invalid/i)).toBeVisible();
  24 |   });
  25 |
  26 |   test('should redirect to dashboard after successful login', async ({ page }) => {
  27 |     await page.goto('/sign-in');
  28 |     
  29 |     // Fill in valid test credentials
  30 |     await page.locator('input[type="email"]').fill('testuser@test.com');
  31 |     await page.locator('input[type="password"]').fill('testuser123');
  32 |     await page.getByRole('button', { name: /sign in/i }).click();
  33 |     
  34 |     // Should redirect to dashboard
  35 |     await expect(page).toHaveURL('/dashboard');
  36 |     await expect(page.getByText(/dashboard|welcome/i)).toBeVisible();
  37 |   });
  38 |
  39 |   test('should allow user to sign out', async ({ page }) => {
  40 |     // First login
  41 |     await page.goto('/sign-in');
  42 |     await page.locator('input[type="email"]').fill('testuser@test.com');
  43 |     await page.locator('input[type="password"]').fill('testuser123');
  44 |     await page.getByRole('button', { name: /sign in/i }).click();
  45 |     
  46 |     // Wait for dashboard
  47 |     await expect(page).toHaveURL('/dashboard');
  48 |     
  49 |     // Click user menu and sign out
  50 |     await page.getByRole('button', { name: /menu|profile|user/i }).click();
  51 |     await page.getByRole('menuitem', { name: /sign out|logout/i }).click();
  52 |     
  53 |     // Should redirect to home or signin
  54 |     await expect(page).toHaveURL(/\/(signin|$)/);
  55 |   });
  56 | });
```