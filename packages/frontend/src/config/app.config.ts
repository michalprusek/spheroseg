/**
 * Application configuration
 * Centralized configuration for all app settings including contact info, URLs, etc.
 */

export const appConfig = {
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
    defaultTheme: 'system' as 'light' | 'dark' | 'system',
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
    logLevel: import.meta.env.VITE_LOG_LEVEL || 'info',
  },
} as const;

// Type-safe config getter
export function getConfig<T extends keyof typeof appConfig>(
  section: T
): typeof appConfig[T] {
  return appConfig[section];
}

// Helper functions
export const getContactEmail = () => appConfig.contact.email;
export const getSupportEmail = () => appConfig.contact.supportEmail;
export const getAppName = () => appConfig.app.name;
export const getAppFullName = () => appConfig.app.fullName;
export const getOrganizationName = () => appConfig.organization.primary.name;
export const getGithubUrl = () => appConfig.social.github.url;

// Environment-specific overrides
if (import.meta.env.DEV) {
  console.log('App Config loaded:', {
    environment: import.meta.env.MODE,
    features: appConfig.features,
  });
}