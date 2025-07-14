# Test info

- Name: WCAG Accessibility Compliance >> forms should have proper labels
- Location: /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/accessibility/wcag-compliance.spec.ts:102:3

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
  - heading "Create Account" [level=2]
  - paragraph: Sign up for a new account
  - text: Name
  - textbox "e.g. John"
  - text: Last Name
  - textbox "e.g. Smith"
  - text: Email
  - textbox "Enter your email"
  - text: Password
  - textbox "Enter your password"
  - text: Confirm Password
  - textbox "Confirm your password"
  - checkbox "By submitting this request, you agree to our Terms of Service and Privacy Policy"
  - text: By submitting this request, you agree to our
  - link "Terms of Service":
    - /url: /terms-of-service
  - text: and
  - link "Privacy Policy":
    - /url: /privacy-policy
  - button "Create Account" [disabled]
  - text: Already have an account?
  - link "Sign In":
    - /url: /sign-in
    - button "Sign In"
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
  - button "Show Performance Monitor":
    - img
- region "Notifications alt+T"
```

# Test source

```ts
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
   54 |   test('sign-in page should be keyboard navigable', async ({ page }) => {
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
> 102 |   test('forms should have proper labels', async ({ page }) => {
      |   ^ AssertionError: 2 accessibility violations were detected
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
  155 |     
  156 |     // Check for main landmark
  157 |     const main = await page.$('main, [role="main"]');
  158 |     expect(main).toBeTruthy();
  159 |
  160 |     // Check for navigation landmark
  161 |     const nav = await page.$('nav, [role="navigation"]');
  162 |     expect(nav).toBeTruthy();
  163 |
  164 |     // Check for banner landmark (header)
  165 |     const banner = await page.$('header, [role="banner"]');
  166 |     expect(banner).toBeTruthy();
  167 |
  168 |     // Check for contentinfo landmark (footer)
  169 |     const contentinfo = await page.$('footer, [role="contentinfo"]');
  170 |     expect(contentinfo).toBeTruthy();
  171 |   });
  172 |
  173 |   test('interactive elements should have focus states', async ({ page }) => {
  174 |     await page.goto('/');
  175 |     
  176 |     // Get all interactive elements
  177 |     const interactiveElements = await page.$$('button, a, input, select, textarea');
  178 |     
  179 |     for (const element of interactiveElements) {
  180 |       await element.focus();
  181 |       
  182 |       const hasFocusStyles = await element.evaluate(el => {
  183 |         const styles = window.getComputedStyle(el);
  184 |         return (
  185 |           styles.outline !== 'none' ||
  186 |           styles.boxShadow !== 'none' ||
  187 |           styles.border !== styles.getPropertyValue('border')
  188 |         );
  189 |       });
  190 |       
  191 |       expect(hasFocusStyles).toBe(true);
  192 |     }
  193 |   });
  194 |
  195 |   test('should announce dynamic content changes', async ({ page }) => {
  196 |     await page.goto('/');
  197 |     
  198 |     // Check for ARIA live regions
  199 |     const liveRegions = await page.$$('[aria-live], [role="alert"], [role="status"]');
  200 |     expect(liveRegions.length).toBeGreaterThan(0);
  201 |
  202 |     // Verify toast notifications are announced
```