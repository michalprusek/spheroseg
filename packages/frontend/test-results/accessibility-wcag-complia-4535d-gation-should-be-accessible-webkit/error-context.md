# Test info

- Name: Mobile Accessibility >> mobile navigation should be accessible
- Location: /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/accessibility/wcag-compliance.spec.ts:294:3

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
> 294 |   test('mobile navigation should be accessible', async ({ page }) => {
      |   ^ Error: browserType.launch: Executable doesn't exist at /home/cvat/.cache/ms-playwright/webkit-2158/pw_run.sh
  295 |     await page.goto('/');
  296 |     await injectAxe(page);
  297 |     
  298 |     // Check mobile menu button
  299 |     const menuButton = await page.$('[aria-label*="menu"], [aria-label*="Menu"]');
  300 |     expect(menuButton).toBeTruthy();
  301 |     
  302 |     // Verify menu button has proper ARIA attributes
  303 |     const ariaExpanded = await menuButton?.getAttribute('aria-expanded');
  304 |     expect(ariaExpanded).toBeDefined();
  305 |     
  306 |     // Test menu interaction
  307 |     await menuButton?.click();
  308 |     await page.waitForTimeout(300); // Wait for animation
  309 |     
  310 |     // Check if menu is accessible
  311 |     await checkA11y(page);
  312 |   });
  313 | });
```