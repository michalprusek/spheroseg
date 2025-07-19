// Translation loader utility with error handling

// Helper function to load translation with error handling
async function loadSingleTranslation(importFunc: () => Promise<any>, fallback = {}) {
  try {
    const mod = await importFunc();
    // Handle different module formats
    if (mod && typeof mod === 'object') {
      // Check if it's the actual translations (has expected keys)
      if (mod.common || mod.projects || mod.auth) {
        return mod;
      }
      // Check for default export (most common case)
      if (mod.default) {
        return mod.default;
      }
      // Check for __esModule flag
      if (mod.__esModule && mod.default) {
        return mod.default;
      }
    }
    return mod || fallback;
  } catch (error) {
    console.warn('Failed to load a translation module:', error);
    return fallback;
  }
}

// Default minimal English translations to ensure app has some text if everything else fails.
const minimalEnFallback = {
  common: {
    loading: 'Loading...',
    loadingApplication: 'Loading application...',
    loadingAccount: 'Loading your account...',
    error: 'Error',
    save: 'Save',
    cancel: 'Cancel',
    settings: 'Settings',
    profile: 'Profile',
    dashboard: 'Dashboard',
    signIn: 'Sign In',
    signOut: 'Sign Out',
  },
  settings: {
    title: 'Settings',
    pageTitle: 'Settings',
    profile: 'Profile',
    account: 'Account',
    appearance: 'Appearance',
  },
  project: {
    noImages: {
      title: 'No Images Yet',
      description: "This project doesn't have any images yet. Upload images to get started.",
      uploadButton: 'Upload Images',
    },
  },
  auth: {
    signIn: 'Sign In',
    signOut: 'Sign Out',
  },
};

export async function initializeTranslations() {
  let en;

  try {
    en = await loadSingleTranslation(() => import('../translations/en'), minimalEnFallback);
  } catch (error) {
    console.error('Critical failure loading English translations, using minimal fallback:', error);
    en = minimalEnFallback;
  }

  // Load other translations, defaulting to empty objects if they fail (i18next will use fallbackLng)
  const cs = await loadSingleTranslation(() => import('../translations/cs'));
  const de = await loadSingleTranslation(() => import('../translations/de'));
  const es = await loadSingleTranslation(() => import('../translations/es'));
  const fr = await loadSingleTranslation(() => import('../translations/fr'));
  const zh = await loadSingleTranslation(() => import('../translations/zh'));

  const resources = {
    en: { translation: en }, // i18next expects resources in { lang: { namespace: { key: value } } }
    cs: { translation: cs }, // Assuming 'translation' is your default namespace
    de: { translation: de },
    es: { translation: es },
    fr: { translation: fr },
    zh: { translation: zh },
  };
  // Log only in development mode
  if (process.env.NODE_ENV === 'development') {
    console.log('[translationLoader] Translations loaded:', Object.keys(resources));

    // Verify translations are loaded correctly
    if (en) {
      console.log('[translationLoader] EN translation loaded successfully');

      // Quick validation
      const requiredKeys = ['common', 'projects', 'statsOverview'];
      const missingKeys = requiredKeys.filter((key) => !en[key]);
      if (missingKeys.length > 0) {
        console.error('[translationLoader] Missing required translation sections:', missingKeys);
      }
    }
  }
  return resources;
}

// For any synchronous legacy imports that might still exist (though they shouldn't be relied upon)
// This will be empty until initializeTranslations is called and awaited elsewhere.
export const translations = {
  en: minimalEnFallback, // Start with fallback
  cs: {},
  de: {},
  es: {},
  fr: {},
  zh: {},
};

export default translations; // Legacy default export, also likely empty initially
