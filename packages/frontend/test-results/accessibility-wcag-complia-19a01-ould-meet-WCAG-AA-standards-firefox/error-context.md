# Test info

- Name: WCAG Accessibility Compliance >> color contrast should meet WCAG AA standards
- Location: /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/accessibility/wcag-compliance.spec.ts:125:3

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
> 125 |   test('color contrast should meet WCAG AA standards', async ({ page }) => {
      |   ^ Error: browserType.launch: Executable doesn't exist at /home/cvat/.cache/ms-playwright/firefox-1482/firefox/firefox
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
  203 |     await page.evaluate(() => {
  204 |       // Trigger a toast notification
  205 |       window.dispatchEvent(
  206 |         new CustomEvent('show-toast', {
  207 |           detail: { message: 'Test notification', type: 'success' },
  208 |         })
  209 |       );
  210 |     });
  211 |
  212 |     // Check if toast has proper ARIA attributes
  213 |     const toast = await page.waitForSelector('.toast', { timeout: 5000 });
  214 |     const ariaLive = await toast?.getAttribute('aria-live');
  215 |     expect(ariaLive).toBe('polite');
  216 |   });
  217 |
  218 |   test('should support reduced motion preferences', async ({ page }) => {
  219 |     // Set prefers-reduced-motion
  220 |     await page.emulateMedia({ reducedMotion: 'reduce' });
  221 |     await page.goto('/');
  222 |
  223 |     // Check if animations are disabled
  224 |     const hasReducedMotion = await page.evaluate(() => {
  225 |       const testElement = document.createElement('div');
```