# Test info

- Name: Image Gallery Refresh After Upload >> should immediately show uploaded image in gallery
- Location: /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/functionality/image-gallery-refresh.spec.ts:32:3

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
   27 | test.describe('Image Gallery Refresh After Upload', () => {
   28 |   test.beforeEach(async ({ page }) => {
   29 |     await loginAsTestUser(page);
   30 |   });
   31 |
>  32 |   test('should immediately show uploaded image in gallery', async ({ page }) => {
      |   ^ Error: browserType.launch: Executable doesn't exist at /home/cvat/.cache/ms-playwright/webkit-2158/pw_run.sh
   33 |     // Navigate to project
   34 |     await navigateToProject(page, 'test2');
   35 |     
   36 |     // Get initial gallery state
   37 |     const galleryContainer = await page.locator('.image-gallery');
   38 |     const initialImageCount = await galleryContainer.locator('.image-item').count();
   39 |     
   40 |     // Take screenshot of initial state
   41 |     const initialGalleryState = await galleryContainer.screenshot();
   42 |     
   43 |     // Upload new image
   44 |     await page.click('button:has-text("Upload Images")');
   45 |     const fileInput = await page.locator('input[type="file"]');
   46 |     const testImagePath = path.join(__dirname, '../fixtures/gallery-test-1.png');
   47 |     await fileInput.setInputFiles(testImagePath);
   48 |     
   49 |     // Wait for upload completion
   50 |     await page.waitForSelector('text=Upload complete', { timeout: 30000 });
   51 |     
   52 |     // Verify gallery updated without page refresh
   53 |     const newImageCount = await galleryContainer.locator('.image-item').count();
   54 |     expect(newImageCount).toBe(initialImageCount + 1);
   55 |     
   56 |     // Verify the new image is visible
   57 |     const newImage = await galleryContainer.locator('.image-item').last();
   58 |     await expect(newImage).toBeVisible();
   59 |     
   60 |     // Verify gallery visually changed
   61 |     const newGalleryState = await galleryContainer.screenshot();
   62 |     expect(Buffer.compare(initialGalleryState, newGalleryState)).not.toBe(0);
   63 |   });
   64 |
   65 |   test('should maintain gallery sort order after upload', async ({ page }) => {
   66 |     // Navigate to project
   67 |     await navigateToProject(page, 'test2');
   68 |     
   69 |     // Check current sort order
   70 |     const sortSelector = await page.locator('.gallery-sort-selector');
   71 |     const currentSort = await sortSelector.inputValue();
   72 |     
   73 |     // Get first few image names before upload
   74 |     const imageItems = await page.locator('.image-gallery .image-item').all();
   75 |     const initialOrder = await Promise.all(
   76 |       imageItems.slice(0, 3).map(item => item.getAttribute('data-name'))
   77 |     );
   78 |     
   79 |     // Upload new image
   80 |     await page.click('button:has-text("Upload Images")');
   81 |     const fileInput = await page.locator('input[type="file"]');
   82 |     const testImagePath = path.join(__dirname, '../fixtures/gallery-test-2.png');
   83 |     await fileInput.setInputFiles(testImagePath);
   84 |     
   85 |     await page.waitForSelector('text=Upload complete', { timeout: 30000 });
   86 |     
   87 |     // Verify sort order is maintained
   88 |     const newSortValue = await sortSelector.inputValue();
   89 |     expect(newSortValue).toBe(currentSort);
   90 |     
   91 |     // If sorted by date (newest first), new image should be first
   92 |     if (currentSort === 'date-desc') {
   93 |       const firstImage = await page.locator('.image-gallery .image-item').first();
   94 |       const firstName = await firstImage.getAttribute('data-name');
   95 |       expect(firstName).toContain('gallery-test-2');
   96 |     }
   97 |   });
   98 |
   99 |   test('should update gallery pagination after upload', async ({ page }) => {
  100 |     // Navigate to project
  101 |     await navigateToProject(page, 'test2');
  102 |     
  103 |     // Check if pagination exists
  104 |     const pagination = await page.locator('.gallery-pagination');
  105 |     if (await pagination.isVisible()) {
  106 |       // Get current page info
  107 |       const pageInfo = await pagination.locator('.page-info').textContent();
  108 |       const totalMatch = pageInfo?.match(/of (\d+)/);
  109 |       const initialTotal = totalMatch ? parseInt(totalMatch[1]) : 0;
  110 |       
  111 |       // Upload new image
  112 |       await page.click('button:has-text("Upload Images")');
  113 |       const fileInput = await page.locator('input[type="file"]');
  114 |       const testImagePath = path.join(__dirname, '../fixtures/gallery-test-3.png');
  115 |       await fileInput.setInputFiles(testImagePath);
  116 |       
  117 |       await page.waitForSelector('text=Upload complete', { timeout: 30000 });
  118 |       
  119 |       // Verify total count increased
  120 |       const newPageInfo = await pagination.locator('.page-info').textContent();
  121 |       const newTotalMatch = newPageInfo?.match(/of (\d+)/);
  122 |       const newTotal = newTotalMatch ? parseInt(newTotalMatch[1]) : 0;
  123 |       
  124 |       expect(newTotal).toBe(initialTotal + 1);
  125 |     }
  126 |   });
  127 |
  128 |   test('should preserve gallery filters after upload', async ({ page }) => {
  129 |     // Navigate to project
  130 |     await navigateToProject(page, 'test2');
  131 |     
  132 |     // Apply a filter (e.g., show only completed)
```