# Test info

- Name: Image Gallery Refresh After Upload >> should preserve gallery filters after upload
- Location: /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/functionality/image-gallery-refresh.spec.ts:128:3

# Error details

```
Error: browserType.launch: Executable doesn't exist at /home/cvat/.cache/ms-playwright/firefox-1482/firefox/firefox
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
   28 |   test.beforeEach(async ({ page }) => {
   29 |     await loginAsTestUser(page);
   30 |   });
   31 |
   32 |   test('should immediately show uploaded image in gallery', async ({ page }) => {
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
> 128 |   test('should preserve gallery filters after upload', async ({ page }) => {
      |   ^ Error: browserType.launch: Executable doesn't exist at /home/cvat/.cache/ms-playwright/firefox-1482/firefox/firefox
  129 |     // Navigate to project
  130 |     await navigateToProject(page, 'test2');
  131 |     
  132 |     // Apply a filter (e.g., show only completed)
  133 |     const filterButton = await page.locator('button:has-text("Filter")');
  134 |     if (await filterButton.isVisible()) {
  135 |       await filterButton.click();
  136 |       await page.click('label:has-text("Completed")');
  137 |       await page.click('button:has-text("Apply")');
  138 |       
  139 |       // Get filtered count
  140 |       const filteredCount = await page.locator('.image-gallery .image-item').count();
  141 |       
  142 |       // Upload new image
  143 |       await page.click('button:has-text("Upload Images")');
  144 |       const fileInput = await page.locator('input[type="file"]');
  145 |       const testImagePath = path.join(__dirname, '../fixtures/gallery-test-4.png');
  146 |       await fileInput.setInputFiles(testImagePath);
  147 |       
  148 |       await page.waitForSelector('text=Upload complete', { timeout: 30000 });
  149 |       
  150 |       // Verify filter is still active
  151 |       const filterIndicator = await page.locator('.active-filters');
  152 |       await expect(filterIndicator).toBeVisible();
  153 |       
  154 |       // New image shouldn't appear in filtered view (as it's not completed)
  155 |       const newFilteredCount = await page.locator('.image-gallery .image-item').count();
  156 |       expect(newFilteredCount).toBe(filteredCount);
  157 |     }
  158 |   });
  159 |
  160 |   test('should update gallery in grid view', async ({ page }) => {
  161 |     // Navigate to project
  162 |     await navigateToProject(page, 'test2');
  163 |     
  164 |     // Switch to grid view if not already
  165 |     const gridViewButton = await page.locator('button[aria-label="Grid view"]');
  166 |     if (await gridViewButton.isVisible()) {
  167 |       await gridViewButton.click();
  168 |     }
  169 |     
  170 |     // Verify grid layout
  171 |     const gallery = await page.locator('.image-gallery');
  172 |     await expect(gallery).toHaveClass(/grid-view/);
  173 |     
  174 |     // Count grid items
  175 |     const initialGridItems = await gallery.locator('.grid-item').count();
  176 |     
  177 |     // Upload image
  178 |     await page.click('button:has-text("Upload Images")');
  179 |     const fileInput = await page.locator('input[type="file"]');
  180 |     const testImagePath = path.join(__dirname, '../fixtures/gallery-test-5.png');
  181 |     await fileInput.setInputFiles(testImagePath);
  182 |     
  183 |     await page.waitForSelector('text=Upload complete', { timeout: 30000 });
  184 |     
  185 |     // Verify grid updated
  186 |     const newGridItems = await gallery.locator('.grid-item').count();
  187 |     expect(newGridItems).toBe(initialGridItems + 1);
  188 |   });
  189 |
  190 |   test('should update gallery in list view', async ({ page }) => {
  191 |     // Navigate to project
  192 |     await navigateToProject(page, 'test2');
  193 |     
  194 |     // Switch to list view
  195 |     const listViewButton = await page.locator('button[aria-label="List view"]');
  196 |     if (await listViewButton.isVisible()) {
  197 |       await listViewButton.click();
  198 |     }
  199 |     
  200 |     // Verify list layout
  201 |     const gallery = await page.locator('.image-gallery');
  202 |     await expect(gallery).toHaveClass(/list-view/);
  203 |     
  204 |     // Count list items
  205 |     const initialListItems = await gallery.locator('.list-item').count();
  206 |     
  207 |     // Upload image
  208 |     await page.click('button:has-text("Upload Images")');
  209 |     const fileInput = await page.locator('input[type="file"]');
  210 |     const testImagePath = path.join(__dirname, '../fixtures/gallery-test-6.png');
  211 |     await fileInput.setInputFiles(testImagePath);
  212 |     
  213 |     await page.waitForSelector('text=Upload complete', { timeout: 30000 });
  214 |     
  215 |     // Verify list updated
  216 |     const newListItems = await gallery.locator('.list-item').count();
  217 |     expect(newListItems).toBe(initialListItems + 1);
  218 |   });
  219 |
  220 |   test('should handle rapid consecutive uploads', async ({ page }) => {
  221 |     // Navigate to project
  222 |     await navigateToProject(page, 'test2');
  223 |     
  224 |     const gallery = await page.locator('.image-gallery');
  225 |     const initialCount = await gallery.locator('.image-item').count();
  226 |     
  227 |     // Upload multiple images rapidly
  228 |     const uploads = [];
```