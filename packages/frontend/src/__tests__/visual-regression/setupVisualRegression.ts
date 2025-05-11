import { test as base, expect } from '@playwright/test';
import { toMatchImageSnapshot } from 'jest-image-snapshot';
import * as path from 'path';
import * as fs from 'fs';

// Extend Playwright's expect with image snapshot matcher
expect.extend({ toMatchImageSnapshot });

/**
 * Configuration for visual regression testing
 */
export const visualConfig = {
  snapshotsDir: path.join(__dirname, 'snapshots'),
  threshold: 0.02, // Allow 2% pixel difference

  // Visual comparison options
  comparisonOptions: {
    failureThreshold: 0.02,
    failureThresholdType: 'percent',
    updatePassedSnapshot: false,
    blur: 1, // Apply slight blur to reduce noise
    allowSizeMismatch: false,
  },
};

// Create snapshots directory if it doesn't exist
if (!fs.existsSync(visualConfig.snapshotsDir)) {
  fs.mkdirSync(visualConfig.snapshotsDir, { recursive: true });
}

/**
 * Custom test fixture with visual regression testing capabilities
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    // Add a helper method to take and compare screenshots
    page.compareScreenshot = async (name: string, options = {}) => {
      // Take screenshot
      const screenshot = await page.screenshot({
        fullPage: false,
        ...options,
      });

      // Construct snapshot path
      const snapshotPath = path.join(visualConfig.snapshotsDir, `${name}.png`);

      // If snapshot doesn't exist yet, save it
      if (!fs.existsSync(snapshotPath) && process.env.UPDATE_VISUAL_SNAPSHOTS) {
        fs.writeFileSync(snapshotPath, screenshot);
        console.log(`Created new snapshot: ${name}`);
        return;
      }

      // Compare with existing snapshot
      expect(screenshot).toMatchImageSnapshot({
        customSnapshotIdentifier: name,
        customSnapshotsDir: visualConfig.snapshotsDir,
        ...visualConfig.comparisonOptions,
      });
    };

    // Add a method to compare a specific element
    page.compareElement = async (selector: string, name: string, options = {}) => {
      const element = await page.$(selector);
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }

      const screenshot = await element.screenshot(options);

      // Construct snapshot path
      const snapshotPath = path.join(visualConfig.snapshotsDir, `${name}.png`);

      // If snapshot doesn't exist yet, save it
      if (!fs.existsSync(snapshotPath) && process.env.UPDATE_VISUAL_SNAPSHOTS) {
        fs.writeFileSync(snapshotPath, screenshot);
        console.log(`Created new snapshot: ${name}`);
        return;
      }

      // Compare with existing snapshot
      expect(screenshot).toMatchImageSnapshot({
        customSnapshotIdentifier: name,
        customSnapshotsDir: visualConfig.snapshotsDir,
        ...visualConfig.comparisonOptions,
      });
    };

    await use(page);
  },
});

// Extend the Page interface with our custom methods
declare global {
  namespace PlaywrightTest {
    interface Page {
      compareScreenshot(name: string, options?: any): Promise<void>;
      compareElement(selector: string, name: string, options?: any): Promise<void>;
    }
  }
}
