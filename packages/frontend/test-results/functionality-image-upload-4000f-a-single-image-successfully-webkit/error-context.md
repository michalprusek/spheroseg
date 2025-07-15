# Test info

- Name: Image Upload Functionality >> should upload a single image successfully
- Location: /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/functionality/image-upload.spec.ts:32:3

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
   2 | import path from 'path';
   3 |
   4 | // Test user credentials
   5 | const TEST_USER = {
   6 |   email: 'testuser@test.com',
   7 |   password: 'testuser123'
   8 | };
   9 |
   10 | // Helper to login
   11 | async function loginAsTestUser(page: any) {
   12 |   await page.goto('/signin');
   13 |   await page.fill('input[type="email"]', TEST_USER.email);
   14 |   await page.fill('input[type="password"]', TEST_USER.password);
   15 |   await page.click('button[type="submit"]');
   16 |   await page.waitForURL('/dashboard');
   17 | }
   18 |
   19 | // Helper to navigate to a project
   20 | async function navigateToProject(page: any, projectName: string) {
   21 |   await page.goto('/dashboard');
   22 |   await page.waitForSelector('text=' + projectName);
   23 |   await page.click(`text=${projectName}`);
   24 |   await page.waitForSelector('h1:has-text("' + projectName + '")');
   25 | }
   26 |
   27 | test.describe('Image Upload Functionality', () => {
   28 |   test.beforeEach(async ({ page }) => {
   29 |     await loginAsTestUser(page);
   30 |   });
   31 |
>  32 |   test('should upload a single image successfully', async ({ page }) => {
      |   ^ Error: browserType.launch: Executable doesn't exist at /home/cvat/.cache/ms-playwright/webkit-2158/pw_run.sh
   33 |     // Navigate to a project
   34 |     await navigateToProject(page, 'test2');
   35 |     
   36 |     // Click upload button
   37 |     await page.click('button:has-text("Upload Images")');
   38 |     
   39 |     // Wait for file input to be ready
   40 |     const fileInput = await page.locator('input[type="file"]');
   41 |     
   42 |     // Upload a test image
   43 |     const testImagePath = path.join(__dirname, '../fixtures/test-image.png');
   44 |     await fileInput.setInputFiles(testImagePath);
   45 |     
   46 |     // Wait for upload to complete
   47 |     await page.waitForSelector('text=Upload complete', { timeout: 30000 });
   48 |     
   49 |     // Verify image appears in gallery
   50 |     await expect(page.locator('.image-gallery img').last()).toBeVisible();
   51 |     
   52 |     // Verify the uploaded image has the correct status
   53 |     const lastImageStatus = await page.locator('.image-gallery .image-item').last().getAttribute('data-status');
   54 |     expect(lastImageStatus).toBe('without_segmentation');
   55 |   });
   56 |
   57 |   test('should upload multiple images successfully', async ({ page }) => {
   58 |     // Navigate to a project
   59 |     await navigateToProject(page, 'test2');
   60 |     
   61 |     // Get initial image count
   62 |     const initialImageCount = await page.locator('.image-gallery .image-item').count();
   63 |     
   64 |     // Click upload button
   65 |     await page.click('button:has-text("Upload Images")');
   66 |     
   67 |     // Upload multiple test images
   68 |     const fileInput = await page.locator('input[type="file"]');
   69 |     const testImages = [
   70 |       path.join(__dirname, '../fixtures/test-image-1.png'),
   71 |       path.join(__dirname, '../fixtures/test-image-2.png'),
   72 |       path.join(__dirname, '../fixtures/test-image-3.png')
   73 |     ];
   74 |     await fileInput.setInputFiles(testImages);
   75 |     
   76 |     // Wait for all uploads to complete
   77 |     await page.waitForSelector('text=3 files uploaded successfully', { timeout: 30000 });
   78 |     
   79 |     // Verify all images appear in gallery
   80 |     const newImageCount = await page.locator('.image-gallery .image-item').count();
   81 |     expect(newImageCount).toBe(initialImageCount + 3);
   82 |   });
   83 |
   84 |   test('should show upload progress', async ({ page }) => {
   85 |     // Navigate to a project
   86 |     await navigateToProject(page, 'test2');
   87 |     
   88 |     // Click upload button
   89 |     await page.click('button:has-text("Upload Images")');
   90 |     
   91 |     // Upload a large test image to see progress
   92 |     const fileInput = await page.locator('input[type="file"]');
   93 |     const testImagePath = path.join(__dirname, '../fixtures/large-test-image.png');
   94 |     await fileInput.setInputFiles(testImagePath);
   95 |     
   96 |     // Verify progress bar appears
   97 |     await expect(page.locator('.upload-progress')).toBeVisible();
   98 |     await expect(page.locator('.upload-progress .progress-bar')).toBeVisible();
   99 |     
  100 |     // Wait for upload to complete
  101 |     await page.waitForSelector('text=Upload complete', { timeout: 30000 });
  102 |     
  103 |     // Verify progress bar disappears
  104 |     await expect(page.locator('.upload-progress')).not.toBeVisible();
  105 |   });
  106 |
  107 |   test('should handle upload errors gracefully', async ({ page }) => {
  108 |     // Navigate to a project
  109 |     await navigateToProject(page, 'test2');
  110 |     
  111 |     // Click upload button
  112 |     await page.click('button:has-text("Upload Images")');
  113 |     
  114 |     // Try to upload an invalid file type
  115 |     const fileInput = await page.locator('input[type="file"]');
  116 |     const invalidFilePath = path.join(__dirname, '../fixtures/invalid-file.txt');
  117 |     await fileInput.setInputFiles(invalidFilePath);
  118 |     
  119 |     // Verify error message appears
  120 |     await expect(page.locator('text=Only image files are allowed')).toBeVisible();
  121 |   });
  122 |
  123 |   test('should update image gallery immediately after upload', async ({ page }) => {
  124 |     // Navigate to a project
  125 |     await navigateToProject(page, 'test2');
  126 |     
  127 |     // Get initial gallery state
  128 |     const initialImages = await page.locator('.image-gallery .image-item').all();
  129 |     const initialImageNames = await Promise.all(
  130 |       initialImages.map(img => img.getAttribute('data-name'))
  131 |     );
  132 |     
```