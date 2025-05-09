import { useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

// Import translation files with the correct .ts extension
import enTranslations from '@/translations/en.ts';
import csTranslations from '@/translations/cs.ts';
import deTranslations from '@/translations/de.ts';
import esTranslations from '@/translations/es.ts';
import frTranslations from '@/translations/fr.ts';
import zhTranslations from '@/translations/zh.ts';

// Define the structure for nested translation objects
interface TranslationObject {
  [key: string]: string | TranslationObject;
}

// Type guard to check if a value is a TranslationObject
function isTranslationObject(value: unknown): value is TranslationObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const useTranslations = () => {
  const { language } = useLanguage();

  const t = useCallback((key: string): string => {
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
  }, [language]); // Re-create t function when language changes

  return { t };
};
