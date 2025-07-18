# Test info

- Name: Image Gallery Refresh After Upload >> should update gallery in list view
- Location: /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/functionality/image-gallery-refresh.spec.ts:190:3

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
> 190 |   test('should update gallery in list view', async ({ page }) => {
      |   ^ Error: browserType.launch: Executable doesn't exist at /home/cvat/.cache/ms-playwright/webkit-2158/pw_run.sh
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
  229 |     for (let i = 1; i <= 3; i++) {
  230 |       const uploadPromise = (async () => {
  231 |         await page.click('button:has-text("Upload Images")');
  232 |         const fileInput = await page.locator('input[type="file"]');
  233 |         const testImagePath = path.join(__dirname, `../fixtures/rapid-test-${i}.png`);
  234 |         await fileInput.setInputFiles(testImagePath);
  235 |       })();
  236 |       uploads.push(uploadPromise);
  237 |     }
  238 |     
  239 |     // Wait for all uploads to start
  240 |     await Promise.all(uploads);
  241 |     
  242 |     // Wait for all uploads to complete
  243 |     await page.waitForSelector('text=3 files uploaded', { timeout: 60000 });
  244 |     
  245 |     // Verify all images appear
  246 |     const finalCount = await gallery.locator('.image-item').count();
  247 |     expect(finalCount).toBe(initialCount + 3);
  248 |   });
  249 |
  250 |   test('should update gallery across multiple browser tabs', async ({ page, context }) => {
  251 |     // Open project in first tab
  252 |     await navigateToProject(page, 'test2');
  253 |     
  254 |     // Open same project in second tab
  255 |     const page2 = await context.newPage();
  256 |     await loginAsTestUser(page2);
  257 |     await navigateToProject(page2, 'test2');
  258 |     
  259 |     // Get initial counts in both tabs
  260 |     const gallery1 = await page.locator('.image-gallery');
  261 |     const gallery2 = await page2.locator('.image-gallery');
  262 |     
  263 |     const initialCount1 = await gallery1.locator('.image-item').count();
  264 |     const initialCount2 = await gallery2.locator('.image-item').count();
  265 |     expect(initialCount1).toBe(initialCount2);
  266 |     
  267 |     // Upload image in first tab
  268 |     await page.click('button:has-text("Upload Images")');
  269 |     const fileInput = await page.locator('input[type="file"]');
  270 |     const testImagePath = path.join(__dirname, '../fixtures/cross-tab-test.png');
  271 |     await fileInput.setInputFiles(testImagePath);
  272 |     
  273 |     await page.waitForSelector('text=Upload complete', { timeout: 30000 });
  274 |     
  275 |     // Verify gallery updated in first tab
  276 |     const newCount1 = await gallery1.locator('.image-item').count();
  277 |     expect(newCount1).toBe(initialCount1 + 1);
  278 |     
  279 |     // Verify gallery updated in second tab (with a small delay for sync)
  280 |     await page2.waitForTimeout(2000);
  281 |     const newCount2 = await gallery2.locator('.image-item').count();
  282 |     expect(newCount2).toBe(initialCount2 + 1);
  283 |     
  284 |     // Close second tab
  285 |     await page2.close();
  286 |   });
  287 |
  288 |   test('should show upload progress in gallery', async ({ page }) => {
  289 |     // Navigate to project
  290 |     await navigateToProject(page, 'test2');
```