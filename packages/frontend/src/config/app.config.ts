/**
 * Application configuration
 * Centralized configuration for all app settings including contact info, URLs, etc.
 * 
 * This file re-exports the validated configuration for backward compatibility.
 * The actual configuration with runtime validation is in app.config.validated.ts
 */

// Re-export everything from the validated configuration
export {
  appConfig,
  getConfig,
  getContactEmail,
  getSupportEmail,
  getAppName,
  getAppFullName,
  getOrganizationName,
  getGithubUrl,
  updateConfig,
  AppConfigSchema,
  type AppConfig
} from './app.config.validated';

