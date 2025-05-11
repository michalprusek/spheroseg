import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation files
import enTranslations from '@/translations/en';
import csTranslations from '@/translations/cs';
import deTranslations from '@/translations/de';
import esTranslations from '@/translations/es';
import frTranslations from '@/translations/fr';
import zhTranslations from '@/translations/zh';

// Add missing translations for project.noImages
const projectNoImagesTranslations = {
  title: 'No Images Yet',
  description: "This project doesn't have any images yet. Upload images to get started with segmentation.",
  uploadButton: 'Upload Images',
};

// Make sure enTranslations exists and has the right structure
if (!enTranslations) {
  console.warn('English translations not found, creating default object');
  (window as any).enTranslations = {};
}

// Create a proper structure for translations if it doesn't exist
if (!enTranslations.project) {
  enTranslations.project = {};
}

// Add the missing translations directly to the translation object
enTranslations.project.noImages = projectNoImagesTranslations;
enTranslations.project.errorLoading = 'Error loading project';

// Initialize i18next
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: enTranslations },
    cs: { translation: csTranslations },
    de: { translation: deTranslations },
    es: { translation: esTranslations },
    fr: { translation: frTranslations },
    zh: { translation: zhTranslations },
  },
  lng: 'en', // Default language
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React already escapes values
  },
  react: {
    useSuspense: false, // Disable suspense to avoid issues
  },
});

// Add the translations after initialization to ensure they're available
i18n.addResourceBundle(
  'en',
  'translation',
  {
    project: {
      noImages: projectNoImagesTranslations,
      errorLoading: 'Error loading project',
    },
  },
  true,
  true,
);

export default i18n;
