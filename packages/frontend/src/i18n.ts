import i18nInstance from 'i18next';
import { initReactI18next } from 'react-i18next';
import { initializeTranslations } from '@/utils/translationLoader';
import logger from './utils/logger';

// Create a promise that resolves when i18next is initialized
export const i18nInitializedPromise = (async () => {
  try {
    logger.info('[i18n] Starting asynchronous initialization...');
    const baseResources = await initializeTranslations();
    logger.info('[i18n] Base translations loaded:', Object.keys(baseResources || {}));

    // Verify translations structure
    if (!baseResources?.en?.translation) {
      logger.error('[i18n] Critical: No English translations found in resources!');
    }

    await i18nInstance.use(initReactI18next).init({
      resources: baseResources,
      lng: 'en',
      fallbackLng: 'en',
      defaultNS: 'translation',
      ns: ['translation'],
      interpolation: {
        escapeValue: false,
      },
      returnObjects: true, // Allow returning arrays and objects
      debug: process.env.NODE_ENV === 'development',
      react: {
        useSuspense: false, // Prevent suspense issues during init
      },
      // Disable language detection to prevent unexpected switching
      detection: {
        order: [], // Empty array disables all detection
        caches: [] // Don't cache detected language
      },
    });
    logger.info(
      '[i18n] i18next initialized successfully. Loaded languages:',
      Object.keys(i18nInstance.services.resourceStore.data),
    );

    // Add i18next to window for debugging in development
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      (window as any).i18next = i18nInstance;

      // Quick test to ensure translations work
      const testKey = i18nInstance.t('common.loadingApplication');
      if (testKey === 'common.loadingApplication') {
        logger.error('[i18n] Translation test failed - keys are not being resolved!');
      }
    }
    return i18nInstance;
  } catch (error) {
    logger.error('[i18n] Failed to initialize i18next:', error);
    throw error;
  }
})();

logger.info('[i18n] i18n.ts module execution complete, initialization is async.');

export default i18nInstance;
