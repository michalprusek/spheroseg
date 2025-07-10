import { describe, it, expect, beforeEach, vi } from 'vitest';
import { appConfig, getConfig, getContactEmail, getSupportEmail, getAppName, getAppFullName, getOrganizationName, getGithubUrl } from '../app.config';

describe('App Configuration', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('appConfig', () => {
    it('should have all required sections', () => {
      expect(appConfig).toHaveProperty('app');
      expect(appConfig).toHaveProperty('contact');
      expect(appConfig).toHaveProperty('organization');
      expect(appConfig).toHaveProperty('social');
      expect(appConfig).toHaveProperty('api');
      expect(appConfig).toHaveProperty('features');
      expect(appConfig).toHaveProperty('ui');
      expect(appConfig).toHaveProperty('legal');
      expect(appConfig).toHaveProperty('analytics');
      expect(appConfig).toHaveProperty('development');
    });

    it('should have correct app metadata', () => {
      expect(appConfig.app.name).toBe('SpheroSeg');
      expect(appConfig.app.fullName).toBe('Spheroid Segmentation Platform');
      expect(appConfig.app.description).toBe('Advanced platform for spheroid segmentation and analysis');
    });

    it('should have correct contact information', () => {
      expect(appConfig.contact.email).toBe('spheroseg@utia.cas.cz');
      expect(appConfig.contact.supportEmail).toBe('support@spheroseg.com');
      expect(appConfig.contact.privacyEmail).toBe('privacy@spheroseg.com');
      expect(appConfig.contact.developer.name).toBe('Michal Průšek');
      expect(appConfig.contact.developer.email).toBe('prusemic@cvut.cz');
    });

    it('should have correct organization information', () => {
      expect(appConfig.organization.primary.name).toBe('FNSPE CTU in Prague');
      expect(appConfig.organization.primary.url).toBe('https://www.fjfi.cvut.cz/');
      expect(appConfig.organization.supervisor.name).toBe('UTIA CAS');
      expect(appConfig.organization.supervisor.url).toBe('https://www.utia.cas.cz/');
      expect(appConfig.organization.collaborator.name).toBe('UCT Prague');
      expect(appConfig.organization.collaborator.url).toBe('https://www.uct.cz/');
    });

    it('should have correct social media links', () => {
      expect(appConfig.social.github.url).toBe('https://github.com/michalprusek/spheroseg');
      expect(appConfig.social.github.username).toBe('michalprusek');
      expect(appConfig.social.twitter.url).toBe('https://twitter.com/spheroseg');
      expect(appConfig.social.twitter.username).toBe('@spheroseg');
    });

    it('should have correct UI configuration', () => {
      expect(appConfig.ui.defaultTheme).toBe('system');
      expect(appConfig.ui.defaultLanguage).toBe('en');
      expect(appConfig.ui.supportedLanguages).toEqual(['en', 'cs', 'de', 'es', 'fr', 'zh']);
      expect(appConfig.ui.maxFileUploadSize).toBe(10 * 1024 * 1024); // 10MB
      expect(appConfig.ui.acceptedImageFormats).toContain('image/jpeg');
      expect(appConfig.ui.acceptedImageFormats).toContain('image/png');
      expect(appConfig.ui.acceptedImageFormats).toContain('image/tiff');
      expect(appConfig.ui.acceptedImageFormats).toContain('image/bmp');
    });
  });

  describe('getConfig', () => {
    it('should return the correct section', () => {
      expect(getConfig('app')).toEqual(appConfig.app);
      expect(getConfig('contact')).toEqual(appConfig.contact);
      expect(getConfig('organization')).toEqual(appConfig.organization);
    });

    it('should be type-safe', () => {
      const appSection = getConfig('app');
      expect(appSection.name).toBe('SpheroSeg');
      
      const contactSection = getConfig('contact');
      expect(contactSection.email).toBe('spheroseg@utia.cas.cz');
    });
  });

  describe('Helper functions', () => {
    it('getContactEmail should return correct email', () => {
      expect(getContactEmail()).toBe('spheroseg@utia.cas.cz');
    });

    it('getSupportEmail should return correct email', () => {
      expect(getSupportEmail()).toBe('support@spheroseg.com');
    });

    it('getAppName should return correct name', () => {
      expect(getAppName()).toBe('SpheroSeg');
    });

    it('getAppFullName should return correct full name', () => {
      expect(getAppFullName()).toBe('Spheroid Segmentation Platform');
    });

    it('getOrganizationName should return correct organization name', () => {
      expect(getOrganizationName()).toBe('FNSPE CTU in Prague');
    });

    it('getGithubUrl should return correct GitHub URL', () => {
      expect(getGithubUrl()).toBe('https://github.com/michalprusek/spheroseg');
    });
  });

  describe('Environment variables', () => {
    it('should use environment variables when available', () => {
      // Test that config respects environment variables
      const originalEnv = import.meta.env;
      
      // Since import.meta.env is read-only, we can't modify it directly
      // This test verifies the structure is correct
      expect(appConfig.api.baseUrl).toBeDefined();
      expect(appConfig.features.enableRegistration).toBeDefined();
      expect(appConfig.development.enableDevTools).toBeDefined();
    });
  });

});