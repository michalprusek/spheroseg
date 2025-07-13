# Test info

- Name: WCAG Accessibility Compliance >> sign-in page should be keyboard navigable
- Location: /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/accessibility/wcag-compliance.spec.ts:54:3

# Error details

```
AssertionError: 2 accessibility violations were detected

2 !== 0

    at testResultDependsOnViolations (/home/cvat/spheroseg/spheroseg/node_modules/axe-playwright/dist/utils.js:16:26)
    at /home/cvat/spheroseg/spheroseg/node_modules/axe-playwright/dist/index.js:143:51
    at fulfilled (/home/cvat/spheroseg/spheroseg/node_modules/axe-playwright/dist/index.js:28:58)
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
  - textbox "Email address"
  - text: Password
  - textbox "Password"
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
- region "Notifications alt+T"
```

# Test source

```ts
   1 | import { test, expect } from '@playwright/test';
   2 | import { injectAxe, checkA11y } from 'axe-playwright';
   3 |
   4 | test.describe('WCAG Accessibility Compliance', () => {
   5 |   test.beforeEach(async ({ page }) => {
   6 |     // Inject axe-core for accessibility testing
   7 |     await injectAxe(page);
   8 |   });
   9 |
   10 |   test('home page should meet WCAG standards', async ({ page }) => {
   11 |     await page.goto('/');
   12 |     
   13 |     // Run accessibility checks
   14 |     await checkA11y(page, null, {
   15 |       detailedReport: true,
   16 |       detailedReportOptions: {
   17 |         html: true,
   18 |       },
   19 |     });
   20 |
   21 |     // Check for proper heading hierarchy
   22 |     const headings = await page.$$eval('h1, h2, h3, h4, h5, h6', elements =>
   23 |       elements.map(el => ({
   24 |         level: parseInt(el.tagName[1]),
   25 |         text: el.textContent,
   26 |       }))
   27 |     );
   28 |
   29 |     // Verify heading hierarchy
   30 |     let previousLevel = 0;
   31 |     for (const heading of headings) {
   32 |       expect(heading.level - previousLevel).toBeLessThanOrEqual(1);
   33 |       if (heading.level > previousLevel) {
   34 |         previousLevel = heading.level;
   35 |       }
   36 |     }
   37 |
   38 |     // Check for skip navigation link
   39 |     const skipLink = await page.$('a[href="#main"]');
   40 |     expect(skipLink).toBeTruthy();
   41 |
   42 |     // Verify focus indicators
   43 |     await page.keyboard.press('Tab');
   44 |     const focusedElement = await page.evaluate(() => {
   45 |       const el = document.activeElement;
   46 |       return {
   47 |         tagName: el?.tagName,
   48 |         hasFocusStyles: window.getComputedStyle(el).outline !== 'none',
   49 |       };
   50 |     });
   51 |     expect(focusedElement.hasFocusStyles).toBe(true);
   52 |   });
   53 |
>  54 |   test('sign-in page should be keyboard navigable', async ({ page }) => {
      |   ^ AssertionError: 2 accessibility violations were detected
   55 |     await page.goto('/sign-in');
   56 |     await injectAxe(page);
   57 |     
   58 |     // Check accessibility
   59 |     await checkA11y(page);
   60 |
   61 |     // Test keyboard navigation
   62 |     const elements = await page.$$eval(
   63 |       'input, button, a, select, textarea, [tabindex]:not([tabindex="-1"])',
   64 |       els => els.length
   65 |     );
   66 |
   67 |     // Navigate through all focusable elements
   68 |     for (let i = 0; i < elements; i++) {
   69 |       await page.keyboard.press('Tab');
   70 |       const activeElement = await page.evaluate(() => ({
   71 |         tagName: document.activeElement?.tagName,
   72 |         ariaLabel: document.activeElement?.getAttribute('aria-label'),
   73 |         placeholder: document.activeElement?.getAttribute('placeholder'),
   74 |       }));
   75 |       
   76 |       // Verify element has accessible name
   77 |       expect(
   78 |         activeElement.ariaLabel || activeElement.placeholder || activeElement.tagName
   79 |       ).toBeTruthy();
   80 |     }
   81 |   });
   82 |
   83 |   test('images should have alt text', async ({ page }) => {
   84 |     await page.goto('/');
   85 |     
   86 |     const images = await page.$$eval('img', imgs =>
   87 |       imgs.map(img => ({
   88 |         src: img.src,
   89 |         alt: img.alt,
   90 |         decorative: img.getAttribute('role') === 'presentation',
   91 |       }))
   92 |     );
   93 |
   94 |     for (const img of images) {
   95 |       if (!img.decorative) {
   96 |         expect(img.alt).toBeTruthy();
   97 |         expect(img.alt.length).toBeGreaterThan(0);
   98 |       }
   99 |     }
  100 |   });
  101 |
  102 |   test('forms should have proper labels', async ({ page }) => {
  103 |     await page.goto('/sign-up');
  104 |     await injectAxe(page);
  105 |     
  106 |     await checkA11y(page);
  107 |
  108 |     // Check form inputs have labels
  109 |     const inputs = await page.$$eval('input, select, textarea', elements =>
  110 |       elements.map(el => ({
  111 |         id: el.id,
  112 |         name: el.name,
  113 |         hasLabel: !!document.querySelector(`label[for="${el.id}"]`),
  114 |         ariaLabel: el.getAttribute('aria-label'),
  115 |         ariaLabelledBy: el.getAttribute('aria-labelledby'),
  116 |       }))
  117 |     );
  118 |
  119 |     for (const input of inputs) {
  120 |       const hasAccessibleName = input.hasLabel || input.ariaLabel || input.ariaLabelledBy;
  121 |       expect(hasAccessibleName).toBe(true);
  122 |     }
  123 |   });
  124 |
  125 |   test('color contrast should meet WCAG AA standards', async ({ page }) => {
  126 |     await page.goto('/');
  127 |     await injectAxe(page);
  128 |     
  129 |     // Run color contrast checks
  130 |     await checkA11y(page, null, {
  131 |       rules: {
  132 |         'color-contrast': { enabled: true },
  133 |       },
  134 |     });
  135 |
  136 |     // Additional manual contrast check for critical elements
  137 |     const criticalElements = await page.$$eval(
  138 |       '.btn-primary, .btn-secondary, a, .alert',
  139 |       elements => elements.map(el => {
  140 |         const styles = window.getComputedStyle(el);
  141 |         return {
  142 |           selector: el.className,
  143 |           color: styles.color,
  144 |           backgroundColor: styles.backgroundColor,
  145 |         };
  146 |       })
  147 |     );
  148 |
  149 |     // Verify critical elements are visible
  150 |     expect(criticalElements.length).toBeGreaterThan(0);
  151 |   });
  152 |
  153 |   test('ARIA landmarks should be properly used', async ({ page }) => {
  154 |     await page.goto('/');
```