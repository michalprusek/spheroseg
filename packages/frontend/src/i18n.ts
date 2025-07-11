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
      defaultNS: 'translation',
      ns: ['translation'],
      interpolation: {
        escapeValue: false,
      },
      returnObjects: true, // Allow returning arrays and objects
      debug: process.env.NODE_ENV === 'development',
      // Add these to help with debugging
      load: 'languageOnly',
      keySeparator: '.',
      nsSeparator: false,
    });
    logger.info(
      '[i18n] i18next initialized successfully. Loaded languages:',
      Object.keys(i18nInstance.services.resourceStore.data),
    );
    
    // Debug: Check resource store structure
    const resourceStore = i18nInstance.services.resourceStore;
    logger.info('[i18n] Resource store structure:', {
      data: resourceStore.data,
      enData: resourceStore.data?.en,
      enTranslation: resourceStore.data?.en?.translation,
      commonFromStore: resourceStore.data?.en?.translation?.common,
      sampleKey: resourceStore.data?.en?.translation?.common?.loadingApplication
    });
    
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
      const directAccess = i18nInstance.getResource('en', 'translation', key);
      logger.info(`[i18n] ${key} = "${value}" (missing: ${value === key}, direct: ${directAccess})`);
    });
    
    // Add i18next to window for debugging
    if (typeof window !== 'undefined') {
      (window as any).i18next = i18nInstance;
    }
    return i18nInstance;
  } catch (error) {
    logger.error('[i18n] Failed to initialize i18next:', error);
    throw error;
  }
})();

logger.info('[i18n] i18n.ts module execution complete, initialization is async.');

export default i18nInstance;
