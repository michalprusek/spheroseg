import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import i18n, { i18nInitializedPromise } from '../i18n';
import apiClient from '@/lib/apiClient';
import { UserProfile } from '@/types/userProfile';
import { toast } from 'react-hot-toast';
import logger from '@/utils/logger';

export type Language = 'en' | 'cs' | 'de' | 'es' | 'fr' | 'zh';

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, options?: Record<string, string | number | Date | undefined>, fallback?: string) => string;
  availableLanguages: Language[];
  isLanguageReady: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const auth = useAuth();
  const user = auth?.user || null;
  const [language, setLanguageState] = useState<Language>('en');
  const [isI18nReady, setIsI18nReady] = useState<boolean>(false);
  const [isContextInitialized, setIsContextInitialized] = useState<boolean>(false);
  const [availableLanguages, setAvailableLanguages] = useState<Language[]>(['en']);

  useEffect(() => {
    let subscribed = true;
    logger.info('[LanguageContext] Waiting for i18next global initialization...');
    i18nInitializedPromise
      .then(() => {
        if (subscribed) {
          logger.info('[LanguageContext] i18next global initialization complete.');
          setIsI18nReady(true);
        }
      })
      .catch((error) => {
        logger.error('[LanguageContext] Error during i18next global initialization promise:', error);
        if (subscribed) {
          setIsI18nReady(true);
          toast.error('Failed to load translations. Some text may not appear correctly.');
        }
      });
    return () => {
      subscribed = false;
    };
  }, []);

  useEffect(() => {
    if (isI18nReady && i18n.isInitialized) {
      const resources = i18n.options?.resources;
      if (resources && Object.keys(resources).length > 0) {
        const langs = Object.keys(resources) as Language[];
        logger.info('[LanguageContext] Available languages from i18next:', langs);
        setAvailableLanguages(langs.length > 0 ? langs : ['en']);
      } else {
        logger.warn('[LanguageContext] i18next.options.resources not populated or empty. Using default [en].');
        setAvailableLanguages(['en']);
      }
    } else {
      logger.info('[LanguageContext] setAvailableLanguages: Waiting for i18n readiness.');
    }
  }, [isI18nReady]);

  const detectBrowserLanguage = useCallback((): Language => {
    if (!isI18nReady || availableLanguages.length === 0) {
      logger.info('[LanguageContext] detectBrowserLanguage: i18n not ready or no available languages, defaulting to en.');
      return 'en';
    }
    try {
      const fullBrowserLanguage = navigator.language;
      logger.debug('[LanguageContext] Detected full browser language: ' + fullBrowserLanguage);

      if (availableLanguages.includes(fullBrowserLanguage as Language)) {
        logger.debug('[LanguageContext] Full browser language ' + fullBrowserLanguage + ' is supported');
        return fullBrowserLanguage as Language;
      }

      const baseLanguage = fullBrowserLanguage.split('-')[0];
      logger.debug('[LanguageContext] Extracted base language: ' + baseLanguage);

      if (availableLanguages.includes(baseLanguage as Language)) {
        logger.debug('[LanguageContext] Base language ' + baseLanguage + ' is supported');
        return baseLanguage as Language;
      }

      const matchingLanguage = availableLanguages.find(
        (lang) => fullBrowserLanguage.startsWith(lang + '-') || lang.startsWith(fullBrowserLanguage + '-'),
      );

      if (matchingLanguage) {
        logger.debug('[LanguageContext] Found matching language ' + matchingLanguage + ' for browser language ' + fullBrowserLanguage);
        return matchingLanguage;
      }

      logger.debug(
        '[LanguageContext] Neither full (' + fullBrowserLanguage + ') nor base (' + baseLanguage + ') language is supported, using default: en',
      );
      return 'en';
    } catch (error) {
      logger.error('[LanguageContext] Error detecting browser language:', error);
      return 'en';
    }
  }, [isI18nReady, availableLanguages]);

  useEffect(() => {
    if (!isI18nReady || availableLanguages.length === 0) {
      logger.info('[LanguageContext] loadInitialLanguage: Waiting for i18n readiness or available languages.');
      return;
    }

    const loadAsync = async () => {
      logger.info('[LanguageContext] Loading initial language...');
      const localStorageLanguage = localStorage.getItem('language') as Language | null;

      if (localStorageLanguage && availableLanguages.includes(localStorageLanguage)) {
        logger.info('[LanguageContext] Found valid language in localStorage: ' + localStorageLanguage);
        setLanguageState(localStorageLanguage);
      } else {
        logger.info('[LanguageContext] No valid language in localStorage, detecting browser language...');
        const detectedLanguage = detectBrowserLanguage();
        logger.info('[LanguageContext] Using detected language: ' + detectedLanguage);
        setLanguageState(detectedLanguage);
        localStorage.setItem('language', detectedLanguage);
      }
    };

    loadAsync();
  }, [isI18nReady, availableLanguages, detectBrowserLanguage]);

  const fetchLanguagePreference = useCallback(async (userId: string) => {
    if (!isI18nReady) {
      logger.info('[LanguageContext] fetchLanguagePreference: i18n not ready, skipping.');
      return 'en';
    }
    logger.info('[LanguageContext] Fetching profile (for lang pref) for user: ' + userId);
    try {
      const response = await apiClient.get<UserProfile>('/api/users/me');
      return response.data.preferred_language || 'en';
    } catch (error: unknown) {
      logger.error('[LanguageContext] Error fetching profile for language preference:', error);
      return (localStorage.getItem('language') as Language) || 'en';
    }
  }, [isI18nReady]);

  useEffect(() => {
    if (!isI18nReady || availableLanguages.length === 0 || !user || !user.id) {
      logger.info('[LanguageContext] updateLanguageFromUserPreference: Waiting for i18n, available langs, or user.');
      return;
    }

    const updateAsync = async () => {
      try {
        logger.info('[LanguageContext] User logged in (' + user.id + '), checking language preference from API...');
        const dbLanguage = (await fetchLanguagePreference(user.id)) as Language;

        if (dbLanguage && availableLanguages.includes(dbLanguage)) {
          logger.info('[LanguageContext] Found valid language preference in API: ' + dbLanguage);
          if (dbLanguage !== language) {
            logger.info('[LanguageContext] Updating language from ' + language + ' to ' + dbLanguage + ' based on user preference');
            setLanguageState(dbLanguage);
          }
        } else {
          logger.warn('[LanguageContext] API language preference \'' + dbLanguage + '\' not in available: ' + availableLanguages.join(', '));
        }
      } catch (error) {
        logger.error('[LanguageContext] Error loading language preference from API:', error);
        logger.info('[LanguageContext] Keeping current language due to API error');
      }
    };

    updateAsync();
  }, [isI18nReady, user, fetchLanguagePreference, availableLanguages, language]);

  useEffect(() => {
    if (isI18nReady && language && i18n.isInitialized) {
      logger.info('[LanguageContext] Attempting to change i18n language to: ' + language);
      i18n
        .changeLanguage(language)
        .then(() => {
          logger.info('[LanguageContext] i18n language changed successfully to: ' + language);
          setIsContextInitialized(true);
        })
        .catch((err) => {
          logger.error('[LanguageContext] i18n changeLanguage failed for ' + language + ':', err);
          toast.error('Failed to switch language to ' + language + '.');
          setIsContextInitialized(true);
        });
    } else {
      logger.info('[LanguageContext] change i18n language: Waiting for i18n readiness or language state.');
    }
  }, [isI18nReady, language]);

  const setLanguage = useCallback(
    (newLanguage: Language) => {
      if (!isI18nReady || !i18n.isInitialized) {
        logger.warn('[LanguageContext] [setLanguage] i18n not ready. Cannot set language to ' + newLanguage + '.');
        return;
      }
      if (!availableLanguages.includes(newLanguage)) {
        logger.warn('[LanguageContext] Attempted to set unsupported language: ' + newLanguage + '. Available: ' + availableLanguages.join(', '));
        toast('Language \'' + newLanguage + '\' is not available.');
        return;
      }

      logger.info('[LanguageContext] Setting language to: ' + newLanguage);
      setLanguageState(newLanguage);
      localStorage.setItem('language', newLanguage);

      if (auth.user && auth.user.id) {
        logger.info('[LanguageContext] Updating language preference on backend for user ' + auth.user.id + ' to ' + newLanguage);
        apiClient
          .put('/api/users/me', { preferred_language: newLanguage })
          .catch((err) => {
            logger.error('[LanguageContext] Failed to update backend language preference:', err);
          });
      }
    },
    [isI18nReady, availableLanguages, auth.user],
  );

  const t = useCallback(
    (key: string, options?: Record<string, string | number | Date | undefined>, fallback?: string): string => {
      if (!isI18nReady || !i18n.isInitialized || !isContextInitialized) {
        return fallback || key;
      }
      return i18n.t(key, options) || fallback || key;
    },
    [isI18nReady, isContextInitialized],
  );

  if (!isI18nReady || !isContextInitialized) {
    logger.info('[LanguageContext] LanguageProvider: i18next not ready or context language not set, rendering null/loader.');
    return null;
  }

  logger.info('[LanguageContext] LanguageProvider fully initialized, rendering children.');
  return (
    <LanguageContext.Provider key={language} value={{ language, setLanguage, t, availableLanguages, isLanguageReady: isContextInitialized }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
