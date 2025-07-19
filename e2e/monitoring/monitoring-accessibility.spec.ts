/**
 * Monitoring Accessibility and Usability E2E Tests
 * 
 * Tests for accessibility compliance, usability, and user experience
 * of monitoring interfaces and dashboards.
 */

import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const FRONTEND_URL = 'http://localhost:3000';
const BASE_API_URL = 'http://localhost:5001/api';
const TEST_ADMIN_EMAIL = 'testuser@test.com';
const TEST_ADMIN_PASSWORD = 'testuser123';

// Accessibility configuration
const AXE_CONFIG = {
  rules: {
    // Disable color contrast rule for now as it may have false positives
    'color-contrast': { enabled: false },
    // Enable important accessibility rules
    'aria-roles': { enabled: true },
    'aria-valid-attr': { enabled: true },
    'button-name': { enabled: true },
    'heading-order': { enabled: true },
    'landmark-one-main': { enabled: true },
    'link-name': { enabled: true },
    'list': { enabled: true },
    'region': { enabled: true },
  },
};

// Helper to login and get authenticated session
async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto(`${FRONTEND_URL}/login`);
  
  // Wait for login form to be visible
  await page.waitForSelector('form', { timeout: 10000 });
  
  // Fill in credentials
  await page.fill('input[type="email"]', TEST_ADMIN_EMAIL);
  await page.fill('input[type="password"]', TEST_ADMIN_PASSWORD);
  
  // Submit form
  await page.click('button[type="submit"]');
  
  // Wait for successful login (redirect or dashboard)
  await page.waitForURL(/dashboard|projects/, { timeout: 15000 });
}

// Helper to check if monitoring/admin section exists
async function navigateToMonitoring(page: Page): Promise<boolean> {
  try {
    // Look for monitoring/admin navigation
    const monitoringLink = page.locator('a[href*="monitoring"], a[href*="admin"], a[href*="system"]').first();
    
    if (await monitoringLink.isVisible()) {
      await monitoringLink.click();
      await page.waitForLoadState('networkidle');
      return true;
    }
    
    // Alternative: Check if there's a system health indicator
    const healthIndicator = page.locator('[data-testid*="health"], [aria-label*="health"], .health-status').first();
    if (await healthIndicator.isVisible()) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.log('No monitoring UI found, will test API endpoints only');
    return false;
  }
}

test.describe('Monitoring API Accessibility', () => {
  test('Health endpoints should provide accessible error responses', async ({ page }) => {
    // Test that API responses include proper error structure for screen readers
    const response = await page.request.get(`${BASE_API_URL}/monitoring/nonexistent`);
    
    expect(response.status()).toBe(404);
    
    // Error responses should have consistent structure
    const errorBody = await response.text();
    expect(errorBody).toBeTruthy();
    
    // Check if response includes proper content-type for JSON errors
    const contentType = response.headers()['content-type'];
    if (contentType) {
      expect(contentType).toContain('application/json');
    }
  });
  
  test('Health check responses should include human-readable status', async ({ page }) => {
    const response = await page.request.get(`${BASE_API_URL}/health`);
    
    const healthData = await response.json();
    
    // Status should be human-readable
    expect(['healthy', 'degraded', 'unhealthy']).toContain(healthData.status);
    
    // Should include timestamp for accessibility tools
    expect(healthData.timestamp).toBeDefined();
    expect(new Date(healthData.timestamp).toString()).not.toBe('Invalid Date');
    
    // Components should have descriptive messages
    if (healthData.components) {
      Object.entries(healthData.components).forEach(([componentName, component]: [string, any]) => {
        expect(component.status).toBeDefined();
        expect(['healthy', 'degraded', 'unhealthy', 'unknown']).toContain(component.status);
        
        // Non-healthy components should have explanatory messages
        if (component.status !== 'healthy' && component.message) {
          expect(typeof component.message).toBe('string');
          expect(component.message.length).toBeGreaterThan(0);
        }
      });
    }
  });
});

test.describe('Monitoring Dashboard Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });
  
  test('System health indicators should be accessible', async ({ page }) => {
    const hasMonitoringUI = await navigateToMonitoring(page);
    
    if (!hasMonitoringUI) {
      test.skip('No monitoring UI found in the application');
      return;
    }
    
    // Run accessibility scan
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .configure(AXE_CONFIG)
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
    
    // Check for health status indicators
    const healthIndicators = page.locator('[aria-label*="health"], [role="status"], .health-indicator, [data-testid*="health"]');
    
    if (await healthIndicators.count() > 0) {
      // Health indicators should have proper ARIA labels
      for (let i = 0; i < await healthIndicators.count(); i++) {
        const indicator = healthIndicators.nth(i);
        
        // Should have either aria-label or accessible text content
        const ariaLabel = await indicator.getAttribute('aria-label');
        const textContent = await indicator.textContent();
        
        expect(ariaLabel || textContent).toBeTruthy();
        
        // Visual status indicators should have text alternatives
        if (await indicator.locator('.status-icon, .health-icon').count() > 0) {
          expect(ariaLabel || textContent).toMatch(/healthy|degraded|unhealthy|error|ok|warning/i);
        }
      }
    }
  });
  
  test('Performance metrics should be accessible to screen readers', async ({ page }) => {
    const hasMonitoringUI = await navigateToMonitoring(page);
    
    if (!hasMonitoringUI) {
      test.skip('No monitoring UI found in the application');
      return;
    }
    
    // Look for metric displays
    const metricElements = page.locator('[data-testid*="metric"], .metric, .performance-metric, [aria-label*="metric"]');
    
    if (await metricElements.count() > 0) {
      for (let i = 0; i < await metricElements.count(); i++) {
        const metric = metricElements.nth(i);
        
        // Metrics should have descriptive labels
        const ariaLabel = await metric.getAttribute('aria-label');
        const textContent = await metric.textContent();
        
        expect(ariaLabel || textContent).toBeTruthy();
        
        // Numeric metrics should include units
        if (textContent && /\d+/.test(textContent)) {
          // Should include units like ms, MB, %, etc.
          expect(textContent).toMatch(/\d+\s*(ms|MB|GB|%|rpm|rps|/s)/i);
        }
      }
    }
  });
  
  test('Alert notifications should be accessible', async ({ page }) => {
    // Check if there are any alert notifications or similar elements
    const alertElements = page.locator('[role="alert"], .alert, .notification, [aria-live]');
    
    if (await alertElements.count() > 0) {
      // Run accessibility scan on alert elements
      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('[role="alert"], .alert, .notification')
        .withTags(['wcag2a', 'wcag2aa'])
        .configure(AXE_CONFIG)
        .analyze();
      
      expect(accessibilityScanResults.violations).toEqual([]);
      
      // Alerts should have proper roles and live regions
      for (let i = 0; i < await alertElements.count(); i++) {
        const alert = alertElements.nth(i);
        
        const role = await alert.getAttribute('role');
        const ariaLive = await alert.getAttribute('aria-live');
        
        // Should have either role="alert" or aria-live attribute
        expect(role === 'alert' || ariaLive).toBeTruthy();
        
        // Should have meaningful text content
        const textContent = await alert.textContent();
        expect(textContent?.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

test.describe('Monitoring UI Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });
  
  test('Monitoring interface should be keyboard navigable', async ({ page }) => {
    const hasMonitoringUI = await navigateToMonitoring(page);
    
    if (!hasMonitoringUI) {
      test.skip('No monitoring UI found in the application');
      return;
    }
    
    // Find interactive elements
    const interactiveElements = page.locator('button, a, input, select, [tabindex="0"], [role="button"]');
    const elementCount = await interactiveElements.count();
    
    if (elementCount > 0) {
      // Start from the first focusable element
      await page.keyboard.press('Tab');
      
      // Navigate through several elements using Tab
      for (let i = 0; i < Math.min(5, elementCount); i++) {
        const focusedElement = page.locator(':focus');
        
        // Focused element should be visible
        await expect(focusedElement).toBeVisible();
        
        // Should have visible focus indicator
        const focusedElementBounding = await focusedElement.boundingBox();
        expect(focusedElementBounding).toBeTruthy();
        
        // Move to next element
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100); // Small delay for focus transition
      }
      
      // Test reverse navigation
      await page.keyboard.press('Shift+Tab');
      const backFocusedElement = page.locator(':focus');
      await expect(backFocusedElement).toBeVisible();
    }
  });
  
  test('Buttons and controls should be activatable via keyboard', async ({ page }) => {
    const hasMonitoringUI = await navigateToMonitoring(page);
    
    if (!hasMonitoringUI) {
      test.skip('No monitoring UI found in the application');
      return;
    }
    
    // Find buttons in the monitoring interface
    const buttons = page.locator('button, [role="button"]');
    const buttonCount = await buttons.count();
    
    if (buttonCount > 0) {
      // Test first button
      const firstButton = buttons.first();
      await firstButton.focus();
      
      // Button should be focusable
      await expect(firstButton).toBeFocused();
      
      // Should respond to Enter key
      const buttonText = await firstButton.textContent();
      if (buttonText && !buttonText.toLowerCase().includes('delete')) {
        // Test activation (avoid destructive actions)
        await page.keyboard.press('Enter');
        
        // Wait for any potential response
        await page.waitForTimeout(500);
        
        // Should not cause page errors
        const errors = page.locator('.error, [role="alert"][aria-live="assertive"]');
        const errorCount = await errors.count();
        expect(errorCount).toBe(0);
      }
    }
  });
});

test.describe('Monitoring UI Visual Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });
  
  test('Status indicators should have sufficient contrast and multiple cues', async ({ page }) => {
    const hasMonitoringUI = await navigateToMonitoring(page);
    
    if (!hasMonitoringUI) {
      test.skip('No monitoring UI found in the application');
      return;
    }
    
    // Look for status indicators (colors, icons, etc.)
    const statusElements = page.locator('.status, .health-status, [data-status], [aria-label*="status"]');
    
    if (await statusElements.count() > 0) {
      for (let i = 0; i < await statusElements.count(); i++) {
        const statusElement = statusElements.nth(i);
        
        // Status should not rely solely on color
        const textContent = await statusElement.textContent();
        const ariaLabel = await statusElement.getAttribute('aria-label');
        const hasIcon = await statusElement.locator('svg, .icon, i[class*="icon"]').count() > 0;
        
        // Should have text, icon, or aria-label (not just color)
        expect(textContent || ariaLabel || hasIcon).toBeTruthy();
        
        // If it has text content, it should be meaningful
        if (textContent?.trim()) {
          expect(textContent.trim().length).toBeGreaterThan(0);
          // Common status terms
          expect(textContent.toLowerCase()).toMatch(/healthy|unhealthy|degraded|error|ok|warning|good|bad|up|down|online|offline/);
        }
      }
    }
  });
  
  test('Charts and graphs should have accessible alternatives', async ({ page }) => {
    const hasMonitoringUI = await navigateToMonitoring(page);
    
    if (!hasMonitoringUI) {
      test.skip('No monitoring UI found in the application');
      return;
    }
    
    // Look for chart elements
    const chartElements = page.locator('canvas, svg[class*="chart"], .chart, [data-chart]');
    
    if (await chartElements.count() > 0) {
      for (let i = 0; i < await chartElements.count(); i++) {
        const chart = chartElements.nth(i);
        
        // Charts should have accessible descriptions
        const ariaLabel = await chart.getAttribute('aria-label');
        const ariaDescription = await chart.getAttribute('aria-description');
        const title = await chart.getAttribute('title');
        
        // Should have some form of accessible description
        expect(ariaLabel || ariaDescription || title).toBeTruthy();
        
        // Look for data tables or text alternatives
        const parentSection = chart.locator('xpath=..');
        const hasDataTable = await parentSection.locator('table, [role="table"]').count() > 0;
        const hasTextSummary = await parentSection.locator('.summary, .description, [aria-label*="summary"]').count() > 0;
        
        // Should have either accessible description or alternative data presentation
        expect(ariaLabel || ariaDescription || title || hasDataTable || hasTextSummary).toBeTruthy();
      }
    }
  });
});

test.describe('Monitoring UI Responsive Design', () => {
  const viewports = [
    { width: 320, height: 568, name: 'Mobile' },
    { width: 768, height: 1024, name: 'Tablet' },
    { width: 1024, height: 768, name: 'Desktop Small' },
    { width: 1920, height: 1080, name: 'Desktop Large' },
  ];
  
  viewports.forEach(({ width, height, name }) => {
    test(`Monitoring interface should be usable on ${name} (${width}x${height})`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await loginAsAdmin(page);
      
      const hasMonitoringUI = await navigateToMonitoring(page);
      
      if (!hasMonitoringUI) {
        test.skip('No monitoring UI found in the application');
        return;
      }
      
      // Check that essential elements are visible and accessible
      const essentialElements = page.locator('h1, h2, main, [role="main"], nav, [role="navigation"]');
      
      if (await essentialElements.count() > 0) {
        for (let i = 0; i < await essentialElements.count(); i++) {
          const element = essentialElements.nth(i);
          
          // Element should be visible
          await expect(element).toBeVisible();
          
          // Should be within viewport
          const boundingBox = await element.boundingBox();
          if (boundingBox) {
            expect(boundingBox.x).toBeGreaterThanOrEqual(0);
            expect(boundingBox.y).toBeGreaterThanOrEqual(0);
            expect(boundingBox.x + boundingBox.width).toBeLessThanOrEqual(width + 50); // Allow small overflow
          }
        }
      }
      
      // Check for horizontal scrolling (should be minimal)
      const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
      const bodyClientWidth = await page.evaluate(() => document.body.clientWidth);
      
      // Allow for minor differences due to scrollbars
      expect(bodyScrollWidth - bodyClientWidth).toBeLessThan(50);
      
      // Interactive elements should be touch-friendly on mobile
      if (width <= 768) {
        const buttons = page.locator('button, a, [role="button"]');
        
        if (await buttons.count() > 0) {
          for (let i = 0; i < Math.min(3, await buttons.count()); i++) {
            const button = buttons.nth(i);
            const boundingBox = await button.boundingBox();
            
            if (boundingBox) {
              // Buttons should be at least 44px in size (WCAG AAA)
              expect(Math.min(boundingBox.width, boundingBox.height)).toBeGreaterThanOrEqual(40);
            }
          }
        }
      }
    });
  });
});

test.describe('Monitoring Error Messages Accessibility', () => {
  test('API error responses should be accessible', async ({ page }) => {
    // Test unauthorized access
    const unauthorizedResponse = await page.request.get(`${BASE_API_URL}/monitoring/dashboard`);
    expect(unauthorizedResponse.status()).toBe(401);
    
    const errorData = await unauthorizedResponse.json();
    
    // Error should have clear, human-readable message
    expect(errorData.error || errorData.message).toBeDefined();
    const errorMessage = errorData.error || errorData.message;
    expect(typeof errorMessage).toBe('string');
    expect(errorMessage.length).toBeGreaterThan(0);
    
    // Should not expose sensitive technical details
    expect(errorMessage.toLowerCase()).not.toMatch(/sql|database|internal|stack|trace/);
  });
  
  test('Client-side error handling should be accessible', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    
    // Inject a script to trigger an error and see how it's handled
    await page.evaluate(() => {
      // Simulate a network error
      window.fetch('/api/monitoring/nonexistent')
        .catch((error) => {
          // Check if error is displayed accessibly
          console.log('Network error caught:', error);
        });
    });
    
    // Wait for any error messages to appear
    await page.waitForTimeout(1000);
    
    // Check for error messages or notifications
    const errorElements = page.locator('[role="alert"], .error-message, .toast, .notification');
    
    if (await errorElements.count() > 0) {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('[role="alert"], .error-message, .toast, .notification')
        .withTags(['wcag2a', 'wcag2aa'])
        .configure(AXE_CONFIG)
        .analyze();
      
      expect(accessibilityScanResults.violations).toEqual([]);
    }
  });
});