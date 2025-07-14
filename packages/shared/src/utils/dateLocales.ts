/**
 * Date Locale Management
 * 
 * Optimized locale imports for date-fns with tree-shaking support.
 * Only imports the locales that are actually used in the application.
 */

// Import only supported locales to minimize bundle size
import { enUS } from 'date-fns/locale/en-US';
import { cs } from 'date-fns/locale/cs';
import { de } from 'date-fns/locale/de';
import { es } from 'date-fns/locale/es';
import { fr } from 'date-fns/locale/fr';
import { zhCN } from 'date-fns/locale/zh-CN';
import type { Locale } from 'date-fns';

// Locale map with all variations
export const dateLocales = {
  'en': enUS,
  'en-US': enUS,
  'en-GB': enUS, // Fallback to en-US
  'cs': cs,
  'cs-CZ': cs,
  'de': de,
  'de-DE': de,
  'de-AT': de, // Austrian German
  'de-CH': de, // Swiss German
  'es': es,
  'es-ES': es,
  'es-MX': es, // Mexican Spanish
  'es-AR': es, // Argentine Spanish
  'fr': fr,
  'fr-FR': fr,
  'fr-CA': fr, // Canadian French
  'fr-CH': fr, // Swiss French
  'zh': zhCN,
  'zh-CN': zhCN,
  'zh-Hans': zhCN, // Simplified Chinese
} as const;

// Type for supported locale codes
export type SupportedLocaleCode = keyof typeof dateLocales;

// Default locale
export const defaultLocale: Locale = enUS;
export const defaultLocaleCode = 'en-US';

// Locale metadata
export interface LocaleMetadata {
  code: string;
  name: string;
  nativeName: string;
  dateFormat: string;
  timeFormat: string;
  firstDayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, 1 = Monday, etc.
}

export const localeMetadata: Record<string, LocaleMetadata> = {
  'en-US': {
    code: 'en-US',
    name: 'English (US)',
    nativeName: 'English',
    dateFormat: 'MM/dd/yyyy',
    timeFormat: 'h:mm a',
    firstDayOfWeek: 0, // Sunday
  },
  'cs': {
    code: 'cs',
    name: 'Czech',
    nativeName: 'Čeština',
    dateFormat: 'd. M. yyyy',
    timeFormat: 'H:mm',
    firstDayOfWeek: 1, // Monday
  },
  'de': {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    dateFormat: 'dd.MM.yyyy',
    timeFormat: 'HH:mm',
    firstDayOfWeek: 1, // Monday
  },
  'es': {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    dateFormat: 'dd/MM/yyyy',
    timeFormat: 'H:mm',
    firstDayOfWeek: 1, // Monday
  },
  'fr': {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    dateFormat: 'dd/MM/yyyy',
    timeFormat: 'HH:mm',
    firstDayOfWeek: 1, // Monday
  },
  'zh-CN': {
    code: 'zh-CN',
    name: 'Chinese (Simplified)',
    nativeName: '简体中文',
    dateFormat: 'yyyy/MM/dd',
    timeFormat: 'HH:mm',
    firstDayOfWeek: 1, // Monday
  },
};

/**
 * Get a date locale by code with fallback
 */
export function getDateLocale(localeCode?: string | null): Locale {
  if (!localeCode) return defaultLocale;
  
  // Try exact match
  if (localeCode in dateLocales) {
    return dateLocales[localeCode as SupportedLocaleCode];
  }
  
  // Try language code only (e.g., 'en' from 'en-GB')
  const languageCode = localeCode.split('-')[0].toLowerCase();
  if (languageCode in dateLocales) {
    return dateLocales[languageCode as SupportedLocaleCode];
  }
  
  // Try with country code normalized (e.g., 'en-gb' -> 'en-GB')
  const normalizedCode = normalizeLocaleCode(localeCode);
  if (normalizedCode in dateLocales) {
    return dateLocales[normalizedCode as SupportedLocaleCode];
  }
  
  return defaultLocale;
}

/**
 * Get locale metadata
 */
export function getLocaleMetadata(localeCode?: string | null): LocaleMetadata {
  if (!localeCode) return localeMetadata[defaultLocaleCode];
  
  // Try exact match
  if (localeCode in localeMetadata) {
    return localeMetadata[localeCode];
  }
  
  // Try language code only
  const languageCode = localeCode.split('-')[0].toLowerCase();
  const metadata = Object.values(localeMetadata).find(
    m => m.code.toLowerCase().startsWith(languageCode)
  );
  
  return metadata || localeMetadata[defaultLocaleCode];
}

/**
 * Check if a locale is supported
 */
export function isLocaleSupported(localeCode: string): boolean {
  return (
    localeCode in dateLocales ||
    localeCode.split('-')[0].toLowerCase() in dateLocales ||
    normalizeLocaleCode(localeCode) in dateLocales
  );
}

/**
 * Normalize locale code format
 */
export function normalizeLocaleCode(localeCode: string): string {
  const parts = localeCode.split(/[-_]/);
  if (parts.length === 1) {
    return parts[0].toLowerCase();
  }
  
  // Language code lowercase, country code uppercase
  return `${parts[0].toLowerCase()}-${parts[1].toUpperCase()}`;
}

/**
 * Get list of supported locales
 */
export function getSupportedLocales(): Array<{
  code: string;
  name: string;
  nativeName: string;
}> {
  return Object.values(localeMetadata).map(({ code, name, nativeName }) => ({
    code,
    name,
    nativeName,
  }));
}

/**
 * Get locale from browser
 */
export function getBrowserLocale(): string {
  if (typeof window === 'undefined') return defaultLocaleCode;
  
  // Try navigator.language first
  if (window.navigator.language) {
    return window.navigator.language;
  }
  
  // Fallback to navigator.languages
  if (window.navigator.languages && window.navigator.languages.length > 0) {
    return window.navigator.languages[0];
  }
  
  return defaultLocaleCode;
}

/**
 * Get the best matching locale from a list of preferences
 */
export function getBestMatchingLocale(preferences: string[]): string {
  for (const pref of preferences) {
    if (isLocaleSupported(pref)) {
      return pref;
    }
    
    // Try language code only
    const langCode = pref.split('-')[0];
    if (isLocaleSupported(langCode)) {
      return langCode;
    }
  }
  
  return defaultLocaleCode;
}

// Export a helper to use with date-fns format functions
export function getFormatOptions(localeCode?: string | null): { locale: Locale } {
  return { locale: getDateLocale(localeCode) };
}

// Default export with all utilities
export default {
  dateLocales,
  defaultLocale,
  defaultLocaleCode,
  localeMetadata,
  getDateLocale,
  getLocaleMetadata,
  isLocaleSupported,
  normalizeLocaleCode,
  getSupportedLocales,
  getBrowserLocale,
  getBestMatchingLocale,
  getFormatOptions,
};