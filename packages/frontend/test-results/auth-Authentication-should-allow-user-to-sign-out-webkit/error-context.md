# Test info

- Name: Authentication >> should allow user to sign out
- Location: /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/auth.spec.ts:39:3

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
  14 |   test('should show error on invalid credentials', async ({ page }) => {
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
> 39 |   test('should allow user to sign out', async ({ page }) => {
     |   ^ Error: browserType.launch: Executable doesn't exist at /home/cvat/.cache/ms-playwright/webkit-2158/pw_run.sh
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