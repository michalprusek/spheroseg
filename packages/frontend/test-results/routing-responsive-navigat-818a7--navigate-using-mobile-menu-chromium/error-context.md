# Test info

- Name: Responsive Navigation >> Mobile Navigation >> should navigate using mobile menu
- Location: /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/routing/responsive-navigation.spec.ts:30:5

# Error details

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('button[aria-label="Toggle navigation menu"]')

    at /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/routing/responsive-navigation.spec.ts:38:30
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
  - button "Toggle menu":
    - img
  - main:
    - text: Advanced Spheroid Segmentation Platform
    - heading "AI-powered Cell Analysis for Biomedical Research" [level=1]
    - paragraph: Elevate your microscopic cell image analysis with our cutting-edge spheroid segmentation platform. Designed for researchers seeking precision and efficiency.
    - link "Get Started":
      - /url: /sign-up
      - text: Get Started
      - img
    - link "Learn More":
      - /url: "#features"
    - img "Spheroid microscopy image"
    - img "Spheroid microscopy image with analysis"
    - text: Features
    - heading "Discover Our Platform Capabilities" [level=2]
    - paragraph: Advanced tools for biomedical research
    - img
    - heading "Advanced Segmentation" [level=3]
    - paragraph: Precise spheroid detection with boundary analysis for accurate cell measurements
    - img
    - heading "AI-powered Analysis" [level=3]
    - paragraph: Leverage deep learning algorithms for automated cell detection and classification
    - img
    - heading "Easy Uploading" [level=3]
    - paragraph: Drag and drop your microscopy images for immediate processing and analysis
    - img
    - heading "Statistical Insights" [level=3]
    - paragraph: Comprehensive metrics and visualizations to extract meaningful data patterns
    - img
    - heading "Team Collaboration" [level=3]
    - paragraph: Share projects and results with colleagues for more efficient research
    - img
    - heading "Automated Pipeline" [level=3]
    - paragraph: Streamline your workflow with our batch processing tools
    - text: About the Platform
    - heading "What is SpheroSeg?" [level=2]
    - img "Spheroid segmentation example"
    - paragraph: SpheroSeg is an advanced platform specifically designed for the segmentation and analysis of cell spheroids in microscopic images.
    - paragraph: Our tool combines cutting-edge artificial intelligence algorithms with an intuitive interface to provide researchers with precise spheroid boundary detection and analytical capabilities.
    - paragraph: The platform was developed by Michal Průšek from FNSPE CTU in Prague under the supervision of Adam Novozámský from UTIA CAS, in collaboration with researchers from the Department of Biochemistry and Microbiology at UCT Prague.
    - paragraph:
      - link "spheroseg@utia.cas.cz":
        - /url: mailto:spheroseg@utia.cas.cz
    - heading "Ready to transform your research?" [level=2]
    - paragraph: Start using SpheroSeg today and discover new possibilities in cell spheroid analysis
    - heading "Create a free account" [level=3]
    - paragraph: Get access to all platform features and start analyzing your microscopy images
    - link "Create Account":
      - /url: /sign-up
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
   2 | import { devices } from '@playwright/test';
   3 |
   4 | test.describe('Responsive Navigation', () => {
   5 |   test.describe('Mobile Navigation', () => {
   6 |     test('should display mobile menu on small screens', async ({ page, context }) => {
   7 |       // Set mobile viewport size
   8 |       await page.setViewportSize({ width: 390, height: 844 });
   9 |       
   10 |       await navigateAndWaitForLoad(page, urls.home);
   11 |       
   12 |       // Mobile menu button should be visible
   13 |       const mobileMenuButton = page.locator('button[aria-label="Toggle navigation menu"]');
   14 |       await expect(mobileMenuButton).toBeVisible();
   15 |       
   16 |       // Desktop navigation should be hidden
   17 |       const desktopNav = page.locator('nav').filter({ hasText: 'Documentation' }).first();
   18 |       await expect(desktopNav).toBeHidden();
   19 |       
   20 |       // Open mobile menu
   21 |       await mobileMenuButton.click();
   22 |       
   23 |       // Mobile navigation links should be visible
   24 |       await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
   25 |       await expect(page.getByRole('link', { name: 'Documentation' })).toBeVisible();
   26 |       await expect(page.getByRole('link', { name: 'Terms' })).toBeVisible();
   27 |       await expect(page.getByRole('link', { name: 'Privacy' })).toBeVisible();
   28 |     });
   29 |
   30 |     test('should navigate using mobile menu', async ({ page }) => {
   31 |       // Set mobile viewport size
   32 |       await page.setViewportSize({ width: 390, height: 844 });
   33 |       
   34 |       await navigateAndWaitForLoad(page, urls.home);
   35 |       
   36 |       // Open mobile menu
   37 |       const mobileMenuButton = page.locator('button[aria-label="Toggle navigation menu"]');
>  38 |       await mobileMenuButton.click();
      |                              ^ Error: locator.click: Test timeout of 30000ms exceeded.
   39 |       
   40 |       // Navigate to documentation
   41 |       await page.getByRole('link', { name: 'Documentation' }).click();
   42 |       await expect(page).toHaveURL(urls.documentation);
   43 |       
   44 |       // Menu should close after navigation
   45 |       await expect(page.getByRole('link', { name: 'Documentation' }).first()).toBeHidden();
   46 |     });
   47 |
   48 |     test('should handle mobile viewport for all pages', async ({ page }) => {
   49 |       // Set mobile viewport size
   50 |       await page.setViewportSize({ width: 390, height: 844 });
   51 |       
   52 |       const pagesToTest = [
   53 |         { url: urls.home, title: 'AI-powered Cell Analysis' },
   54 |         { url: urls.documentation, title: 'SpheroSeg Documentation' },
   55 |         { url: urls.about, title: 'About SpheroSeg' },
   56 |         { url: urls.termsOfService, title: 'Terms of Service' },
   57 |         { url: urls.privacyPolicy, title: 'Privacy Policy' },
   58 |       ];
   59 |
   60 |       for (const pageInfo of pagesToTest) {
   61 |         await navigateAndWaitForLoad(page, pageInfo.url);
   62 |         
   63 |         // Check that content is visible and not cut off
   64 |         await expect(page.locator('h1').filter({ hasText: pageInfo.title })).toBeVisible();
   65 |         
   66 |         // Check horizontal scroll
   67 |         const hasHorizontalScroll = await page.evaluate(() => {
   68 |           return document.documentElement.scrollWidth > document.documentElement.clientWidth;
   69 |         });
   70 |         expect(hasHorizontalScroll).toBe(false);
   71 |       }
   72 |     });
   73 |   });
   74 |
   75 |   test.describe('Tablet Navigation', () => {
   76 |     test('should display appropriate navigation on tablet', async ({ page }) => {
   77 |       // Set tablet viewport size
   78 |       await page.setViewportSize({ width: 768, height: 1024 });
   79 |       await navigateAndWaitForLoad(page, urls.home);
   80 |       
   81 |       // Check if navigation is properly displayed
   82 |       await expect(page.locator(selectors.navigation.documentation).first()).toBeVisible();
   83 |       await expect(page.locator(selectors.navigation.termsOfService).first()).toBeVisible();
   84 |       
   85 |       // Check layout is appropriate for tablet
   86 |       const viewportSize = page.viewportSize();
   87 |       expect(viewportSize?.width).toBeGreaterThan(700);
   88 |     });
   89 |   });
   90 |
   91 |   test.describe('Desktop Navigation', () => {
   92 |     test.use({ viewport: { width: 1920, height: 1080 } });
   93 |
   94 |     test('should display full navigation on desktop', async ({ page }) => {
   95 |       await navigateAndWaitForLoad(page, urls.home);
   96 |       
   97 |       // All navigation items should be visible
   98 |       await expect(page.locator(selectors.navigation.home).first()).toBeVisible();
   99 |       await expect(page.locator(selectors.navigation.documentation).first()).toBeVisible();
  100 |       await expect(page.locator(selectors.navigation.termsOfService).first()).toBeVisible();
  101 |       await expect(page.locator(selectors.navigation.privacyPolicy).first()).toBeVisible();
  102 |       await expect(page.locator(selectors.navigation.signIn).first()).toBeVisible();
  103 |       await expect(page.locator(selectors.navigation.requestAccess).first()).toBeVisible();
  104 |       
  105 |       // Language switcher and theme toggle should be visible
  106 |       await expect(page.locator(selectors.languageSwitcher)).toBeVisible();
  107 |       await expect(page.locator(selectors.themeToggle)).toBeVisible();
  108 |     });
  109 |   });
  110 |
  111 |   test('should handle orientation change', async ({ page, context }) => {
  112 |     // Start in portrait mode
  113 |     await context.setViewportSize({ width: 414, height: 896 });
  114 |     await navigateAndWaitForLoad(page, urls.home);
  115 |     
  116 |     // Check mobile menu is visible
  117 |     const mobileMenuButton = page.locator('button[aria-label="Toggle navigation menu"]');
  118 |     await expect(mobileMenuButton).toBeVisible();
  119 |     
  120 |     // Change to landscape
  121 |     await context.setViewportSize({ width: 896, height: 414 });
  122 |     
  123 |     // Navigation might change based on breakpoints
  124 |     // This test ensures the page handles orientation change without breaking
  125 |     await expect(page.locator('h1')).toBeVisible();
  126 |   });
  127 |
  128 |   test('should handle dynamic viewport resize', async ({ page }) => {
  129 |     await navigateAndWaitForLoad(page, urls.home);
  130 |     
  131 |     // Start with desktop size
  132 |     await page.setViewportSize({ width: 1200, height: 800 });
  133 |     await expect(page.locator(selectors.navigation.documentation).first()).toBeVisible();
  134 |     
  135 |     // Resize to mobile
  136 |     await page.setViewportSize({ width: 375, height: 667 });
  137 |     
  138 |     // Mobile menu should appear
```