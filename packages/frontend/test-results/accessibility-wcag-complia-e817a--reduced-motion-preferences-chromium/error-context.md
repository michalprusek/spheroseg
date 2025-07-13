# Test info

- Name: WCAG Accessibility Compliance >> should support reduced motion preferences
- Location: /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/accessibility/wcag-compliance.spec.ts:218:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
    at /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/accessibility/wcag-compliance.spec.ts:237:30
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
> 237 |     expect(hasReducedMotion).toBe(true);
      |                              ^ Error: expect(received).toBe(expected) // Object.is equality
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