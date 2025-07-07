import type { StateCreator } from 'zustand';
import type { StoreState } from '../index';
import i18n from '../../i18n';

export type Language = 'en' | 'cs' | 'de' | 'es' | 'fr' | 'it' | 'ja' | 'ko' | 'pl' | 'pt' | 'ru' | 'zh';

export interface LanguageSlice {
  // State
  language: Language;
  supportedLanguages: Language[];
  isChangingLanguage: boolean;
  
  // Actions
  setLanguage: (language: Language) => Promise<void>;
  detectLanguage: () => void;
  getSupportedLanguages: () => Language[];
}

export const createLanguageSlice: StateCreator<
  StoreState,
  [
    ['zustand/devtools', never],
    ['zustand/persist', unknown],
    ['zustand/subscribeWithSelector', never],
    ['zustand/immer', never]
  ],
  [],
  LanguageSlice
> = (set, get) => ({
  // Initial state
  language: 'en',
  supportedLanguages: ['en', 'cs', 'de', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'zh'],
  isChangingLanguage: false,
  
  // Actions
  setLanguage: async (language) => {
    set((state) => {
      state.isChangingLanguage = true;
    });
    
    try {
      // Change i18n language
      await i18n.changeLanguage(language);
      
      set((state) => {
        state.language = language;
        state.isChangingLanguage = false;
      });
      
      // Update HTML lang attribute
      document.documentElement.lang = language;
      
      // Save to user preferences if authenticated
      const { isAuthenticated, user, tokens } = get();
      if (isAuthenticated && user) {
        // API call to save preference
        await fetch('/api/users/preferences', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokens?.accessToken}`,
          },
          body: JSON.stringify({ language }),
        });
      }
    } catch (error) {
      console.error('Failed to change language:', error);
      set((state) => {
        state.isChangingLanguage = false;
      });
      throw error;
    }
  },
  
  detectLanguage: () => {
    const { language: storeLanguage, supportedLanguages } = get();
    
    // Priority: stored language > browser language > default
    let detectedLang: Language = 'en';
    
    // Check browser language
    const browserLang = navigator.language.split('-')[0].toLowerCase();
    if (supportedLanguages.includes(browserLang as Language)) {
      detectedLang = browserLang as Language;
    }
    
    // Use stored language if available
    if (storeLanguage && supportedLanguages.includes(storeLanguage)) {
      detectedLang = storeLanguage;
    }
    
    // Apply detected language
    get().setLanguage(detectedLang);
  },
  
  getSupportedLanguages: () => {
    return get().supportedLanguages;
  },
});