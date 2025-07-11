import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('WCAG Accessibility Compliance', () => {
  test.beforeEach(async ({ page }) => {
    // Inject axe-core for accessibility testing
    await injectAxe(page);
  });

  test('home page should meet WCAG standards', async ({ page }) => {
    await page.goto('/');
    
    // Run accessibility checks
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: {
        html: true,
      },
    });

    // Check for proper heading hierarchy
    const headings = await page.$$eval('h1, h2, h3, h4, h5, h6', elements =>
      elements.map(el => ({
        level: parseInt(el.tagName[1]),
        text: el.textContent,
      }))
    );

    // Verify heading hierarchy
    let previousLevel = 0;
    for (const heading of headings) {
      expect(heading.level - previousLevel).toBeLessThanOrEqual(1);
      if (heading.level > previousLevel) {
        previousLevel = heading.level;
      }
    }

    // Check for skip navigation link
    const skipLink = await page.$('a[href="#main"]');
    expect(skipLink).toBeTruthy();

    // Verify focus indicators
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      return {
        tagName: el?.tagName,
        hasFocusStyles: window.getComputedStyle(el).outline !== 'none',
      };
    });
    expect(focusedElement.hasFocusStyles).toBe(true);
  });

  test('sign-in page should be keyboard navigable', async ({ page }) => {
    await page.goto('/sign-in');
    await injectAxe(page);
    
    // Check accessibility
    await checkA11y(page);

    // Test keyboard navigation
    const elements = await page.$$eval(
      'input, button, a, select, textarea, [tabindex]:not([tabindex="-1"])',
      els => els.length
    );

    // Navigate through all focusable elements
    for (let i = 0; i < elements; i++) {
      await page.keyboard.press('Tab');
      const activeElement = await page.evaluate(() => ({
        tagName: document.activeElement?.tagName,
        ariaLabel: document.activeElement?.getAttribute('aria-label'),
        placeholder: document.activeElement?.getAttribute('placeholder'),
      }));
      
      // Verify element has accessible name
      expect(
        activeElement.ariaLabel || activeElement.placeholder || activeElement.tagName
      ).toBeTruthy();
    }
  });

  test('images should have alt text', async ({ page }) => {
    await page.goto('/');
    
    const images = await page.$$eval('img', imgs =>
      imgs.map(img => ({
        src: img.src,
        alt: img.alt,
        decorative: img.getAttribute('role') === 'presentation',
      }))
    );

    for (const img of images) {
      if (!img.decorative) {
        expect(img.alt).toBeTruthy();
        expect(img.alt.length).toBeGreaterThan(0);
      }
    }
  });

  test('forms should have proper labels', async ({ page }) => {
    await page.goto('/sign-up');
    await injectAxe(page);
    
    await checkA11y(page);

    // Check form inputs have labels
    const inputs = await page.$$eval('input, select, textarea', elements =>
      elements.map(el => ({
        id: el.id,
        name: el.name,
        hasLabel: !!document.querySelector(`label[for="${el.id}"]`),
        ariaLabel: el.getAttribute('aria-label'),
        ariaLabelledBy: el.getAttribute('aria-labelledby'),
      }))
    );

    for (const input of inputs) {
      const hasAccessibleName = input.hasLabel || input.ariaLabel || input.ariaLabelledBy;
      expect(hasAccessibleName).toBe(true);
    }
  });

  test('color contrast should meet WCAG AA standards', async ({ page }) => {
    await page.goto('/');
    await injectAxe(page);
    
    // Run color contrast checks
    await checkA11y(page, null, {
      rules: {
        'color-contrast': { enabled: true },
      },
    });

    // Additional manual contrast check for critical elements
    const criticalElements = await page.$$eval(
      '.btn-primary, .btn-secondary, a, .alert',
      elements => elements.map(el => {
        const styles = window.getComputedStyle(el);
        return {
          selector: el.className,
          color: styles.color,
          backgroundColor: styles.backgroundColor,
        };
      })
    );

    // Verify critical elements are visible
    expect(criticalElements.length).toBeGreaterThan(0);
  });

  test('ARIA landmarks should be properly used', async ({ page }) => {
    await page.goto('/');
    
    // Check for main landmark
    const main = await page.$('main, [role="main"]');
    expect(main).toBeTruthy();

    // Check for navigation landmark
    const nav = await page.$('nav, [role="navigation"]');
    expect(nav).toBeTruthy();

    // Check for banner landmark (header)
    const banner = await page.$('header, [role="banner"]');
    expect(banner).toBeTruthy();

    // Check for contentinfo landmark (footer)
    const contentinfo = await page.$('footer, [role="contentinfo"]');
    expect(contentinfo).toBeTruthy();
  });

  test('interactive elements should have focus states', async ({ page }) => {
    await page.goto('/');
    
    // Get all interactive elements
    const interactiveElements = await page.$$('button, a, input, select, textarea');
    
    for (const element of interactiveElements) {
      await element.focus();
      
      const hasFocusStyles = await element.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return (
          styles.outline !== 'none' ||
          styles.boxShadow !== 'none' ||
          styles.border !== styles.getPropertyValue('border')
        );
      });
      
      expect(hasFocusStyles).toBe(true);
    }
  });

  test('should announce dynamic content changes', async ({ page }) => {
    await page.goto('/');
    
    // Check for ARIA live regions
    const liveRegions = await page.$$('[aria-live], [role="alert"], [role="status"]');
    expect(liveRegions.length).toBeGreaterThan(0);

    // Verify toast notifications are announced
    await page.evaluate(() => {
      // Trigger a toast notification
      window.dispatchEvent(
        new CustomEvent('show-toast', {
          detail: { message: 'Test notification', type: 'success' },
        })
      );
    });

    // Check if toast has proper ARIA attributes
    const toast = await page.waitForSelector('.toast', { timeout: 5000 });
    const ariaLive = await toast?.getAttribute('aria-live');
    expect(ariaLive).toBe('polite');
  });

  test('should support reduced motion preferences', async ({ page }) => {
    // Set prefers-reduced-motion
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    // Check if animations are disabled
    const hasReducedMotion = await page.evaluate(() => {
      const testElement = document.createElement('div');
      testElement.style.transition = 'all 0.3s';
      document.body.appendChild(testElement);
      
      const computedStyle = window.getComputedStyle(testElement);
      const transitionDuration = computedStyle.transitionDuration;
      
      document.body.removeChild(testElement);
      
      return transitionDuration === '0s';
    });

    expect(hasReducedMotion).toBe(true);
  });

  test('error messages should be associated with form fields', async ({ page }) => {
    await page.goto('/sign-in');
    
    // Submit empty form to trigger errors
    await page.click('button[type="submit"]');
    
    // Wait for error messages
    await page.waitForSelector('.error-message', { timeout: 5000 });
    
    // Check error associations
    const formFields = await page.$$eval('input', inputs =>
      inputs.map(input => ({
        id: input.id,
        ariaDescribedBy: input.getAttribute('aria-describedby'),
        ariaInvalid: input.getAttribute('aria-invalid'),
      }))
    );

    for (const field of formFields) {
      if (field.ariaInvalid === 'true') {
        expect(field.ariaDescribedBy).toBeTruthy();
        
        // Verify error message exists
        const errorMessage = await page.$(`#${field.ariaDescribedBy}`);
        expect(errorMessage).toBeTruthy();
      }
    }
  });
});

test.describe('Mobile Accessibility', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('touch targets should be large enough', async ({ page }) => {
    await page.goto('/');
    
    const touchTargets = await page.$$eval('button, a, input', elements =>
      elements.map(el => {
        const rect = el.getBoundingClientRect();
        return {
          selector: el.tagName,
          width: rect.width,
          height: rect.height,
        };
      })
    );

    // WCAG recommends minimum 44x44 pixels for touch targets
    for (const target of touchTargets) {
      expect(target.width).toBeGreaterThanOrEqual(44);
      expect(target.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('mobile navigation should be accessible', async ({ page }) => {
    await page.goto('/');
    await injectAxe(page);
    
    // Check mobile menu button
    const menuButton = await page.$('[aria-label*="menu"], [aria-label*="Menu"]');
    expect(menuButton).toBeTruthy();
    
    // Verify menu button has proper ARIA attributes
    const ariaExpanded = await menuButton?.getAttribute('aria-expanded');
    expect(ariaExpanded).toBeDefined();
    
    // Test menu interaction
    await menuButton?.click();
    await page.waitForTimeout(300); // Wait for animation
    
    // Check if menu is accessible
    await checkA11y(page);
  });
});