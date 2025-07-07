import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  localizationService, 
  type SupportedLanguage,
  type LanguageInfo,
} from '@/services/localizationService';
import { useLanguage as useStoreLanguage } from '@/store';

/**
 * Enhanced localization hook
 * Provides unified access to translations and formatting
 */
export function useLocalization(namespace?: string) {
  const { t: i18nT, i18n, ready } = useTranslation(namespace);
  const { language: storeLanguage, setLanguage: setStoreLanguage } = useStoreLanguage();
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>(
    localizationService.getCurrentLanguage()
  );

  // Sync with i18n changes
  useEffect(() => {
    const handleLanguageChange = (lng: string) => {
      setCurrentLanguage(lng as SupportedLanguage);
    };

    i18n.on('languageChanged', handleLanguageChange);
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [i18n]);

  // Enhanced translation function
  const t = useCallback((key: string, options?: any) => {
    return localizationService.t(key, options);
  }, []);

  // Translation with count (pluralization)
  const tn = useCallback((key: string, count: number, options?: any) => {
    return localizationService.tn(key, count, options);
  }, []);

  // Set language
  const setLanguage = useCallback(async (language: SupportedLanguage) => {
    await localizationService.setLanguage(language);
    setStoreLanguage(language);
  }, [setStoreLanguage]);

  // Format functions
  const formatDate = useCallback((date: Date | string | number, format?: string) => {
    return localizationService.formatDate(date, format);
  }, []);

  const formatTime = useCallback((date: Date | string | number, includeSeconds?: boolean) => {
    return localizationService.formatTime(date, includeSeconds);
  }, []);

  const formatDateTime = useCallback((date: Date | string | number, includeSeconds?: boolean) => {
    return localizationService.formatDateTime(date, includeSeconds);
  }, []);

  const formatRelativeTime = useCallback((date: Date | string | number, baseDate?: Date) => {
    return localizationService.formatRelativeTime(date, baseDate);
  }, []);

  const formatDistance = useCallback((date: Date | string | number, baseDate?: Date, options?: any) => {
    return localizationService.formatDistance(date, baseDate, options);
  }, []);

  const formatNumber = useCallback((value: number, options?: Intl.NumberFormatOptions) => {
    return localizationService.formatNumber(value, options);
  }, []);

  const formatCurrency = useCallback((value: number, currency?: string, options?: Intl.NumberFormatOptions) => {
    return localizationService.formatCurrency(value, currency, options);
  }, []);

  const formatPercent = useCallback((value: number, options?: Intl.NumberFormatOptions) => {
    return localizationService.formatPercent(value, options);
  }, []);

  const formatList = useCallback((items: string[], type?: 'conjunction' | 'disjunction') => {
    return localizationService.formatList(items, type);
  }, []);

  // Get language info
  const getLanguageInfo = useCallback((code?: SupportedLanguage): LanguageInfo => {
    return localizationService.getLanguageInfo(code);
  }, []);

  // Get all supported languages
  const getSupportedLanguages = useCallback((): LanguageInfo[] => {
    return localizationService.getSupportedLanguages();
  }, []);

  // Sort with locale
  const sort = useCallback(<T,>(array: T[], key?: (item: T) => string): T[] => {
    return localizationService.sort(array, key);
  }, []);

  return {
    t,
    tn,
    ready,
    language: currentLanguage,
    setLanguage,
    formatDate,
    formatTime,
    formatDateTime,
    formatRelativeTime,
    formatDistance,
    formatNumber,
    formatCurrency,
    formatPercent,
    formatList,
    getLanguageInfo,
    getSupportedLanguages,
    sort,
    direction: getLanguageInfo(currentLanguage).direction,
    isRTL: getLanguageInfo(currentLanguage).direction === 'rtl',
  };
}

/**
 * Hook for translation management
 */
export function useTranslationManagement() {
  const [missingTranslations, setMissingTranslations] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load translations for namespace
  const loadTranslations = useCallback(async (namespace: string, language?: SupportedLanguage) => {
    setIsLoading(true);
    try {
      await localizationService.loadTranslations(namespace, language);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get missing translations
  const checkMissingTranslations = useCallback(() => {
    const missing = localizationService.getMissingTranslations();
    setMissingTranslations(missing);
    return missing;
  }, []);

  // Export translations
  const exportTranslations = useCallback((
    language: SupportedLanguage, 
    format: 'json' | 'csv' | 'xliff' = 'json'
  ): string => {
    return localizationService.exportTranslations(language, format);
  }, []);

  // Import translations
  const importTranslations = useCallback(async (
    language: SupportedLanguage,
    data: string,
    format: 'json' | 'csv' | 'xliff' = 'json'
  ) => {
    setIsLoading(true);
    try {
      await localizationService.importTranslations(language, data, format);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    missingTranslations,
    isLoading,
    loadTranslations,
    checkMissingTranslations,
    exportTranslations,
    importTranslations,
  };
}

/**
 * Hook for locale-aware form inputs
 */
export function useLocalizedInput() {
  const { language, formatNumber } = useLocalization();
  const languageInfo = localizationService.getLanguageInfo(language);

  // Parse localized number input
  const parseNumber = useCallback((value: string): number | null => {
    if (!value) return null;
    
    // Replace locale-specific separators with standard ones
    const { decimal, thousands } = languageInfo.numberFormat;
    const normalized = value
      .replace(new RegExp(`\\${thousands}`, 'g'), '')
      .replace(new RegExp(`\\${decimal}`), '.');
    
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? null : parsed;
  }, [languageInfo]);

  // Format number for display in input
  const formatNumberInput = useCallback((value: number | null, decimals?: number): string => {
    if (value === null || value === undefined) return '';
    
    if (decimals !== undefined) {
      return formatNumber(value, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    }
    
    return formatNumber(value);
  }, [formatNumber]);

  // Parse currency input
  const parseCurrency = useCallback((value: string): number | null => {
    if (!value) return null;
    
    // Remove currency symbol and spaces
    const { symbol } = languageInfo.currencyFormat;
    const cleaned = value.replace(symbol, '').trim();
    
    return parseNumber(cleaned);
  }, [languageInfo, parseNumber]);

  // Format currency for display in input
  const formatCurrencyInput = useCallback((value: number | null, currency?: string): string => {
    if (value === null || value === undefined) return '';
    
    return localizationService.formatCurrency(value, currency);
  }, []);

  return {
    parseNumber,
    formatNumberInput,
    parseCurrency,
    formatCurrencyInput,
  };
}

/**
 * Hook for RTL support
 */
export function useRTL() {
  const { direction, language } = useLocalization();
  const [isRTL, setIsRTL] = useState(direction === 'rtl');

  useEffect(() => {
    const rtl = direction === 'rtl';
    setIsRTL(rtl);
    
    // Update document direction
    document.documentElement.dir = direction;
    
    // Add RTL class for custom styling
    if (rtl) {
      document.documentElement.classList.add('rtl');
    } else {
      document.documentElement.classList.remove('rtl');
    }
  }, [direction]);

  // RTL-aware style utilities
  const rtlStyle = useCallback(<T extends Record<string, any>>(ltrStyle: T, rtlStyle: T): T => {
    return isRTL ? rtlStyle : ltrStyle;
  }, [isRTL]);

  const rtlClass = useCallback((ltrClass: string, rtlClass: string): string => {
    return isRTL ? rtlClass : ltrClass;
  }, [isRTL]);

  const rtlValue = useCallback(<T,>(ltrValue: T, rtlValue: T): T => {
    return isRTL ? rtlValue : ltrValue;
  }, [isRTL]);

  return {
    isRTL,
    direction,
    rtlStyle,
    rtlClass,
    rtlValue,
  };
}