import i18nInstance from 'i18next';
import { initReactI18next } from 'react-i18next';
import { initializeTranslations } from '@/utils/translationLoader';
import logger from './utils/logger';

// Define specific translations inline
const projectNoImagesStrings = {
  en: {
    title: 'No Images Yet',
    description: "This project doesn't have any images yet. Upload images to get started with segmentation.",
    uploadButton: 'Upload Images',
  },
  cs: {
    title: 'Zatím žádné obrázky',
    description: 'Tento projekt zatím neobsahuje žádné obrázky. Nahrajte obrázky a začněte se segmentací.',
    uploadButton: 'Nahrát obrázky',
  },
};
const projectErrorLoadingString = 'Error loading project';

// Create a promise that resolves when i18next is initialized
export const i18nInitializedPromise = (async () => {
  try {
    logger.info('[i18n] Starting asynchronous initialization...');
    const baseResources = await initializeTranslations();
    logger.info('[i18n] Base translations loaded:', Object.keys(baseResources || {}));

    // Ensure English translations are present before merging
    if (!baseResources.en) {
      baseResources.en = { translation: {} };
    } else if (!baseResources.en.translation) {
      baseResources.en.translation = {};
    }

    // Merge additional translations into English
    const enTranslation = baseResources.en.translation as Record<string, any>; 
    enTranslation.project = { ...enTranslation.project, noImages: projectNoImagesStrings.en };
    enTranslation.projectErrorLoading = projectErrorLoadingString;
    logger.info('[i18n] Merged additional EN translations into:', Object.keys(baseResources.en.translation));

    // Ensure Czech translations are present before merging
    if (!baseResources.cs) {
      baseResources.cs = { translation: {} };
    } else if (!baseResources.cs.translation) {
      baseResources.cs.translation = {};
    }

    // Merge additional translations into Czech
    const csTranslation = baseResources.cs.translation as Record<string, any>;
    csTranslation.project = { ...csTranslation.project, noImages: projectNoImagesStrings.cs };
    csTranslation.projectErrorLoading = 'Chyba při načítání projektu';
    logger.info('[i18n] Merged additional CS translations into:', Object.keys(baseResources.cs.translation));

    await i18nInstance.use(initReactI18next).init({
      resources: baseResources,
      lng: 'en', 
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false, 
      },
      debug: process.env.NODE_ENV === 'development',
    });
    logger.info('[i18n] i18next initialized successfully. Loaded languages:', Object.keys(i18nInstance.services.resourceStore.data));
    return i18nInstance; 
  } catch (error) {
    logger.error('[i18n] Failed to initialize i18next:', error);
    throw error;
  }
})();

logger.info('[i18n] i18n.ts module execution complete, initialization is async.');

export default i18nInstance;