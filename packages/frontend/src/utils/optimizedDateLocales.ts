/**
 * Optimized date-fns locale imports
 * 
 * Instead of importing all locales, only import the ones we support.
 * This significantly reduces bundle size by tree-shaking unused locales.
 */

// Only import the locales we actually support
import enUS from 'date-fns/locale/en-US';
import cs from 'date-fns/locale/cs';
import de from 'date-fns/locale/de';
import es from 'date-fns/locale/es';
import fr from 'date-fns/locale/fr';
import zhCN from 'date-fns/locale/zh-CN';

// Create a map of supported locales
export const dateLocales = {
  'en': enUS,
  'en-US': enUS,
  'cs': cs,
  'cs-CZ': cs,
  'de': de,
  'de-DE': de,
  'es': es,
  'es-ES': es,
  'fr': fr,
  'fr-FR': fr,
  'zh': zhCN,
  'zh-CN': zhCN,
} as const;

// Type for supported locale codes
export type SupportedLocale = keyof typeof dateLocales;

// Default locale
export const defaultDateLocale = enUS;

/**
 * Get a date locale by code, with fallback to default
 */
export const getDateLocale = (localeCode: string) => {
  // Try exact match first
  if (localeCode in dateLocales) {
    return dateLocales[localeCode as SupportedLocale];
  }
  
  // Try language code only (e.g., 'en' from 'en-GB')
  const languageCode = localeCode.split('-')[0];
  if (languageCode in dateLocales) {
    return dateLocales[languageCode as SupportedLocale];
  }
  
  // Return default locale
  return defaultDateLocale;
};

/**
 * Check if a locale is supported
 */
export const isLocaleSupported = (localeCode: string): boolean => {
  return localeCode in dateLocales || localeCode.split('-')[0] in dateLocales;
};