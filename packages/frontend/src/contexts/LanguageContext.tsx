import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import i18n from 'i18next'; // Assuming i18next is used for translations
import en from '@/translations/en';
import cs from '@/translations/cs';
import de from '@/translations/de';
import es from '@/translations/es';
import fr from '@/translations/fr';
import zh from '@/translations/zh';
import apiClient from '@/lib/apiClient'; // Import apiClient
import { UserProfile } from '@/types/userProfile'; // Assuming a shared type definition
import { toast } from 'react-hot-toast'; // Import toast for error handling

// Initialize i18next *once* when the module loads
i18n.init({
  resources: {
    en: { translation: en },
    cs: { translation: cs },
    de: { translation: de },
    es: { translation: es },
    fr: { translation: fr },
    zh: { translation: zh },
  },
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  debug: true, // Enable debug logging
  returnEmptyString: false,
  returnNull: false,
  returnObjects: false,
  saveMissing: false,
  keySeparator: '.', 
  nsSeparator: ':',
  pluralSeparator: '_',
  contextSeparator: '_',
  load: 'languageOnly',
});

export type Language = 'en' | 'cs' | 'de' | 'es' | 'fr' | 'zh';

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, options?: Record<string, string | number | Date | undefined>, fallback?: string) => string;
  availableLanguages: Language[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const auth = useAuth();
  const user = auth?.user || null;
  const [language, setLanguageState] = useState<Language>('en');
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [availableLanguages, setAvailableLanguages] = useState<Language[]>(['en']);

  useEffect(() => {
    const langs = Object.keys(i18n.options.resources) as Language[];
    console.log("Available languages:", langs);
    setAvailableLanguages(langs);
  }, []);

  const fetchLanguagePreference = useCallback(async (userId: string) => {
    console.log("Fetching profile (for lang pref) for user:", userId);
    try {
      const response = await apiClient.get<UserProfile>('/users/me');
      return response.data.preferred_language || 'en';
    } catch (error: unknown) {
      console.error("Error fetching profile for language preference:", error);
      return (localStorage.getItem('language') as Language) || 'en';
    }
  }, []);

  const updateLanguagePreference = useCallback(async (userId: string, lang: Language) => {
    console.log(`Updating language preference for user ${userId} to ${lang} via API`);

    try {
      // Check if API is available by making a simple request first
      const testResponse = await apiClient.get('/users/me');
      if (testResponse.status === 200) {
        await apiClient.put('/users/me', { preferred_language: lang });
        console.log('Successfully updated language preference on server');
      } else {
        console.warn('API is not available, using localStorage only');
      }
    } catch (error: unknown) {
      console.error("Error updating language preference via API:", error);
      console.log("Using localStorage only for language preference");
      // Don't show error toast to user - it's not critical
    }
  }, []);

  const detectBrowserLanguage = useCallback((): Language => {
    try {
      const fullBrowserLanguage = navigator.language;
      console.log(`Detected full browser language: ${fullBrowserLanguage}`);

      if (fullBrowserLanguage && availableLanguages.includes(fullBrowserLanguage as Language)) {
        console.log(`Full browser language ${fullBrowserLanguage} is supported`);
        return fullBrowserLanguage as Language;
      }

      const baseLanguage = fullBrowserLanguage.split('-')[0];
      console.log(`Extracted base language: ${baseLanguage}`);

      if (baseLanguage && availableLanguages.includes(baseLanguage as Language)) {
        console.log(`Base language ${baseLanguage} is supported`);
        return baseLanguage as Language;
      }

      const matchingLanguage = availableLanguages.find(lang =>
        fullBrowserLanguage.startsWith(lang + '-') || lang.startsWith(fullBrowserLanguage + '-')
      );

      if (matchingLanguage) {
        console.log(`Found matching language ${matchingLanguage} for browser language ${fullBrowserLanguage}`);
        return matchingLanguage;
      }

      console.log(`Neither full (${fullBrowserLanguage}) nor base (${baseLanguage}) language is supported, using default: en`);
      return 'en';
    } catch (error) {
      console.error('Error detecting browser language:', error);
      return 'en';
    }
  }, [availableLanguages]);

  useEffect(() => {
    const loadInitialLanguage = async () => {
      console.log('Loading initial language...');
      const localStorageLanguage = localStorage.getItem('language') as Language | null;

      if (localStorageLanguage && availableLanguages.includes(localStorageLanguage)) {
        console.log(`Found valid language in localStorage: ${localStorageLanguage}`);
        setLanguageState(localStorageLanguage);
      } else {
        console.log('No valid language in localStorage, detecting browser language...');
        const detectedLanguage = detectBrowserLanguage();
        console.log(`Using detected language: ${detectedLanguage}`);
        setLanguageState(detectedLanguage);
        localStorage.setItem('language', detectedLanguage);
      }
    };

    loadInitialLanguage();
  }, [availableLanguages, detectBrowserLanguage]);

  useEffect(() => {
    const updateLanguageFromUserPreference = async () => {
      if (!user) {
        console.log('No user logged in, keeping current language');
        return;
      }

      try {
        console.log(`User logged in (${user.id}), checking language preference from API...`);
        const dbLanguage = await fetchLanguagePreference(user.id);

        if (dbLanguage && availableLanguages.includes(dbLanguage as Language)) {
          console.log(`Found valid language preference in API: ${dbLanguage}`);
          if (dbLanguage !== language) {
            console.log(`Updating language from ${language} to ${dbLanguage} based on user preference`);
            setLanguageState(dbLanguage as Language);
          }
        }
      } catch (error) {
        console.error('Error loading language preference from API:', error);
        console.log('Keeping current language due to API error');
      }
    };

    if (user && user.id) {
      updateLanguageFromUserPreference();
    }
  }, [user, fetchLanguagePreference, availableLanguages]);

  // Effect to CHANGE language when the 'language' state changes
  useEffect(() => {
    if (language) { // Check if change is needed
      console.log(`Attempting to change i18n language to: ${language}`);
      i18n.changeLanguage(language)
        .then(() => {
          console.log(`i18n language changed successfully to: ${language}`);
          setIsInitialized(true); // Keep this to signal readiness for 't' function
        })
        .catch(err => {
          console.error(`i18n changeLanguage failed for ${language}:`, err);
          setIsInitialized(true); // Still set true even on error?
        });
    }
  }, [language]); // REMOVED i18n.language dependency

  const setLanguage = useCallback((newLanguage: Language) => {
    if (!availableLanguages.includes(newLanguage)) {
      console.warn(`[LanguageContext] Attempted to set unsupported language: ${newLanguage}`);
      return;
    }
    console.log(`[LanguageContext] setLanguage called with: ${newLanguage}`);
    console.log(`[LanguageContext] Current state language BEFORE change: ${language}`);
    console.log(`[LanguageContext] Current i18n language BEFORE change: ${i18n.language}`);

    // Optimistically update state and localStorage
    setLanguageState(newLanguage);
    localStorage.setItem('language', newLanguage); // Fix: use 'language' not 'userLanguage' for consistency
    console.log(`[LanguageContext] State and localStorage updated to: ${newLanguage}`);

    // Attempt to change i18next language
    console.log(`[LanguageContext] Attempting i18n.changeLanguage('${newLanguage}')...`);
    i18n.changeLanguage(newLanguage)
      .then(() => {
        console.log(`[LanguageContext] i18n.changeLanguage('${newLanguage}') Promise RESOLVED.`);
        console.log(`[LanguageContext] Current i18n language AFTER change success: ${i18n.language}`);
        // Asynchronously update backend (fire and forget for UI responsiveness)
        if (auth.user && auth.user.id) { 
          console.log(`[LanguageContext] Asynchronously updating backend language preference for user ${auth.user.id} to ${newLanguage}`);
          apiClient.put(`/users/me`, { preferred_language: newLanguage }) // Fix: use preferred_language field
            .catch(err => {
              console.error('[LanguageContext] Failed to update backend language preference:', err);
              // Optionally: Add error handling/notification here if needed, but don't block UI
            });
        }
      })
      .catch(err => {
        console.error(`[LanguageContext] i18n.changeLanguage('${newLanguage}') Promise REJECTED:`, err);
        console.log(`[LanguageContext] Current i18n language AFTER change error: ${i18n.language}`);
        // Optionally revert state if change fails critically?
        // For now, we keep the optimistic update.
      });

  }, [availableLanguages, language, auth.user]); // Changed dependency from auth.isAuthenticated, auth.user?.id to auth.user

  const t = useCallback((key: string, options?: Record<string, string | number | Date | undefined>, fallback?: string): string => {
    // Directly use i18n.t, relying on its configuration for fallbacks.
    // The 'isInitialized' check might still be useful if there's a delay.
    if (!isInitialized) {
      return fallback !== undefined ? fallback : key;
    }
    
    // Check if key is empty or null
    if (!key) {
      console.warn('Empty translation key provided');
      return fallback !== undefined ? fallback : '';
    }
    
    try {
      // Add the fallback directly to the i18n.t options if provided
      const tOptions = fallback ? { ...options, defaultValue: fallback } : options;
      
      // Get translation
      const translated = i18n.t(key, tOptions);
      
      // Check if translation actually happened (if result equals key, it likely failed to translate)
      if (translated === key || !translated) {
        // Try to handle nested keys by checking segments
        const keyParts = key.split('.');
        if (keyParts.length > 1) {
          // Try different combinations of the key
          const alternativeKeys = [
            keyParts[keyParts.length - 1], // Try just the last segment
            keyParts.slice(-2).join('.'),  // Try last two segments
            `common.${keyParts[keyParts.length - 1]}`, // Try with common prefix + last segment
          ];
          
          // Try each alternative key
          for (const altKey of alternativeKeys) {
            const altTranslation = i18n.t(altKey, tOptions);
            if (altTranslation && altTranslation !== altKey) {
              console.log(`Used alternative translation key: ${altKey} instead of ${key}`);
              return altTranslation;
            }
          }
        }
        
        // If all else fails, use fallback or key
        console.warn(`Missing translation for key: "${key}"`);
        return fallback !== undefined ? fallback : key;
      }
      
      return translated;
    } catch (error) {
      console.error(`Translation error for key "${key}":`, error);
      return fallback !== undefined ? fallback : key; // Return fallback on error
    }
  }, [isInitialized]); // Dependency is only on initialization state

  // Neblokujeme renderování, i když jazyky nejsou inicializovány
  // Místo toho poskytneme výchozí hodnoty, které budou použity, dokud nebude inicializace dokončena
  // if (!isInitialized) {
  //   return null;
  // }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, availableLanguages }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
