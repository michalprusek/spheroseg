# Test info

- Name: Image Upload Functionality >> should show thumbnail immediately after upload
- Location: /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/functionality/image-upload.spec.ts:157:3

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
  133 |     // Upload new image
  134 |     await page.click('button:has-text("Upload Images")');
  135 |     const fileInput = await page.locator('input[type="file"]');
  136 |     const testImagePath = path.join(__dirname, '../fixtures/unique-test-image.png');
  137 |     await fileInput.setInputFiles(testImagePath);
  138 |     
  139 |     // Wait for upload to complete
  140 |     await page.waitForSelector('text=Upload complete', { timeout: 30000 });
  141 |     
  142 |     // Verify gallery updated without page refresh
  143 |     const newImages = await page.locator('.image-gallery .image-item').all();
  144 |     const newImageNames = await Promise.all(
  145 |       newImages.map(img => img.getAttribute('data-name'))
  146 |     );
  147 |     
  148 |     // Should have one more image
  149 |     expect(newImages.length).toBe(initialImages.length + 1);
  150 |     
  151 |     // New image should be in the list
  152 |     const addedImageName = newImageNames.find(name => !initialImageNames.includes(name));
  153 |     expect(addedImageName).toBeTruthy();
  154 |     expect(addedImageName).toContain('unique-test-image');
  155 |   });
  156 |
> 157 |   test('should show thumbnail immediately after upload', async ({ page }) => {
      |   ^ Error: browserType.launch: Executable doesn't exist at /home/cvat/.cache/ms-playwright/firefox-1482/firefox/firefox
  158 |     // Navigate to a project
  159 |     await navigateToProject(page, 'test2');
  160 |     
  161 |     // Upload image
  162 |     await page.click('button:has-text("Upload Images")');
  163 |     const fileInput = await page.locator('input[type="file"]');
  164 |     const testImagePath = path.join(__dirname, '../fixtures/test-thumbnail.png');
  165 |     await fileInput.setInputFiles(testImagePath);
  166 |     
  167 |     // Wait for upload
  168 |     await page.waitForSelector('text=Upload complete', { timeout: 30000 });
  169 |     
  170 |     // Find the newly uploaded image
  171 |     const newImage = await page.locator('.image-gallery .image-item').last();
  172 |     
  173 |     // Verify thumbnail is loaded
  174 |     const thumbnail = await newImage.locator('img');
  175 |     await expect(thumbnail).toBeVisible();
  176 |     
  177 |     // Verify thumbnail has valid src
  178 |     const thumbnailSrc = await thumbnail.getAttribute('src');
  179 |     expect(thumbnailSrc).toBeTruthy();
  180 |     expect(thumbnailSrc).toMatch(/\.(png|jpg|jpeg|webp)/i);
  181 |   });
  182 |
  183 |   test('should allow drag and drop upload', async ({ page }) => {
  184 |     // Navigate to a project
  185 |     await navigateToProject(page, 'test2');
  186 |     
  187 |     // Click upload button to open upload area
  188 |     await page.click('button:has-text("Upload Images")');
  189 |     
  190 |     // Get the drop zone
  191 |     const dropZone = await page.locator('.upload-drop-zone');
  192 |     await expect(dropZone).toBeVisible();
  193 |     
  194 |     // Create a DataTransfer to simulate file drop
  195 |     const testImagePath = path.join(__dirname, '../fixtures/drag-drop-test.png');
  196 |     
  197 |     // Simulate drag over
  198 |     await dropZone.dispatchEvent('dragover', {
  199 |       dataTransfer: { types: ['Files'] }
  200 |     });
  201 |     
  202 |     // Verify drop zone shows active state
  203 |     await expect(dropZone).toHaveClass(/drag-active/);
  204 |     
  205 |     // Note: Full drag-drop simulation requires browser APIs not available in Playwright
  206 |     // This test verifies the UI responds to drag events
  207 |   });
  208 |
  209 |   test('should cancel upload in progress', async ({ page }) => {
  210 |     // Navigate to a project
  211 |     await navigateToProject(page, 'test2');
  212 |     
  213 |     // Start upload
  214 |     await page.click('button:has-text("Upload Images")');
  215 |     const fileInput = await page.locator('input[type="file"]');
  216 |     const testImagePath = path.join(__dirname, '../fixtures/large-test-image.png');
  217 |     await fileInput.setInputFiles(testImagePath);
  218 |     
  219 |     // Wait for upload to start
  220 |     await expect(page.locator('.upload-progress')).toBeVisible();
  221 |     
  222 |     // Click cancel button
  223 |     await page.click('button:has-text("Cancel")');
  224 |     
  225 |     // Verify upload was cancelled
  226 |     await expect(page.locator('text=Upload cancelled')).toBeVisible();
  227 |     await expect(page.locator('.upload-progress')).not.toBeVisible();
  228 |   });
  229 |
  230 |   test('should validate file size limits', async ({ page }) => {
  231 |     // Navigate to a project
  232 |     await navigateToProject(page, 'test2');
  233 |     
  234 |     // Try to upload a file that's too large
  235 |     await page.click('button:has-text("Upload Images")');
  236 |     const fileInput = await page.locator('input[type="file"]');
  237 |     
  238 |     // Create a mock large file (this would need actual implementation)
  239 |     // For now, we'll verify the UI shows size limits
  240 |     await expect(page.locator('text=/Maximum file size.*MB/')).toBeVisible();
  241 |   });
  242 |
  243 |   test('should maintain upload queue for multiple files', async ({ page }) => {
  244 |     // Navigate to a project
  245 |     await navigateToProject(page, 'test2');
  246 |     
  247 |     // Upload multiple files
  248 |     await page.click('button:has-text("Upload Images")');
  249 |     const fileInput = await page.locator('input[type="file"]');
  250 |     const testImages = [
  251 |       path.join(__dirname, '../fixtures/queue-test-1.png'),
  252 |       path.join(__dirname, '../fixtures/queue-test-2.png'),
  253 |       path.join(__dirname, '../fixtures/queue-test-3.png'),
  254 |       path.join(__dirname, '../fixtures/queue-test-4.png'),
  255 |       path.join(__dirname, '../fixtures/queue-test-5.png')
  256 |     ];
  257 |     await fileInput.setInputFiles(testImages);
```