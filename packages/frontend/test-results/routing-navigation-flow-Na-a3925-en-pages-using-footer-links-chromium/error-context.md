# Test info

- Name: Navigation Flow and Links >> should navigate between pages using footer links
- Location: /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/routing/navigation-flow.spec.ts:24:3

# Error details

```
Error: locator.click: Error: strict mode violation: locator('footer').getByRole('link', { name: 'Terms of Service' }) resolved to 2 elements:
    1) <a href="/terms-of-service" class="text-gray-600 hover:text-gray-900 transition-colors">Terms of Service</a> aka locator('#main-content').getByRole('link', { name: 'Terms of Service' })
    2) <a href="/terms-of-service" class="text-gray-600 hover:text-gray-900 transition-colors">Terms of Service</a> aka getByRole('contentinfo').getByRole('link', { name: 'Terms of Service' })

Call log:
  - waiting for locator('footer').getByRole('link', { name: 'Terms of Service' })

    at /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/routing/navigation-flow.spec.ts:33:82
```

# Page snapshot

```yaml
- link "Skip to main content":
  - /url: "#main-content"
- main:
  - link "SpheroSeg Logo SpheroSeg":
    - /url: /
    - img "SpheroSeg Logo"
    - text: SpheroSeg
  - navigation:
    - link "Home":
      - /url: /
    - link "Documentation":
      - /url: /documentation
    - link "Terms":
      - /url: /terms-of-service
    - link "Privacy":
      - /url: /privacy-policy
    - link "Sign In":
      - /url: /sign-in
    - link "Request Access":
      - /url: /request-access
    - button "Language EN":
      - img
      - text: Language EN
    - button "Toggle theme":
      - img
      - img
      - text: Toggle theme
  - main:
    - text: User Guide
    - heading "SpheroSeg Documentation" [level=1]
    - paragraph: Learn how to use the Spheroid Segmentation Platform effectively.
    - complementary:
      - heading "Sections" [level=3]
      - navigation:
        - link "Introduction":
          - /url: "#introduction"
          - img
          - text: Introduction
        - link "Getting Started":
          - /url: "#getting-started"
          - img
          - text: Getting Started
        - link "Uploading Images":
          - /url: "#upload-images"
          - img
          - text: Uploading Images
        - link "Segmentation Process":
          - /url: "#segmentation"
          - img
          - text: Segmentation Process
        - link "API Reference":
          - /url: "#api"
          - img
          - text: API Reference
    - heading "Introduction" [level=2]
    - img "Illustration of spheroid analysis workflow"
    - heading "What is SpheroSeg?" [level=3]
    - paragraph: SpheroSeg is a cutting-edge platform designed for the segmentation and analysis of cell spheroids in microscopic images. Our tool provides researchers with precise detection and analytical capabilities.
    - paragraph: It utilizes advanced AI algorithms based on deep learning to automatically identify and segment spheroids in your images with high accuracy and consistency.
    - paragraph: This documentation will guide you through all aspects of using the platform, from getting started to advanced features and API integration.
    - heading "Getting Started" [level=2]
    - heading "Account Creation" [level=3]
    - paragraph: To use SpheroSeg, you need to create an account. This allows us to securely store your projects and images.
    - list:
      - listitem:
        - text: Visit the
        - link "sign-up page":
          - /url: /sign-up
      - listitem: Enter your institutional email address and create a password
      - listitem: Complete your profile with your name and institution
      - listitem: Verify your email address via the link sent to your inbox
    - heading "Creating Your First Project" [level=3]
    - paragraph: Projects help you organize your work. Each project can contain multiple images and their corresponding segmentation results.
    - list:
      - listitem: On your dashboard, click on "New Project"
      - listitem: Enter a project name and description
      - listitem: "Select project type (default: Spheroid Analysis)"
      - listitem: Click "Create Project" to continue
    - heading "Uploading Images" [level=2]
    - paragraph: SpheroSeg supports various image formats commonly used in microscopy, including TIFF, PNG, and JPEG.
    - heading "Upload Methods" [level=3]
    - paragraph: "There are several ways to upload images:"
    - list:
      - listitem: Drag and drop files directly into the upload area
      - listitem: Click on the upload area to browse and select files from your computer
      - listitem: Batch upload multiple images at once
    - paragraph:
      - strong: "Note:"
      - text: For optimal results, ensure your microscopy images have good contrast between the spheroid and background.
    - heading "Segmentation Process" [level=2]
    - paragraph: The segmentation process identifies the boundaries of spheroids in your images, allowing for precise analysis of their morphology.
    - heading "Automatic Segmentation" [level=3]
    - paragraph: "Our AI-powered automatic segmentation can detect spheroid boundaries with high accuracy:"
    - list:
      - listitem: Select an image from your project
      - listitem: Click on "Auto-Segment" to initiate the process
      - listitem: The system will process the image and display the detected boundaries
      - listitem: Review the results in the segmentation editor
    - heading "Manual Adjustments" [level=3]
    - paragraph: "Sometimes automatic segmentation may require refinement. Our editor provides tools for:"
    - list:
      - listitem: Adding or removing vertices along the boundary
      - listitem: Adjusting vertex positions for more accurate boundaries
      - listitem: Splitting or merging regions
      - listitem: Adding or removing holes within spheroids
    - heading "API Reference" [level=2]
    - paragraph: SpheroSeg offers a RESTful API for programmatic access to the platform's features. This is ideal for integration with your existing workflows or batch processing.
    - paragraph: GET /api/v1/projects
    - paragraph: Retrieves a list of all your projects
    - paragraph: GET /api/v1/projects/:id/images
    - paragraph: Retrieves all images within a specific project
    - paragraph: POST /api/v1/images/:id/segment
    - paragraph: Initiates segmentation for a specific image
    - paragraph:
      - text: For full API documentation and authentication details, please contact us at
      - link "prusemic@cvut.cz":
        - /url: mailto:prusemic@cvut.cz
      - text: .
    - link "Back to Home":
      - /url: /
      - img
      - text: Back to Home
    - link "Back to Top":
      - /url: "#introduction"
      - text: Back to Top
      - img
  - img
  - text: SpheroSeg
  - paragraph: Advanced platform for spheroid segmentation and analysis
  - link "GitHub Repository":
    - /url: https://github.com/michalprusek/spheroseg
    - img
    - text: GitHub Repository
  - link "Contact Email":
    - /url: mailto:spheroseg@utia.cas.cz
    - img
    - text: Contact Email
  - heading "Information" [level=3]
  - list:
    - listitem:
      - link "Documentation":
        - /url: /documentation
    - listitem:
      - link "Terms of Service":
        - /url: /terms-of-service
    - listitem:
      - link "Privacy Policy":
        - /url: /privacy-policy
    - listitem:
      - link "Request Access":
        - /url: /request-access
  - heading "Contact" [level=3]
  - list:
    - listitem:
      - link "spheroseg@utia.cas.cz":
        - /url: mailto:spheroseg@utia.cas.cz
    - listitem:
      - link "FNSPE CTU in Prague":
        - /url: https://www.fjfi.cvut.cz/
    - listitem:
      - link "UTIA CAS":
        - /url: https://www.utia.cas.cz/
  - paragraph: © 2025 SpheroSeg. All rights reserved.
  - paragraph:
    - text: Made with
    - img
    - text: by Michal Průšek
- contentinfo:
  - img
  - text: SpheroSeg
  - paragraph: Advanced platform for spheroid segmentation and analysis
  - link "GitHub Repository":
    - /url: https://github.com/michalprusek/spheroseg
    - img
    - text: GitHub Repository
  - link "Contact Email":
    - /url: mailto:spheroseg@utia.cas.cz
    - img
    - text: Contact Email
  - heading "Information" [level=3]
  - list:
    - listitem:
      - link "Documentation":
        - /url: /documentation
    - listitem:
      - link "Terms of Service":
        - /url: /terms-of-service
    - listitem:
      - link "Privacy Policy":
        - /url: /privacy-policy
    - listitem:
      - link "Request Access":
        - /url: /request-access
  - heading "Contact" [level=3]
  - list:
    - listitem:
      - link "spheroseg@utia.cas.cz":
        - /url: mailto:spheroseg@utia.cas.cz
    - listitem:
      - link "FNSPE CTU in Prague":
        - /url: https://www.fjfi.cvut.cz/
    - listitem:
      - link "UTIA CAS":
        - /url: https://www.utia.cas.cz/
  - paragraph: © 2025 SpheroSeg. All rights reserved.
  - paragraph:
    - text: Made with
    - img
    - text: by Michal Průšek
- region "Notifications alt+T"
```

# Test source

```ts
   1 | import { test, expect, selectors, urls, navigateAndWaitForLoad } from '../fixtures';
   2 |
   3 | test.describe('Navigation Flow and Links', () => {
   4 |   test.beforeEach(async ({ page }) => {
   5 |     await navigateAndWaitForLoad(page, urls.home);
   6 |   });
   7 |
   8 |   test('should navigate between pages using navigation menu', async ({ page }) => {
   9 |     // Test navigation menu flow
   10 |     await page.click(selectors.navigation.documentation);
   11 |     await expect(page).toHaveURL(urls.documentation);
   12 |     
   13 |     await page.click(selectors.navigation.termsOfService);
   14 |     await expect(page).toHaveURL(urls.termsOfService);
   15 |     
   16 |     await page.click(selectors.navigation.privacyPolicy);
   17 |     await expect(page).toHaveURL(urls.privacyPolicy);
   18 |     
   19 |     // Navigate back to home using logo
   20 |     await page.click(selectors.logo);
   21 |     await expect(page).toHaveURL(urls.home);
   22 |   });
   23 |
   24 |   test('should navigate between pages using footer links', async ({ page }) => {
   25 |     // Scroll to footer
   26 |     await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
   27 |     
   28 |     // Test footer navigation
   29 |     await page.locator('footer').getByRole('link', { name: 'Documentation' }).click();
   30 |     await expect(page).toHaveURL(urls.documentation);
   31 |     
   32 |     await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
>  33 |     await page.locator('footer').getByRole('link', { name: 'Terms of Service' }).click();
      |                                                                                  ^ Error: locator.click: Error: strict mode violation: locator('footer').getByRole('link', { name: 'Terms of Service' }) resolved to 2 elements:
   34 |     await expect(page).toHaveURL(urls.termsOfService);
   35 |     
   36 |     await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
   37 |     await page.locator('footer').getByRole('link', { name: 'Privacy Policy' }).click();
   38 |     await expect(page).toHaveURL(urls.privacyPolicy);
   39 |   });
   40 |
   41 |   test('should navigate from sign in to sign up and back', async ({ page }) => {
   42 |     // Go to sign in
   43 |     await page.click(selectors.navigation.signIn);
   44 |     await expect(page).toHaveURL(urls.signIn);
   45 |     
   46 |     // Navigate to sign up from sign in page
   47 |     await page.click('text=Sign Up');
   48 |     await expect(page).toHaveURL(urls.signUp);
   49 |     
   50 |     // Navigate back to sign in from sign up page
   51 |     await page.click('text=Sign In');
   52 |     await expect(page).toHaveURL(urls.signIn);
   53 |     
   54 |     // Navigate to forgot password
   55 |     await page.click('text=Forgot password?');
   56 |     await expect(page).toHaveURL(urls.forgotPassword);
   57 |     
   58 |     // Navigate back to sign in
   59 |     await page.click('text=Back to Sign In');
   60 |     await expect(page).toHaveURL(urls.signIn);
   61 |   });
   62 |
   63 |   test('should navigate to request access from multiple entry points', async ({ page }) => {
   64 |     // From main navigation
   65 |     await page.click(selectors.navigation.requestAccess);
   66 |     await expect(page).toHaveURL(urls.requestAccess);
   67 |     
   68 |     // Back to home
   69 |     await page.click(selectors.logo);
   70 |     await expect(page).toHaveURL(urls.home);
   71 |     
   72 |     // From footer
   73 |     await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
   74 |     await page.locator('footer').getByRole('link', { name: 'Request Access' }).click();
   75 |     await expect(page).toHaveURL(urls.requestAccess);
   76 |   });
   77 |
   78 |   test('should handle browser back/forward navigation correctly', async ({ page }) => {
   79 |     // Navigate through multiple pages
   80 |     await page.click(selectors.navigation.documentation);
   81 |     await expect(page).toHaveURL(urls.documentation);
   82 |     
   83 |     await page.click(selectors.navigation.about);
   84 |     await expect(page).toHaveURL(urls.about);
   85 |     
   86 |     await page.click(selectors.navigation.termsOfService);
   87 |     await expect(page).toHaveURL(urls.termsOfService);
   88 |     
   89 |     // Test browser back button
   90 |     await page.goBack();
   91 |     await expect(page).toHaveURL(urls.about);
   92 |     
   93 |     await page.goBack();
   94 |     await expect(page).toHaveURL(urls.documentation);
   95 |     
   96 |     await page.goBack();
   97 |     await expect(page).toHaveURL(urls.home);
   98 |     
   99 |     // Test browser forward button
  100 |     await page.goForward();
  101 |     await expect(page).toHaveURL(urls.documentation);
  102 |     
  103 |     await page.goForward();
  104 |     await expect(page).toHaveURL(urls.about);
  105 |   });
  106 |
  107 |   test('should maintain scroll position when navigating back', async ({ page }) => {
  108 |     // Scroll down on home page
  109 |     await page.evaluate(() => window.scrollTo(0, 500));
  110 |     const initialScrollY = await page.evaluate(() => window.scrollY);
  111 |     expect(initialScrollY).toBeGreaterThan(0);
  112 |     
  113 |     // Navigate to another page
  114 |     await page.click(selectors.navigation.documentation);
  115 |     await expect(page).toHaveURL(urls.documentation);
  116 |     
  117 |     // Go back
  118 |     await page.goBack();
  119 |     await expect(page).toHaveURL(urls.home);
  120 |     
  121 |     // Check if scroll position is maintained (might not be exact due to async loading)
  122 |     const finalScrollY = await page.evaluate(() => window.scrollY);
  123 |     expect(finalScrollY).toBeGreaterThanOrEqual(0);
  124 |   });
  125 |
  126 |   test('should handle external links correctly', async ({ page }) => {
  127 |     // Check external links in footer open in new tab
  128 |     const [newPage] = await Promise.all([
  129 |       page.waitForEvent('popup'),
  130 |       page.locator('footer').getByRole('link', { name: 'FNSPE CTU in Prague' }).click()
  131 |     ]);
  132 |     
  133 |     await expect(newPage).toHaveURL(/fjfi\.cvut\.cz/);
```