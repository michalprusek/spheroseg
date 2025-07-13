# Test info

- Name: Public Routes Navigation >> should navigate to home page and display correct content
- Location: /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/routing/public-routes.spec.ts:8:3

# Error details

```
Error: Timed out 5000ms waiting for expect(locator).toBeVisible()

Locator: locator('a[href="/about"]').first()
Expected: visible
Received: <element(s) not found>
Call log:
  - expect.toBeVisible with timeout 5000ms
  - waiting for locator('a[href="/about"]').first()

    at checkNavigationLinks (/home/cvat/spheroseg/spheroseg/packages/frontend/e2e/fixtures.ts:83:50)
    at /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/routing/public-routes.spec.ts:19:5
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
   1 | import { test as base, expect } from '@playwright/test';
   2 |
   3 | // Extend basic test fixture
   4 | export const test = base.extend({
   5 |   // Add custom fixtures here if needed
   6 | });
   7 |
   8 | export { expect };
   9 |
   10 | // Common selectors
   11 | export const selectors = {
   12 |   navigation: {
   13 |     home: 'a[href="/"]',
   14 |     documentation: 'a[href="/documentation"]',
   15 |     termsOfService: 'a[href="/terms-of-service"]',
   16 |     privacyPolicy: 'a[href="/privacy-policy"]',
   17 |     signIn: 'a[href="/sign-in"]',
   18 |     signUp: 'a[href="/sign-up"]',
   19 |     requestAccess: 'a[href="/request-access"]',
   20 |     about: 'a[href="/about"]',
   21 |   },
   22 |   logo: 'img[alt="SpheroSeg Logo"]',
   23 |   languageSwitcher: 'button:has-text("Language")',
   24 |   themeToggle: 'button:has-text("Toggle theme")',
   25 |   headings: {
   26 |     h1: 'h1',
   27 |     h2: 'h2',
   28 |     h3: 'h3',
   29 |   },
   30 | } as const;
   31 |
   32 | // Common page URLs
   33 | export const urls = {
   34 |   home: '/',
   35 |   documentation: '/documentation',
   36 |   termsOfService: '/terms-of-service',
   37 |   privacyPolicy: '/privacy-policy',
   38 |   signIn: '/sign-in',
   39 |   signUp: '/sign-up',
   40 |   requestAccess: '/request-access',
   41 |   about: '/about',
   42 |   dashboard: '/dashboard',
   43 |   profile: '/profile',
   44 |   settings: '/settings',
   45 |   forgotPassword: '/forgot-password',
   46 |   verifyEmail: '/verify-email',
   47 |   // Protected routes
   48 |   project: (id: string) => `/project/${id}`,
   49 |   projectExport: (id: string) => `/project/${id}/export`,
   50 |   segmentation: (imageId: string) => `/images/${imageId}/segmentation`,
   51 | } as const;
   52 |
   53 | // Test data
   54 | export const testData = {
   55 |   validUser: {
   56 |     email: 'test@example.com',
   57 |     password: 'password123',
   58 |     firstName: 'Test',
   59 |     lastName: 'User',
   60 |   },
   61 |   invalidUser: {
   62 |     email: 'invalid@example.com',
   63 |     password: 'wrongpassword',
   64 |   },
   65 | } as const;
   66 |
   67 | // Helper functions
   68 | export async function navigateAndWaitForLoad(page: any, url: string) {
   69 |   await page.goto(url);
   70 |   await page.waitForLoadState('networkidle');
   71 | }
   72 |
   73 | export async function checkPageTitle(page: any, expectedTitle: string) {
   74 |   await expect(page).toHaveTitle(expectedTitle);
   75 | }
   76 |
   77 | export async function checkHeading(page: any, level: 'h1' | 'h2' | 'h3', text: string) {
   78 |   await expect(page.locator(selectors.headings[level])).toContainText(text);
   79 | }
   80 |
   81 | export async function checkNavigationLinks(page: any) {
   82 |   for (const [name, selector] of Object.entries(selectors.navigation)) {
>  83 |     await expect(page.locator(selector).first()).toBeVisible();
      |                                                  ^ Error: Timed out 5000ms waiting for expect(locator).toBeVisible()
   84 |   }
   85 | }
   86 |
   87 | export async function checkFooterLinks(page: any) {
   88 |   await expect(page.locator('footer')).toBeVisible();
   89 |   await expect(page.locator('footer').getByText('Documentation')).toBeVisible();
   90 |   await expect(page.locator('footer').getByText('Terms of Service')).toBeVisible();
   91 |   await expect(page.locator('footer').getByText('Privacy Policy')).toBeVisible();
   92 | }
   93 |
   94 | export async function checkNoTranslationKeys(page: any) {
   95 |   // Check that no translation keys are visible (e.g., "about.title")
   96 |   const pageContent = await page.content();
   97 |   const translationKeyPattern = /\b[a-z]+\.[a-z]+(?:\.[a-z]+)*\b/gi;
   98 |   const matches = pageContent.match(translationKeyPattern);
   99 |   
  100 |   // Filter out valid patterns that might look like translation keys
  101 |   const validPatterns = [
  102 |     'example.com',
  103 |     'spheroseg.com',
  104 |     'utia.cas.cz',
  105 |     'cvut.cz',
  106 |     'fjfi.cvut.cz',
  107 |     'uct.cz',
  108 |     'package.json',
  109 |     'tsconfig.json',
  110 |     'vite.config.ts',
  111 |   ];
  112 |   
  113 |   const invalidKeys = matches?.filter(match => 
  114 |     !validPatterns.some(valid => match.includes(valid))
  115 |   ) || [];
  116 |   
  117 |   expect(invalidKeys).toHaveLength(0);
  118 | }
```