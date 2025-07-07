import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';
import { format as formatDate, formatRelative, formatDistance, isValid } from 'date-fns';
import * as locales from 'date-fns/locale';
import { getConfigValue } from '@/config';
import { useStore } from '@/store';

/**
 * Enhanced Localization Service
 * Unified service for all i18n needs: translations, formatting, and localization
 */

export type SupportedLanguage = 'en' | 'cs' | 'de' | 'es' | 'fr' | 'zh';
export type TextDirection = 'ltr' | 'rtl';

export interface LanguageInfo {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
  direction: TextDirection;
  dateLocale: Locale;
  numberFormat: {
    decimal: string;
    thousands: string;
    grouping: number[];
  };
  currencyFormat: {
    symbol: string;
    position: 'before' | 'after';
    decimal: string;
    thousands: string;
  };
}

// Language configurations
const LANGUAGES: Record<SupportedLanguage, LanguageInfo> = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇬🇧',
    direction: 'ltr',
    dateLocale: locales.enUS,
    numberFormat: {
      decimal: '.',
      thousands: ',',
      grouping: [3],
    },
    currencyFormat: {
      symbol: '$',
      position: 'before',
      decimal: '.',
      thousands: ',',
    },
  },
  cs: {
    code: 'cs',
    name: 'Czech',
    nativeName: 'Čeština',
    flag: '🇨🇿',
    direction: 'ltr',
    dateLocale: locales.cs,
    numberFormat: {
      decimal: ',',
      thousands: ' ',
      grouping: [3],
    },
    currencyFormat: {
      symbol: 'Kč',
      position: 'after',
      decimal: ',',
      thousands: ' ',
    },
  },
  de: {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
    direction: 'ltr',
    dateLocale: locales.de,
    numberFormat: {
      decimal: ',',
      thousands: '.',
      grouping: [3],
    },
    currencyFormat: {
      symbol: '€',
      position: 'after',
      decimal: ',',
      thousands: '.',
    },
  },
  es: {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
    direction: 'ltr',
    dateLocale: locales.es,
    numberFormat: {
      decimal: ',',
      thousands: '.',
      grouping: [3],
    },
    currencyFormat: {
      symbol: '€',
      position: 'after',
      decimal: ',',
      thousands: '.',
    },
  },
  fr: {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    flag: '🇫🇷',
    direction: 'ltr',
    dateLocale: locales.fr,
    numberFormat: {
      decimal: ',',
      thousands: ' ',
      grouping: [3],
    },
    currencyFormat: {
      symbol: '€',
      position: 'after',
      decimal: ',',
      thousands: ' ',
    },
  },
  zh: {
    code: 'zh',
    name: 'Chinese',
    nativeName: '中文',
    flag: '🇨🇳',
    direction: 'ltr',
    dateLocale: locales.zhCN,
    numberFormat: {
      decimal: '.',
      thousands: ',',
      grouping: [3],
    },
    currencyFormat: {
      symbol: '¥',
      position: 'before',
      decimal: '.',
      thousands: ',',
    },
  },
};

class LocalizationService {
  private currentLanguage: SupportedLanguage = 'en';
  private translationCache = new Map<string, any>();
  private formatCache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();

  constructor() {
    this.initializeI18n();
  }

  /**
   * Initialize i18next
   */
  private async initializeI18n() {
    await i18n
      .use(HttpBackend)
      .use(LanguageDetector)
      .use(initReactI18next)
      .init({
        fallbackLng: 'en',
        supportedLngs: Object.keys(LANGUAGES),
        ns: ['translation', 'common', 'errors', 'forms', 'navigation', 'segmentation'],
        defaultNS: 'translation',
        
        detection: {
          order: ['localStorage', 'cookie', 'navigator', 'htmlTag'],
          caches: ['localStorage', 'cookie'],
        },

        interpolation: {
          escapeValue: false, // React already escapes values
          format: (value, format, lng) => {
            if (format === 'date') return this.formatDate(value);
            if (format === 'time') return this.formatTime(value);
            if (format === 'number') return this.formatNumber(value);
            if (format === 'currency') return this.formatCurrency(value);
            if (format === 'percent') return this.formatPercent(value);
            return value;
          },
        },

        react: {
          useSuspense: false,
          bindI18n: 'languageChanged loaded',
          bindI18nStore: 'added removed',
        },

        backend: {
          loadPath: '/locales/{{lng}}/{{ns}}.json',
          addPath: '/locales/add/{{lng}}/{{ns}}',
          crossDomain: false,
          withCredentials: false,
        },

        debug: process.env.NODE_ENV === 'development', // Enable for debugging translation loading issues
        load: 'languageOnly', // We don't need region specific translations
        
        keySeparator: '.', // Use dot notation for nested keys
        
        returnNull: false, // Return key if translation is missing
      });

    // Set initial language
    const savedLanguage = this.getStoredLanguage();
    if (savedLanguage) {
      await this.setLanguage(savedLanguage);
    }
  }

  /**
   * Get current language
   */
  getCurrentLanguage(): SupportedLanguage {
    return this.currentLanguage;
  }

  /**
   * Get language info
   */
  getLanguageInfo(code?: SupportedLanguage): LanguageInfo {
    return LANGUAGES[code || this.currentLanguage];
  }

  /**
   * Get all supported languages
   */
  getSupportedLanguages(): LanguageInfo[] {
    return Object.values(LANGUAGES);
  }

  /**
   * Set language
   */
  async setLanguage(language: SupportedLanguage): Promise<void> {
    if (!LANGUAGES[language]) {
      console.warn(`Unsupported language: ${language}`);
      return;
    }

    this.currentLanguage = language;
    
    // Update i18next
    await i18n.changeLanguage(language);
    
    // Update HTML attributes
    document.documentElement.lang = language;
    document.documentElement.dir = LANGUAGES[language].direction;
    
    // Clear format cache when language changes
    this.formatCache.clear();
    
    // Save preference
    this.saveLanguagePreference(language);
    
    // Update store
    const { setLanguage } = useStore.getState();
    setLanguage(language);
  }

  /**
   * Translate key
   */
  t(key: string, options?: any): string {
    return i18n.t(key, options);
  }

  /**
   * Translate with pluralization
   */
  tn(key: string, count: number, options?: any): string {
    return i18n.t(key, { count, ...options });
  }

  /**
   * Check if translation exists
   */
  exists(key: string): boolean {
    return i18n.exists(key);
  }

  /**
   * Format date
   */
  formatDate(date: Date | string | number, formatStr?: string): string {
    const dateObj = this.parseDate(date);
    if (!dateObj) return '';

    const locale = LANGUAGES[this.currentLanguage].dateLocale;
    
    if (formatStr) {
      return formatDate(dateObj, formatStr, { locale });
    }

    // Default format based on locale
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };

    return new Intl.DateTimeFormat(this.currentLanguage, options).format(dateObj);
  }

  /**
   * Format time
   */
  formatTime(date: Date | string | number, includeSeconds = false): string {
    const dateObj = this.parseDate(date);
    if (!dateObj) return '';

    const options: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: 'numeric',
      second: includeSeconds ? 'numeric' : undefined,
    };

    return new Intl.DateTimeFormat(this.currentLanguage, options).format(dateObj);
  }

  /**
   * Format date and time
   */
  formatDateTime(date: Date | string | number, includeSeconds = false): string {
    const dateStr = this.formatDate(date);
    const timeStr = this.formatTime(date, includeSeconds);
    return `${dateStr} ${timeStr}`;
  }

  /**
   * Format relative time
   */
  formatRelativeTime(date: Date | string | number, baseDate?: Date): string {
    const dateObj = this.parseDate(date);
    if (!dateObj) return '';

    const locale = LANGUAGES[this.currentLanguage].dateLocale;
    return formatRelative(dateObj, baseDate || new Date(), { locale });
  }

  /**
   * Format distance
   */
  formatDistance(date: Date | string | number, baseDate?: Date, options?: any): string {
    const dateObj = this.parseDate(date);
    if (!dateObj) return '';

    const locale = LANGUAGES[this.currentLanguage].dateLocale;
    return formatDistance(dateObj, baseDate || new Date(), { locale, ...options });
  }

  /**
   * Format number
   */
  formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
    const cacheKey = `number-${this.currentLanguage}-${JSON.stringify(options)}`;
    
    let formatter = this.formatCache.get(cacheKey) as Intl.NumberFormat;
    if (!formatter) {
      formatter = new Intl.NumberFormat(this.currentLanguage, options);
      this.formatCache.set(cacheKey, formatter);
    }

    return formatter.format(value);
  }

  /**
   * Format currency
   */
  formatCurrency(value: number, currency?: string, options?: Intl.NumberFormatOptions): string {
    const cacheKey = `currency-${this.currentLanguage}-${currency}-${JSON.stringify(options)}`;
    
    let formatter = this.formatCache.get(cacheKey) as Intl.NumberFormat;
    if (!formatter) {
      formatter = new Intl.NumberFormat(this.currentLanguage, {
        style: 'currency',
        currency: currency || 'USD',
        ...options,
      });
      this.formatCache.set(cacheKey, formatter);
    }

    return formatter.format(value);
  }

  /**
   * Format percent
   */
  formatPercent(value: number, options?: Intl.NumberFormatOptions): string {
    const cacheKey = `percent-${this.currentLanguage}-${JSON.stringify(options)}`;
    
    let formatter = this.formatCache.get(cacheKey) as Intl.NumberFormat;
    if (!formatter) {
      formatter = new Intl.NumberFormat(this.currentLanguage, {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
        ...options,
      });
      this.formatCache.set(cacheKey, formatter);
    }

    return formatter.format(value);
  }

  /**
   * Format list
   */
  formatList(items: string[], type: 'conjunction' | 'disjunction' = 'conjunction'): string {
    if ('ListFormat' in Intl) {
      return new (Intl as any).ListFormat(this.currentLanguage, { 
        style: 'long', 
        type 
      }).format(items);
    }
    
    // Fallback for browsers without Intl.ListFormat
    if (items.length === 0) return '';
    if (items.length === 1) return items[0];
    if (items.length === 2) {
      return type === 'conjunction' 
        ? `${items[0]} ${this.t('common.and')} ${items[1]}`
        : `${items[0]} ${this.t('common.or')} ${items[1]}`;
    }
    
    const lastItem = items[items.length - 1];
    const otherItems = items.slice(0, -1).join(', ');
    return type === 'conjunction'
      ? `${otherItems}, ${this.t('common.and')} ${lastItem}`
      : `${otherItems}, ${this.t('common.or')} ${lastItem}`;
  }

  /**
   * Sort array by locale
   */
  sort<T>(array: T[], key?: (item: T) => string): T[] {
    const collator = new Intl.Collator(this.currentLanguage);
    
    return [...array].sort((a, b) => {
      const aVal = key ? key(a) : String(a);
      const bVal = key ? key(b) : String(b);
      return collator.compare(aVal, bVal);
    });
  }

  /**
   * Parse date safely
   */
  private parseDate(date: Date | string | number): Date | null {
    if (!date) return null;
    
    const parsed = date instanceof Date ? date : new Date(date);
    return isValid(parsed) ? parsed : null;
  }

  /**
   * Get stored language preference
   */
  private getStoredLanguage(): SupportedLanguage | null {
    const stored = localStorage.getItem('language');
    return stored && LANGUAGES[stored as SupportedLanguage] ? stored as SupportedLanguage : null;
  }

  /**
   * Save language preference
   */
  private saveLanguagePreference(language: SupportedLanguage): void {
    localStorage.setItem('language', language);
    
    // Also save to backend if user is authenticated
    const { isAuthenticated, tokens } = useStore.getState();
    if (isAuthenticated && tokens) {
      fetch('/api/users/preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokens.accessToken}`,
        },
        body: JSON.stringify({ language }),
      }).catch(console.error);
    }
  }

  /**
   * Load translations dynamically
   * Note: With HTTP backend, this is mostly handled automatically
   * This method is kept for manual loading if needed
   */
  async loadTranslations(namespace: string, language?: SupportedLanguage): Promise<void> {
    const lng = language || this.currentLanguage;
    
    // Force reload the namespace for the language
    try {
      await i18n.loadNamespaces(namespace);
      await i18n.loadLanguages(lng);
      
      // Ensure the namespace is loaded for the specific language
      if (!i18n.hasResourceBundle(lng, namespace)) {
        console.warn(`Namespace ${namespace} not found for language ${lng}, loading...`);
        await i18n.reloadResources(lng, namespace);
      }
    } catch (error) {
      console.error(`Failed to load translations for ${namespace}:`, error);
    }
  }

  /**
   * Get missing translations
   */
  getMissingTranslations(): string[] {
    const missing: string[] = [];
    const resources = i18n.store.data;
    
    Object.keys(resources).forEach(lng => {
      if (lng === 'en') return; // Skip base language
      
      const enResources = resources.en;
      const lngResources = resources[lng];
      
      Object.keys(enResources).forEach(ns => {
        if (!lngResources[ns]) {
          missing.push(`${lng}:${ns}`);
          return;
        }
        
        const enKeys = Object.keys(enResources[ns]);
        const lngKeys = Object.keys(lngResources[ns]);
        
        enKeys.forEach(key => {
          if (!lngKeys.includes(key)) {
            missing.push(`${lng}:${ns}:${key}`);
          }
        });
      });
    });
    
    return missing;
  }

  /**
   * Export translations for external translation services
   */
  exportTranslations(language: SupportedLanguage, format: 'json' | 'csv' | 'xliff' = 'json'): string {
    const resources = i18n.store.data[language];
    if (!resources) return '';

    switch (format) {
      case 'csv': {
        const rows = ['key,value'];
        Object.entries(resources).forEach(([ns, translations]) => {
          Object.entries(translations as any).forEach(([key, value]) => {
            rows.push(`"${ns}:${key}","${value}"`);
          });
        });
        return rows.join('\n');
      }
      
      case 'xliff': {
        // XLIFF format for professional translation tools
        const xliff = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="en" target-language="${language}" datatype="plaintext">
    <body>
      ${Object.entries(resources).map(([ns, translations]) =>
        Object.entries(translations as any).map(([key, value]) => `
      <trans-unit id="${ns}:${key}">
        <source>${resources.en?.[ns]?.[key] || key}</source>
        <target>${value}</target>
      </trans-unit>`).join('')
      ).join('')}
    </body>
  </file>
</xliff>`;
        return xliff;
      }
      
      case 'json':
      default:
        return JSON.stringify(resources, null, 2);
    }
  }

  /**
   * Import translations
   */
  async importTranslations(language: SupportedLanguage, data: string, format: 'json' | 'csv' | 'xliff' = 'json'): Promise<void> {
    let translations: any = {};

    switch (format) {
      case 'csv': {
        const rows = data.split('\n').slice(1); // Skip header
        rows.forEach(row => {
          const [key, value] = row.split(',').map(s => s.replace(/^"|"$/g, ''));
          const [ns, ...keyParts] = key.split(':');
          const actualKey = keyParts.join(':');
          
          if (!translations[ns]) translations[ns] = {};
          translations[ns][actualKey] = value;
        });
        break;
      }
      
      case 'xliff': {
        // Parse XLIFF (simplified - real implementation would use XML parser)
        const units = data.match(/<trans-unit[^>]*>[\s\S]*?<\/trans-unit>/g) || [];
        units.forEach(unit => {
          const id = unit.match(/id="([^"]+)"/)?.[1];
          const target = unit.match(/<target>([^<]+)<\/target>/)?.[1];
          
          if (id && target) {
            const [ns, ...keyParts] = id.split(':');
            const key = keyParts.join(':');
            
            if (!translations[ns]) translations[ns] = {};
            translations[ns][key] = target;
          }
        });
        break;
      }
      
      case 'json':
      default:
        translations = JSON.parse(data);
    }

    // Add translations to i18next
    Object.entries(translations).forEach(([ns, trans]) => {
      i18n.addResourceBundle(language, ns, trans, true, true);
    });

    // Save to cache
    this.translationCache.set(language, translations);
  }
}

// Export singleton instance
export const localizationService = new LocalizationService();

// Convenience exports
export const t = (key: string, options?: any) => localizationService.t(key, options);
export const tn = (key: string, count: number, options?: any) => localizationService.tn(key, count, options);
export const formatDate = (date: Date | string | number, format?: string) => localizationService.formatDate(date, format);
export const formatTime = (date: Date | string | number, includeSeconds?: boolean) => localizationService.formatTime(date, includeSeconds);
export const formatNumber = (value: number, options?: Intl.NumberFormatOptions) => localizationService.formatNumber(value, options);
export const formatCurrency = (value: number, currency?: string, options?: Intl.NumberFormatOptions) => localizationService.formatCurrency(value, currency, options);
export const formatPercent = (value: number, options?: Intl.NumberFormatOptions) => localizationService.formatPercent(value, options);