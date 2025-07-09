import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import i18n, { i18nInitializedPromise } from '../i18n';
import apiClient from '@/lib/apiClient';
import userProfileService from '../services/userProfileService';
import { UserProfile } from '@/types/userProfile';
import { toast } from 'sonner';
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
    logger.debug('[LanguageContext] Waiting for i18next global initialization promise...'); // Changed to debug
    i18nInitializedPromise
      .then(() => {
        if (subscribed) {
          logger.debug('[LanguageContext] i18next global initialization complete.');
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
        logger.debug('[LanguageContext] Available languages from i18next:', langs);
        setAvailableLanguages(langs.length > 0 ? langs : ['en']);
      } else {
        logger.warn('[LanguageContext] i18next.options.resources not populated or empty. Using default [en].');
        setAvailableLanguages(['en']);
      }
    } else {
      logger.debug('[LanguageContext] setAvailableLanguages: Waiting for i18n readiness.'); // Changed to debug
    }
  }, [isI18nReady]);

  const detectBrowserLanguage = useCallback((): Language => {
    if (!isI18nReady || availableLanguages.length === 0) {
      logger.debug(
        '[LanguageContext] detectBrowserLanguage: i18n not ready or no available languages, defaulting to en.',
      ); // Changed to debug
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
        logger.debug(
          '[LanguageContext] Found matching language ' +
            matchingLanguage +
            ' for browser language ' +
            fullBrowserLanguage,
        );
        return matchingLanguage;
      }

      logger.debug(
        '[LanguageContext] Neither full (' +
          fullBrowserLanguage +
          ') nor base (' +
          baseLanguage +
          ') language is supported, using default: en',
      );
      return 'en';
    } catch (error) {
      logger.error('[LanguageContext] Error detecting browser language:', error);
      return 'en';
    }
  }, [isI18nReady, availableLanguages]);

  const fetchLanguagePreference = useCallback(
    async (userId: string) => {
      if (!isI18nReady) {
        logger.debug('[LanguageContext] fetchLanguagePreference: i18n not ready, skipping.'); // Changed to debug
        return 'en';
      }
      logger.debug('[LanguageContext] Fetching language preference for user: ' + userId);

      // Always try localStorage first as it's the most reliable
      const localStorageLanguage = localStorage.getItem('language') as Language | null;
      const validLocalLanguage =
        localStorageLanguage && availableLanguages.includes(localStorageLanguage) ? localStorageLanguage : null;

      try {
        // Try to load from database using the same method as ThemeContext
        const dbLanguage = await userProfileService.loadSettingFromDatabase('language', 'language', 'en');

        if (dbLanguage && availableLanguages.includes(dbLanguage as Language)) {
          const validDbLanguage = dbLanguage as Language;

          // Update localStorage with DB value if different
          if (validLocalLanguage !== validDbLanguage) {
            localStorage.setItem('language', validDbLanguage);
            logger.debug('[LanguageContext] Updated localStorage with DB language: ' + validDbLanguage); // Changed to debug
          }
          return validDbLanguage;
        }

        // If no valid DB language, use localStorage or browser detection
        if (validLocalLanguage) {
          logger.debug('[LanguageContext] No valid DB language, using localStorage: ' + validLocalLanguage); // Changed to debug
          return validLocalLanguage;
        } else {
          const detectedLanguage = detectBrowserLanguage();
          localStorage.setItem('language', detectedLanguage);
          logger.debug('[LanguageContext] No localStorage, using detected language: ' + detectedLanguage); // Changed to debug
          return detectedLanguage;
        }
      } catch (error: unknown) {
        logger.warn('[LanguageContext] Error fetching language preference from database, using fallback:', error);

        // Return localStorage value if valid, otherwise detect browser language
        if (validLocalLanguage) {
          logger.debug('[LanguageContext] Using localStorage fallback: ' + validLocalLanguage); // Changed to debug
          return validLocalLanguage;
        } else {
          const detectedLanguage = detectBrowserLanguage();
          localStorage.setItem('language', detectedLanguage);
          logger.debug('[LanguageContext] Using browser detection fallback: ' + detectedLanguage); // Changed to debug
          return detectedLanguage;
        }
      }
    },
    [isI18nReady, availableLanguages, detectBrowserLanguage],
  );

  useEffect(() => {
    if (!isI18nReady || availableLanguages.length === 0) {
      logger.debug('[LanguageContext] updateLanguageFromUserPreference: Waiting for i18n or available langs.'); // Changed to debug
      return;
    }

    const loadLanguage = async () => {
      // Always check localStorage first as it's the most reliable fallback
      const localStorageLanguage = localStorage.getItem('language') as Language | null;
      const validLocalLanguage =
        localStorageLanguage && availableLanguages.includes(localStorageLanguage) ? localStorageLanguage : null;

      if (user?.id) {
        // Prevent multiple concurrent API calls for the same user
        const lastUserId = window.sessionStorage.getItem('spheroseg_language_last_user');
        if (lastUserId === user.id) {
          logger.debug(
            '[LanguageContext] Language already loaded for user ' + user.id + ', using localStorage:',
            validLocalLanguage || 'en',
          ); // Changed to debug
          setLanguageState(validLocalLanguage || 'en');
          return;
        }

        try {
          logger.debug('[LanguageContext] User logged in (' + user.id + '), checking language preference from API...');

          // Mark this user as processed
          window.sessionStorage.setItem('spheroseg_language_last_user', user.id);

          const dbLanguage = (await fetchLanguagePreference(user.id)) as Language;

          if (dbLanguage && availableLanguages.includes(dbLanguage)) {
            logger.debug('[LanguageContext] Found valid language preference in API: ' + dbLanguage);
            setLanguageState(dbLanguage);
          } else {
            logger.warn(
              "[LanguageContext] API language preference '" +
                dbLanguage +
                "' not in available: " +
                availableLanguages.join(', '),
            );
            // Use localStorage fallback if DB language is invalid
            if (validLocalLanguage) {
              setLanguageState(validLocalLanguage);
            }
          }
        } catch (error) {
          // Clear the user marker if API fails so we can retry later
          window.sessionStorage.removeItem('spheroseg_language_last_user');
          logger.error('[LanguageContext] Error loading language preference from API:', error);
          logger.debug('[LanguageContext] Using localStorage fallback due to API error'); // Changed to debug

          // Use localStorage fallback
          if (validLocalLanguage) {
            setLanguageState(validLocalLanguage);
          }
        }
      } else {
        // When not authenticated, use localStorage or browser detection
        if (validLocalLanguage) {
          logger.debug('[LanguageContext] No user, using localStorage language:', validLocalLanguage); // Changed to debug
          setLanguageState(validLocalLanguage);
        } else {
          const detectedLanguage = detectBrowserLanguage();
          logger.debug('[LanguageContext] No user or localStorage, using detected language:', detectedLanguage); // Changed to debug
          setLanguageState(detectedLanguage);
          localStorage.setItem('language', detectedLanguage);
        }
      }
    };

    loadLanguage();
  }, [isI18nReady, user, fetchLanguagePreference, availableLanguages, detectBrowserLanguage]);

  useEffect(() => {
    if (isI18nReady && language && i18n.isInitialized) {
      logger.debug('[LanguageContext] Attempting to change i18n language to: ' + language);
      i18n
        .changeLanguage(language)
        .then(() => {
          logger.debug('[LanguageContext] i18n language changed successfully to: ' + language);
          setIsContextInitialized(true);
        })
        .catch((err) => {
          logger.error('[LanguageContext] i18n changeLanguage failed for ' + language + ':', err);
          toast.error('Failed to switch language to ' + language + '.');
          setIsContextInitialized(true);
        });
    } else {
      logger.debug('[LanguageContext] change i18n language: Waiting for i18n readiness or language state.'); // Changed to debug
    }
  }, [isI18nReady, language]);

  const setLanguage = useCallback(
    (newLanguage: Language) => {
      if (!isI18nReady || !i18n.isInitialized) {
        logger.warn('[LanguageContext] [setLanguage] i18n not ready. Cannot set language to ' + newLanguage + '.');
        return;
      }
      if (!availableLanguages.includes(newLanguage)) {
        logger.warn(
          '[LanguageContext] Attempted to set unsupported language: ' +
            newLanguage +
            '. Available: ' +
            availableLanguages.join(', '),
        );
        toast("Language '" + newLanguage + "' is not available.");
        return;
      }

      logger.debug('[LanguageContext] Setting language to: ' + newLanguage);
      setLanguageState(newLanguage);
      localStorage.setItem('language', newLanguage);

      if (auth.user && auth.user.id) {
        logger.debug(
          '[LanguageContext] Updating language preference on backend for user ' + auth.user.id + ' to ' + newLanguage,
        );
        userProfileService.setUserSetting('language', newLanguage, 'ui').catch((err) => {
          logger.warn(
            '[LanguageContext] Failed to update language preference in database (continuing with localStorage):',
            err,
          );
          // Fallback to old API method
          apiClient.put('/api/users/me', { preferred_language: newLanguage }).catch((fallbackErr) => {
            logger.warn(
              '[LanguageContext] Fallback API update also failed (language saved in localStorage):',
              fallbackErr,
            );
            // Language is already saved in localStorage above, so this is not critical
          });
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
    logger.debug(
      '[LanguageContext] LanguageProvider: i18next not ready or context language not set, rendering null/loader.',
    ); // Changed to debug
    return null;
  }

  logger.debug('[LanguageContext] LanguageProvider fully initialized, rendering children.');
  return (
    <LanguageContext.Provider
      key={language}
      value={{ language, setLanguage, t, availableLanguages, isLanguageReady: isContextInitialized }}
    >
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
