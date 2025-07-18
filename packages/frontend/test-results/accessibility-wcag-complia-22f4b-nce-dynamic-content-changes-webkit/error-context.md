# Test info

- Name: WCAG Accessibility Compliance >> should announce dynamic content changes
- Location: /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/accessibility/wcag-compliance.spec.ts:195:3

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
> 195 |   test('should announce dynamic content changes', async ({ page }) => {
      |   ^ Error: browserType.launch: Executable doesn't exist at /home/cvat/.cache/ms-playwright/webkit-2158/pw_run.sh
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
  226 |       testElement.style.transition = 'all 0.3s';
  227 |       document.body.appendChild(testElement);
  228 |       
  229 |       const computedStyle = window.getComputedStyle(testElement);
  230 |       const transitionDuration = computedStyle.transitionDuration;
  231 |       
  232 |       document.body.removeChild(testElement);
  233 |       
  234 |       return transitionDuration === '0s';
  235 |     });
  236 |
  237 |     expect(hasReducedMotion).toBe(true);
  238 |   });
  239 |
  240 |   test('error messages should be associated with form fields', async ({ page }) => {
  241 |     await page.goto('/sign-in');
  242 |     
  243 |     // Submit empty form to trigger errors
  244 |     await page.click('button[type="submit"]');
  245 |     
  246 |     // Wait for error messages
  247 |     await page.waitForSelector('.error-message', { timeout: 5000 });
  248 |     
  249 |     // Check error associations
  250 |     const formFields = await page.$$eval('input', inputs =>
  251 |       inputs.map(input => ({
  252 |         id: input.id,
  253 |         ariaDescribedBy: input.getAttribute('aria-describedby'),
  254 |         ariaInvalid: input.getAttribute('aria-invalid'),
  255 |       }))
  256 |     );
  257 |
  258 |     for (const field of formFields) {
  259 |       if (field.ariaInvalid === 'true') {
  260 |         expect(field.ariaDescribedBy).toBeTruthy();
  261 |         
  262 |         // Verify error message exists
  263 |         const errorMessage = await page.$(`#${field.ariaDescribedBy}`);
  264 |         expect(errorMessage).toBeTruthy();
  265 |       }
  266 |     }
  267 |   });
  268 | });
  269 |
  270 | test.describe('Mobile Accessibility', () => {
  271 |   test.use({ viewport: { width: 375, height: 667 } });
  272 |
  273 |   test('touch targets should be large enough', async ({ page }) => {
  274 |     await page.goto('/');
  275 |     
  276 |     const touchTargets = await page.$$eval('button, a, input', elements =>
  277 |       elements.map(el => {
  278 |         const rect = el.getBoundingClientRect();
  279 |         return {
  280 |           selector: el.tagName,
  281 |           width: rect.width,
  282 |           height: rect.height,
  283 |         };
  284 |       })
  285 |     );
  286 |
  287 |     // WCAG recommends minimum 44x44 pixels for touch targets
  288 |     for (const target of touchTargets) {
  289 |       expect(target.width).toBeGreaterThanOrEqual(44);
  290 |       expect(target.height).toBeGreaterThanOrEqual(44);
  291 |     }
  292 |   });
  293 |
  294 |   test('mobile navigation should be accessible', async ({ page }) => {
  295 |     await page.goto('/');
```