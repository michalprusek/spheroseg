import { test as base, expect } from '@playwright/test';

// Extend basic test fixture
export const test = base.extend({
  // Add custom fixtures here if needed
});

export { expect };

// Common selectors
export const selectors = {
  navigation: {
    home: 'a[href="/"]',
    documentation: 'a[href="/documentation"]',
    termsOfService: 'a[href="/terms-of-service"]',
    privacyPolicy: 'a[href="/privacy-policy"]',
    signIn: 'a[href="/sign-in"]',
    signUp: 'a[href="/sign-up"]',
    requestAccess: 'a[href="/request-access"]',
    about: 'a[href="/about"]',
  },
  logo: 'img[alt="SpheroSeg Logo"]',
  languageSwitcher: 'button:has-text("Language")',
  themeToggle: 'button:has-text("Toggle theme")',
  headings: {
    h1: 'h1',
    h2: 'h2',
    h3: 'h3',
  },
} as const;

// Common page URLs
export const urls = {
  home: '/',
  documentation: '/documentation',
  termsOfService: '/terms-of-service',
  privacyPolicy: '/privacy-policy',
  signIn: '/sign-in',
  signUp: '/sign-up',
  requestAccess: '/request-access',
  about: '/about',
  dashboard: '/dashboard',
  profile: '/profile',
  settings: '/settings',
  forgotPassword: '/forgot-password',
  verifyEmail: '/verify-email',
  // Protected routes
  project: (id: string) => `/project/${id}`,
  projectExport: (id: string) => `/project/${id}/export`,
  segmentation: (imageId: string) => `/images/${imageId}/segmentation`,
} as const;

// Test data
export const testData = {
  validUser: {
    email: 'test@example.com',
    password: 'password123',
    firstName: 'Test',
    lastName: 'User',
  },
  invalidUser: {
    email: 'invalid@example.com',
    password: 'wrongpassword',
  },
} as const;

// Helper functions
export async function navigateAndWaitForLoad(page: any, url: string) {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
}

export async function checkPageTitle(page: any, expectedTitle: string) {
  await expect(page).toHaveTitle(expectedTitle);
}

export async function checkHeading(page: any, level: 'h1' | 'h2' | 'h3', text: string) {
  await expect(page.locator(selectors.headings[level])).toContainText(text);
}

export async function checkNavigationLinks(page: any) {
  for (const [name, selector] of Object.entries(selectors.navigation)) {
    await expect(page.locator(selector).first()).toBeVisible();
  }
}

export async function checkFooterLinks(page: any) {
  await expect(page.locator('footer')).toBeVisible();
  await expect(page.locator('footer').getByText('Documentation')).toBeVisible();
  await expect(page.locator('footer').getByText('Terms of Service')).toBeVisible();
  await expect(page.locator('footer').getByText('Privacy Policy')).toBeVisible();
}

export async function checkNoTranslationKeys(page: any) {
  // Check that no translation keys are visible (e.g., "about.title")
  const pageContent = await page.content();
  const translationKeyPattern = /\b[a-z]+\.[a-z]+(?:\.[a-z]+)*\b/gi;
  const matches = pageContent.match(translationKeyPattern);
  
  // Filter out valid patterns that might look like translation keys
  const validPatterns = [
    'example.com',
    'spheroseg.com',
    'utia.cas.cz',
    'cvut.cz',
    'fjfi.cvut.cz',
    'uct.cz',
    'package.json',
    'tsconfig.json',
    'vite.config.ts',
  ];
  
  const invalidKeys = matches?.filter(match => 
    !validPatterns.some(valid => match.includes(valid))
  ) || [];
  
  expect(invalidKeys).toHaveLength(0);
}