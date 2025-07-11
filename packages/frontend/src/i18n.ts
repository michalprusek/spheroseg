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
    
    // Debug: Log a sample of the loaded translations
    if (baseResources?.en?.translation) {
      logger.info('[i18n] Sample EN translations:', {
        hasCommon: !!baseResources.en.translation.common,
        hasProjects: !!baseResources.en.translation.projects,
        hasStatsOverview: !!baseResources.en.translation.statsOverview,
        commonKeys: Object.keys(baseResources.en.translation.common || {}).slice(0, 5),
      });
    }

    await i18nInstance.use(initReactI18next).init({
      resources: baseResources,
      lng: 'en',
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false,
      },
      returnObjects: true, // Allow returning arrays and objects
      debug: process.env.NODE_ENV === 'development',
    });
    logger.info(
      '[i18n] i18next initialized successfully. Loaded languages:',
      Object.keys(i18nInstance.services.resourceStore.data),
    );
    
    // Debug: Check if translations are accessible
    const testKeys = [
      'common.loadingApplication',
      'projects.createProject',
      'statsOverview.totalProjects',
      'common.delete'
    ];
    
    logger.info('[i18n] Testing translation keys:');
    testKeys.forEach(key => {
      const value = i18nInstance.t(key);
      logger.info(`[i18n] ${key} = "${value}" (missing: ${value === key})`);
    });
    return i18nInstance;
  } catch (error) {
    logger.error('[i18n] Failed to initialize i18next:', error);
    throw error;
  }
})();

logger.info('[i18n] i18n.ts module execution complete, initialization is async.');

export default i18nInstance;
