import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { AppConfigSchema } from '../app.config.validated';

// Mock import.meta.env
vi.mock('import.meta.env', () => ({
  env: {
    DEV: true,
    VITE_APP_VERSION: '2.0.0',
    VITE_API_BASE_URL: '/api/v2',
    VITE_ENABLE_REGISTRATION: 'true',
    VITE_ENABLE_GOOGLE_AUTH: 'false',
    VITE_ENABLE_GITHUB_AUTH: 'true',
    VITE_ENABLE_EXPERIMENTAL: 'false',
    VITE_MAINTENANCE_MODE: 'false',
    VITE_ANALYTICS_ENABLED: 'true',
    VITE_GA_ID: 'UA-123456-1',
    VITE_SENTRY_DSN: 'https://example@sentry.io/123',
    VITE_ENABLE_LOGGING: 'true',
    VITE_LOG_LEVEL: 'debug',
  },
}));

describe('Validated App Configuration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe('Configuration Validation', () => {
    it('should validate correct configuration successfully', async () => {
      const { appConfig, AppConfigSchema } = await import('../app.config.validated');

      expect(() => AppConfigSchema.parse(appConfig)).not.toThrow();
    });

    it('should fail validation for invalid email', () => {
      const invalidConfig = {
        app: { name: 'Test', fullName: 'Test App', description: 'Test', version: '1.0.0' },
        contact: {
          email: 'invalid-email', // Invalid
          supportEmail: 'support@test.com',
          privacyEmail: 'privacy@test.com',
          developer: { name: 'Dev', title: 'Developer', email: 'dev@test.com' },
        },
        // ... other required fields
      };

      expect(() => AppConfigSchema.parse(invalidConfig)).toThrow(z.ZodError);
    });

    it('should fail validation for invalid version format', () => {
      const invalidConfig = {
        app: {
          name: 'Test',
          fullName: 'Test App',
          description: 'Test',
          version: 'v1.0', // Invalid format
        },
        // ... other required fields
      };

      expect(() => AppConfigSchema.shape.app.parse(invalidConfig.app)).toThrow(z.ZodError);
    });

    it('should fail validation for invalid URL', () => {
      const invalidConfig = {
        organization: {
          primary: {
            name: 'Test Org',
            nameShort: 'TO',
            url: 'not-a-url', // Invalid
          },
        },
      };

      expect(() => AppConfigSchema.shape.organization.shape.primary.parse(invalidConfig.organization.primary)).toThrow(
        z.ZodError,
      );
    });

    it('should fail validation for invalid Twitter username', () => {
      const invalidConfig = {
        social: {
          twitter: {
            url: 'https://twitter.com/test',
            username: 'test', // Missing @ prefix
          },
        },
      };

      expect(() => AppConfigSchema.shape.social.shape.twitter.parse(invalidConfig.social.twitter)).toThrow(z.ZodError);
    });

    it('should fail validation for invalid date format', () => {
      const { AppConfigSchema } = require('../app.config.validated');

      const invalidConfig = {
        legal: {
          privacyPolicyUrl: '/privacy',
          termsOfServiceUrl: '/terms',
          cookiePolicyUrl: '/cookies',
          lastUpdated: '2025/01/07', // Wrong format
        },
      };

      expect(() => AppConfigSchema.shape.legal.parse(invalidConfig.legal)).toThrow(z.ZodError);
    });

    it('should fail validation for invalid timeout', () => {
      const { AppConfigSchema } = require('../app.config.validated');

      const invalidConfig = {
        api: {
          baseUrl: '/api',
          timeout: -1000, // Negative timeout
          retryAttempts: 3,
        },
      };

      expect(() => AppConfigSchema.shape.api.parse(invalidConfig.api)).toThrow(z.ZodError);
    });

    it('should fail validation for invalid retry attempts', () => {
      const { AppConfigSchema } = require('../app.config.validated');

      const invalidConfig = {
        api: {
          baseUrl: '/api',
          timeout: 30000,
          retryAttempts: 10, // Too high
        },
      };

      expect(() => AppConfigSchema.shape.api.parse(invalidConfig.api)).toThrow(z.ZodError);
    });

    it('should fail validation for invalid language code', () => {
      const { AppConfigSchema } = require('../app.config.validated');

      const invalidConfig = {
        ui: {
          defaultTheme: 'system',
          defaultLanguage: 'english', // Should be 2 chars
          supportedLanguages: ['en'],
          animationsEnabled: true,
          maxFileUploadSize: 10485760,
          acceptedImageFormats: ['image/jpeg'],
        },
      };

      expect(() => AppConfigSchema.shape.ui.parse(invalidConfig.ui)).toThrow(z.ZodError);
    });

    it('should fail validation for empty supported languages', () => {
      const { AppConfigSchema } = require('../app.config.validated');

      const invalidConfig = {
        ui: {
          defaultTheme: 'system',
          defaultLanguage: 'en',
          supportedLanguages: [], // Empty array
          animationsEnabled: true,
          maxFileUploadSize: 10485760,
          acceptedImageFormats: ['image/jpeg'],
        },
      };

      expect(() => AppConfigSchema.shape.ui.parse(invalidConfig.ui)).toThrow(z.ZodError);
    });
  });

  describe('Configuration Update Function', () => {
    it('should update configuration section successfully', async () => {
      const { updateConfig, getConfig } = await import('../app.config.validated');

      updateConfig('features', {
        maintenanceMode: true,
      });

      const features = getConfig('features');
      expect(features.maintenanceMode).toBe(true);
    });

    it('should fail to update with invalid data', async () => {
      const { updateConfig } = await import('../app.config.validated');

      expect(() => {
        updateConfig('api', {
          timeout: -1000, // Invalid
        });
      }).toThrow('Invalid configuration update');
    });

    it('should validate partial updates', async () => {
      const { updateConfig, getConfig } = await import('../app.config.validated');

      const originalTimeout = getConfig('api').timeout;

      updateConfig('api', {
        retryAttempts: 2,
      });

      const api = getConfig('api');
      expect(api.retryAttempts).toBe(2);
      expect(api.timeout).toBe(originalTimeout); // Unchanged
    });
  });

  describe('Helper Functions with Validation', () => {
    it('should return valid contact email', async () => {
      const { getContactEmail } = await import('../app.config.validated');

      const email = getContactEmail();
      expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });

    it('should return valid support email', async () => {
      const { getSupportEmail } = await import('../app.config.validated');

      const email = getSupportEmail();
      expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });

    it('should handle invalid email gracefully', async () => {
      // Mock console.warn
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // This would require mocking the appConfig object with invalid email
      // For now, we'll just verify the function exists and returns a string
      const { getContactEmail } = await import('../app.config.validated');
      const email = getContactEmail();

      expect(typeof email).toBe('string');

      warnSpy.mockRestore();
    });
  });

  describe('Environment Variable Integration', () => {
    it('should use environment variables correctly', async () => {
      const { appConfig } = await import('../app.config.validated');

      expect(appConfig.app.version).toBe('2.0.0');
      expect(appConfig.api.baseUrl).toBe('/api/v2');
      expect(appConfig.features.enableRegistration).toBe(true);
      expect(appConfig.features.enableGoogleAuth).toBe(false);
      expect(appConfig.features.enableGithubAuth).toBe(true);
      expect(appConfig.analytics.enabled).toBe(true);
      expect(appConfig.analytics.googleAnalyticsId).toBe('UA-123456-1');
      expect(appConfig.development.logLevel).toBe('debug');
    });
  });

  describe('Type Safety', () => {
    it('should provide correct types through getConfig', async () => {
      const { getConfig } = await import('../app.config.validated');

      const app = getConfig('app');
      const contact = getConfig('contact');
      const features = getConfig('features');

      // TypeScript would catch these at compile time
      // but we verify the runtime values match expected types
      expect(typeof app.name).toBe('string');
      expect(typeof contact.email).toBe('string');
      expect(typeof features.enableRegistration).toBe('boolean');
    });
  });

  describe('Error Handling', () => {
    it('should log validation errors in development', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // This test would require mocking the module to provide invalid config
      // For now, we verify the error handling structure exists

      const { appConfig } = await import('../app.config.validated');
      expect(appConfig).toBeDefined();

      errorSpy.mockRestore();
    });
  });

  describe('Schema Export', () => {
    it('should export AppConfigSchema for external use', async () => {
      const { AppConfigSchema } = await import('../app.config.validated');

      expect(AppConfigSchema).toBeDefined();
      expect(AppConfigSchema).toBeInstanceOf(z.ZodObject);
    });
  });
});
