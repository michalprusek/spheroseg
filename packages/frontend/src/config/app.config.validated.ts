/**
 * Application configuration with runtime validation
 * Ensures all configuration values are valid and type-safe
 */

import { z } from 'zod';

// Define the configuration schema
const AppConfigSchema = z.object({
  // Application metadata
  app: z.object({
    name: z.string().min(1, 'App name is required'),
    fullName: z.string().min(1, 'App full name is required'),
    description: z.string().min(1, 'App description is required'),
    version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be in format X.Y.Z'),
  }),

  // Contact information
  contact: z.object({
    email: z.string().email('Invalid contact email'),
    supportEmail: z.string().email('Invalid support email'),
    privacyEmail: z.string().email('Invalid privacy email'),
    developer: z.object({
      name: z.string().min(1, 'Developer name is required'),
      title: z.string().min(1, 'Developer title is required'),
      email: z.string().email('Invalid developer email'),
    }),
  }),

  // Organization information
  organization: z.object({
    primary: z.object({
      name: z.string().min(1, 'Primary org name is required'),
      nameShort: z.string().min(1, 'Primary org short name is required'),
      url: z.string().url('Invalid primary org URL'),
    }),
    supervisor: z.object({
      name: z.string().min(1, 'Supervisor name is required'),
      fullName: z.string().min(1, 'Supervisor full name is required'),
      url: z.string().url('Invalid supervisor URL'),
    }),
    collaborator: z.object({
      name: z.string().min(1, 'Collaborator name is required'),
      department: z.string().min(1, 'Department is required'),
      url: z.string().url('Invalid collaborator URL'),
    }),
  }),

  // Social media and external links
  social: z.object({
    github: z.object({
      url: z.string().url('Invalid GitHub URL'),
      username: z.string().min(1, 'GitHub username is required'),
    }),
    twitter: z.object({
      url: z.string().url('Invalid Twitter URL'),
      username: z.string().regex(/^@\w+$/, 'Twitter username must start with @'),
    }),
  }),

  // API and external services
  api: z.object({
    baseUrl: z.string().min(1, 'API base URL is required'),
    timeout: z.number().positive('Timeout must be positive').max(60000, 'Timeout too high'),
    retryAttempts: z.number().int().min(0).max(5, 'Retry attempts must be 0-5'),
  }),

  // Feature flags
  features: z.object({
    enableRegistration: z.boolean(),
    enableGoogleAuth: z.boolean(),
    enableGithubAuth: z.boolean(),
    enableExperimentalFeatures: z.boolean(),
    maintenanceMode: z.boolean(),
  }),

  // UI configuration
  ui: z.object({
    defaultTheme: z.enum(['light', 'dark', 'system']),
    defaultLanguage: z.string().length(2, 'Language code must be 2 characters'),
    supportedLanguages: z.array(z.string().length(2)).min(1, 'At least one language required'),
    animationsEnabled: z.boolean(),
    maxFileUploadSize: z.number().positive('Upload size must be positive'),
    acceptedImageFormats: z.array(z.string()).min(1, 'At least one image format required'),
  }),

  // Legal and compliance
  legal: z.object({
    privacyPolicyUrl: z.string().min(1, 'Privacy policy URL is required'),
    termsOfServiceUrl: z.string().min(1, 'Terms of service URL is required'),
    cookiePolicyUrl: z.string().min(1, 'Cookie policy URL is required'),
    lastUpdated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  }),

  // Analytics and monitoring
  analytics: z.object({
    enabled: z.boolean(),
    googleAnalyticsId: z.string().optional(),
    sentryDsn: z.string().optional(),
  }),

  // Development
  development: z.object({
    enableDevTools: z.boolean(),
    enableLogging: z.boolean(),
    logLevel: z.enum(['error', 'warn', 'info', 'debug', 'trace']),
  }),
});

// Type inference from schema
export type AppConfig = z.infer<typeof AppConfigSchema>;

// Raw configuration object
const rawConfig = {
  // Application metadata
  app: {
    name: 'SpheroSeg',
    fullName: 'Spheroid Segmentation Platform',
    description: 'Advanced platform for spheroid segmentation and analysis',
    version: import.meta.env.VITE_APP_VERSION || '1.0.0',
  },

  // Contact information
  contact: {
    email: 'spheroseg@utia.cas.cz',
    supportEmail: 'support@spheroseg.com',
    privacyEmail: 'privacy@spheroseg.com',
    developer: {
      name: 'Michal Průšek',
      title: 'Bc. Michal Průšek',
      email: 'prusemic@cvut.cz',
    },
  },

  // Organization information
  organization: {
    primary: {
      name: 'FNSPE CTU in Prague',
      nameShort: 'FNSPE CTU',
      url: 'https://www.fjfi.cvut.cz/',
    },
    supervisor: {
      name: 'UTIA CAS',
      fullName: 'Institute of Information Theory and Automation',
      url: 'https://www.utia.cas.cz/',
    },
    collaborator: {
      name: 'UCT Prague',
      department: 'Department of Biochemistry and Microbiology',
      url: 'https://www.uct.cz/',
    },
  },

  // Social media and external links
  social: {
    github: {
      url: 'https://github.com/michalprusek/spheroseg',
      username: 'michalprusek',
    },
    twitter: {
      url: 'https://twitter.com/spheroseg',
      username: '@spheroseg',
    },
  },

  // API and external services
  api: {
    baseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
    timeout: 30000,
    retryAttempts: 3,
  },

  // Feature flags
  features: {
    enableRegistration: import.meta.env.VITE_ENABLE_REGISTRATION !== 'false',
    enableGoogleAuth: import.meta.env.VITE_ENABLE_GOOGLE_AUTH === 'true',
    enableGithubAuth: import.meta.env.VITE_ENABLE_GITHUB_AUTH === 'true',
    enableExperimentalFeatures: import.meta.env.VITE_ENABLE_EXPERIMENTAL === 'true',
    maintenanceMode: import.meta.env.VITE_MAINTENANCE_MODE === 'true',
  },

  // UI configuration
  ui: {
    defaultTheme: 'system' as const,
    defaultLanguage: 'en',
    supportedLanguages: ['en', 'cs', 'de', 'es', 'fr', 'zh'],
    animationsEnabled: true,
    maxFileUploadSize: 10 * 1024 * 1024, // 10MB
    acceptedImageFormats: ['image/jpeg', 'image/png', 'image/tiff', 'image/bmp'],
  },

  // Legal and compliance
  legal: {
    privacyPolicyUrl: '/privacy-policy',
    termsOfServiceUrl: '/terms-of-service',
    cookiePolicyUrl: '/cookie-policy',
    lastUpdated: '2025-01-07',
  },

  // Analytics and monitoring
  analytics: {
    enabled: import.meta.env.VITE_ANALYTICS_ENABLED === 'true',
    googleAnalyticsId: import.meta.env.VITE_GA_ID,
    sentryDsn: import.meta.env.VITE_SENTRY_DSN,
  },

  // Development
  development: {
    enableDevTools: import.meta.env.DEV,
    enableLogging: import.meta.env.VITE_ENABLE_LOGGING !== 'false',
    logLevel: (import.meta.env.VITE_LOG_LEVEL || 'info') as 'error' | 'warn' | 'info' | 'debug' | 'trace',
  },
};

// Validate configuration at runtime
let appConfig: AppConfig;

try {
  appConfig = AppConfigSchema.parse(rawConfig);

  if (import.meta.env.DEV) {
    console.log('✅ App configuration validated successfully');
  }
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Configuration validation failed:', error.errors);

    // In development, throw error to catch issues early
    if (import.meta.env.DEV) {
      throw new Error(
        `Configuration validation failed: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
      );
    }

    // In production, log error and use defaults
    console.warn('Using default configuration due to validation errors');
    appConfig = rawConfig as AppConfig; // Fallback to raw config
  } else {
    throw error;
  }
}

// Export validated configuration
export { appConfig };

// Type-safe config getter
export function getConfig<T extends keyof AppConfig>(section: T): AppConfig[T] {
  return appConfig[section];
}

// Helper functions with validation
export const getContactEmail = () => {
  const email = appConfig.contact.email;
  if (!z.string().email().safeParse(email).success) {
    console.warn('Invalid contact email in configuration');
    return 'contact@example.com'; // Fallback
  }
  return email;
};

export const getSupportEmail = () => {
  const email = appConfig.contact.supportEmail;
  if (!z.string().email().safeParse(email).success) {
    console.warn('Invalid support email in configuration');
    return 'support@example.com'; // Fallback
  }
  return email;
};

export const getAppName = () => appConfig.app.name;
export const getAppFullName = () => appConfig.app.fullName;
export const getOrganizationName = () => appConfig.organization.primary.name;
export const getGithubUrl = () => appConfig.social.github.url;

// Configuration update function (for runtime updates)
export function updateConfig<K extends keyof AppConfig>(section: K, updates: Partial<AppConfig[K]>): void {
  const newSection = { ...appConfig[section], ...updates };

  // Validate the updated section
  try {
    const sectionSchema = AppConfigSchema.shape[section];
    const validated = sectionSchema.parse(newSection);
    appConfig[section] = validated;

    if (import.meta.env.DEV) {
      console.log(`✅ Configuration section '${section}' updated successfully`);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(`❌ Configuration update failed for '${section}':`, error.errors);
      throw new Error(`Invalid configuration update: ${error.errors.map((e) => e.message).join(', ')}`);
    }
    throw error;
  }
}

// Export schema for testing
export { AppConfigSchema };
