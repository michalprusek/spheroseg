# Test info

- Name: Authentication >> should redirect to dashboard after successful login
- Location: /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/auth.spec.ts:26:3

# Error details

```
Error: Timed out 5000ms waiting for expect(locator).toHaveURL(expected)

Locator: locator(':root')
Expected string: "http://localhost:3000/dashboard"
Received string: "http://localhost:3000/sign-in"
Call log:
  - expect.toHaveURL with timeout 5000ms
  - waiting for locator(':root')
    9 × locator resolved to <html lang="en" class="light" data-theme="light">…</html>
      - unexpected value "http://localhost:3000/sign-in"

    at /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/auth.spec.ts:35:24
```

# Page snapshot

```yaml
- link "Skip to main content":
  - /url: "#main-content"
- main:
  - button "Back to Home":
    - img
    - text: Home
  - button "Language EN":
    - img
    - text: Language EN
  - heading "Sign In" [level=2]
  - paragraph: Sign in to your account
  - text: Email address
  - textbox "Email address": testuser@test.com
  - text: Password
  - textbox "Password": testuser123
  - link "Forgot password?":
    - /url: /forgot-password
  - checkbox "Remember me"
  - text: Remember me
  - button "Sign In"
  - text: Don't have an account?
  - link "Sign Up":
    - /url: /sign-up
    - button "Sign Up"
  - link "Request Access":
    - /url: /request-access
    - button "Request Access"
  - paragraph:
    - text: By signing up, you agree to our Terms of Service and Privacy Policy.
    - link "Terms of Service":
      - /url: /terms-of-service
    - text: and
    - link "Privacy Policy":
      - /url: /privacy-policy
- region "Notifications alt+T":
  - list:
    - listitem:
      - button "Close toast":
        - img
      - img
      - text: Login failed Request failed with status code 405
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
> 35 |     await expect(page).toHaveURL('/dashboard');
     |                        ^ Error: Timed out 5000ms waiting for expect(locator).toHaveURL(expected)
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