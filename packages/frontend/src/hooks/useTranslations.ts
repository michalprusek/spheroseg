import { useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import i18next from 'i18next';

// Import translation files
import enTranslations from '@/translations/en';
import csTranslations from '@/translations/cs';
import deTranslations from '@/translations/de';
import esTranslations from '@/translations/es';
import frTranslations from '@/translations/fr';
import zhTranslations from '@/translations/zh';

// Define the structure for nested translation objects
interface TranslationObject {
  [key: string]: string | TranslationObject;
}

// Type guard to check if a value is a TranslationObject
function isTranslationObject(value: unknown): value is TranslationObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const useTranslations = () => {
  const { language, t: contextT } = useLanguage();

  // First try to use the t function from the LanguageContext
  // If that fails, fall back to our manual implementation
  const t = useCallback(
    (key: string, options?: Record<string, any>): string => {
      // Try to use i18next first if it's initialized
      if (i18next.isInitialized) {
        try {
          const translated = i18next.t(key, options);
          if (translated && translated !== key) {
            return translated;
          }
        } catch (error) {
          // Only log in development mode
          if (process.env.NODE_ENV === 'development') {
            console.warn(`i18next translation error for key "${key}":`, error);
          }
        }
      }

      // If i18next fails or returns the key, try to use the context t function
      if (contextT) {
        try {
          const contextTranslation = contextT(key, options);
          if (contextTranslation && contextTranslation !== key) {
            return contextTranslation;
          }
        } catch (error) {
          // Only log in development mode
          if (process.env.NODE_ENV === 'development') {
            console.warn(`Context translation error for key "${key}":`, error);
          }
        }
      }

      // If both methods fail, fall back to manual translation
      const parts = key.split('.');

      // Select the appropriate translation file based on the current language
      let translations: TranslationObject;
      switch (language) {
        case 'cs':
          translations = csTranslations;
          break;
        case 'de':
          translations = deTranslations;
          break;
        case 'es':
          translations = esTranslations;
          break;
        case 'fr':
          translations = frTranslations;
          break;
        case 'zh':
          translations = zhTranslations;
          break;
        default:
          translations = enTranslations;
      }

      // Navigate through the translation object to find the value
      let value: string | TranslationObject | undefined = translations;
      for (const part of parts) {
        if (isTranslationObject(value) && part in value) {
          value = value[part];
        } else {
          // If the key doesn't exist in the current language, fall back to English
          if (language !== 'en') {
            let englishValue: string | TranslationObject | undefined = enTranslations;
            for (const p of parts) {
              if (isTranslationObject(englishValue) && p in englishValue) {
                englishValue = englishValue[p];
              } else {
                return key; // Key not found in English either
              }
            }
            return typeof englishValue === 'string' ? englishValue : key;
          }
          return key; // Key not found
        }
      }

      return typeof value === 'string' ? value : key;
    },
    [language, contextT],
  ); // Re-create t function when language or contextT changes

  return { t };
};
