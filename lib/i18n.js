import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Check if i18next is already initialized to prevent duplicate initialization
if (!i18n.isInitialized) {
  // Inicializace i18next s robustnějším nastavením
  i18n
    .use(initReactI18next)
    .init({
    resources: {
      'cs-CZ': {
        translation: {
          // Překlady pro češtinu
          'app.title': 'SpheroSeg',
          'app.description': 'Nástroj pro segmentaci sféroidů',
          'login.title': 'Přihlášení',
          'login.username': 'Uživatelské jméno',
          'login.password': 'Heslo',
          'login.submit': 'Přihlásit',
          'projects.title': 'Projekty',
          'projects.new': 'Nový projekt',
          'projects.empty': 'Nemáte žádné projekty',
          'error.404': 'Stránka nenalezena',
          'error.500': 'Kritická chyba aplikace',
          'error.unknown': 'Neznámá chyba',
        }
      },
      'cs': {
        translation: {
          // Překlady pro češtinu (fallback pro cs-CZ)
          'app.title': 'SpheroSeg',
          'app.description': 'Nástroj pro segmentaci sféroidů',
          'login.title': 'Přihlášení',
          'login.username': 'Uživatelské jméno',
          'login.password': 'Heslo',
          'login.submit': 'Přihlásit',
          'projects.title': 'Projekty',
          'projects.new': 'Nový projekt',
          'projects.empty': 'Nemáte žádné projekty',
          'error.404': 'Stránka nenalezena',
          'error.500': 'Kritická chyba aplikace',
          'error.unknown': 'Neznámá chyba',
        }
      },
      en: {
        translation: {
          // English translations
          'app.title': 'SpheroSeg',
          'app.description': 'Tool for spheroid segmentation',
          'login.title': 'Login',
          'login.username': 'Username',
          'login.password': 'Password',
          'login.submit': 'Login',
          'projects.title': 'Projects',
          'projects.new': 'New project',
          'projects.empty': 'You have no projects',
          'error.404': 'Page not found',
          'error.500': 'Critical application error',
          'error.unknown': 'Unknown error',
        }
      }
    },
    lng: 'cs-CZ', // Výchozí jazyk
    fallbackLng: ['cs', 'en'],
    interpolation: {
      escapeValue: false // React již provádí XSS ochranu
    },
    react: {
      useSuspense: false, // Deaktivace Suspense pro React 18 kompatibilitu
      bindI18n: 'languageChanged',
      bindI18nStore: '',
      transEmptyNodeValue: '',
      transSupportBasicHtmlNodes: true,
      transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'p'],
      skipTranslationOnMissingKey: true
    },
    // Optimalizace pro výkon
    load: 'currentOnly', // Změněno z 'languageOnly' pro lepší podporu regionálních variant
    ns: ['translation'],
    defaultNS: 'translation',
    keySeparator: '.',
    nsSeparator: ':',
    pluralSeparator: '_',
    contextSeparator: '_',
    // Nastavení logování - pouze v development módu
    debug: process.env.NODE_ENV === 'development',
    saveMissing: process.env.NODE_ENV === 'development',
  });

  // Přidání detekce jazyka prohlížeče
  const detectedLng = typeof window !== 'undefined' 
    ? window.navigator.language || window.navigator.userLanguage || 'cs-CZ'
    : 'cs-CZ';

  // Nastavení jazyka podle detekce, pokud je podporován
  if (detectedLng.startsWith('cs')) {
    i18n.changeLanguage('cs-CZ');
  } else if (detectedLng.startsWith('en')) {
    i18n.changeLanguage('en');
  }
}

export default i18n;