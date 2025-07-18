# Test info

- Name: Project Management >> should open create project dialog
- Location: /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/project.spec.ts:21:3

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
   3 | test.describe('Project Management', () => {
   4 |   test.beforeEach(async ({ page }) => {
   5 |     // Login before each test
   6 |     await page.goto('/signin');
   7 |     await page.locator('input[type="email"]').fill('testuser@test.com');
   8 |     await page.locator('input[type="password"]').fill('testuser123');
   9 |     await page.getByRole('button', { name: /sign in/i }).click();
  10 |     await expect(page).toHaveURL('/dashboard');
  11 |   });
  12 |
  13 |   test('should display project list', async ({ page }) => {
  14 |     // Navigate to projects tab
  15 |     await page.getByRole('tab', { name: /Projects/i }).click();
  16 |     
  17 |     // Check if project list is visible
  18 |     await expect(page.getByText(/Your Projects/i)).toBeVisible();
  19 |   });
  20 |
> 21 |   test('should open create project dialog', async ({ page }) => {
     |   ^ Error: browserType.launch: Executable doesn't exist at /home/cvat/.cache/ms-playwright/webkit-2158/pw_run.sh
  22 |     // Click create project button
  23 |     await page.getByRole('button', { name: /new project/i }).click();
  24 |     
  25 |     // Check if dialog is open
  26 |     await expect(page.getByRole('dialog')).toBeVisible();
  27 |     await expect(page.locator('input[name="name"], input[placeholder*="project name" i]')).toBeVisible();
  28 |     await expect(page.locator('textarea[name="description"], textarea[placeholder*="description" i]')).toBeVisible();
  29 |   });
  30 |
  31 |   test('should create a new project', async ({ page }) => {
  32 |     // Open create project dialog
  33 |     await page.getByRole('button', { name: /new project/i }).click();
  34 |     
  35 |     // Fill in project details
  36 |     const projectName = `Test Project ${Date.now()}`;
  37 |     await page.locator('input[name="name"], input[placeholder*="project name" i]').fill(projectName);
  38 |     await page.locator('textarea[name="description"], textarea[placeholder*="description" i]').fill('This is a test project created by E2E tests');
  39 |     
  40 |     // Submit form
  41 |     await page.getByRole('button', { name: /create/i }).click();
  42 |     
  43 |     // Check if project was created and appears in list
  44 |     await expect(page.getByText(projectName)).toBeVisible();
  45 |   });
  46 |
  47 |   test('should navigate to project detail page', async ({ page }) => {
  48 |     // Navigate to projects tab
  49 |     await page.getByRole('tab', { name: /Projects/i }).click();
  50 |     
  51 |     // Click on first project card
  52 |     const firstProject = page.locator('.project-card').first();
  53 |     await firstProject.click();
  54 |     
  55 |     // Check if on project detail page
  56 |     await expect(page.url()).toMatch(/\/project\/\d+/);
  57 |     await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  58 |   });
  59 |
  60 |   test('should upload an image to project', async ({ page }) => {
  61 |     // Navigate to a project
  62 |     await page.getByRole('tab', { name: /projects/i }).click();
  63 |     const firstProject = page.locator('.project-card, [data-testid="project-card"]').first();
  64 |     await firstProject.click();
  65 |     
  66 |     // Open upload dialog
  67 |     await page.getByRole('button', { name: /upload.*image/i }).click();
  68 |     
  69 |     // Check if upload dialog is visible
  70 |     await expect(page.getByRole('dialog')).toBeVisible();
  71 |     await expect(page.getByText(/drop.*image|drag.*drop/i)).toBeVisible();
  72 |   });
  73 | });
```