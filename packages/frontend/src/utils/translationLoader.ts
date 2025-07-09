// Translation loader utility with error handling

// Helper function to load translation with error handling
async function loadSingleTranslation(importFunc: () => Promise<any>, fallback = {}) {
  try {
    const mod = await importFunc();
    return mod.default || fallback; // Assuming .ts files export default
  } catch (error) {
    console.warn('Failed to load a translation module:', error);
    return fallback;
  }
}

// Default minimal English translations to ensure app has some text if everything else fails.
const minimalEnFallback = {
  common: {
    loading: 'Loading...',
    error: 'Error',
    save: 'Save',
    cancel: 'Cancel',
  },
  project: {
    noImages: {
      title: 'No Images Yet',
      description: "This project doesn't have any images yet. Upload images to get started.",
      uploadButton: 'Upload Images',
    },
  },
};

export async function initializeTranslations() {
  let en, cs, de, es, fr, zh;

  try {
    en = await loadSingleTranslation(() => import('../translations/en.ts'), minimalEnFallback);
  } catch (error) {
    console.error('Critical failure loading English translations, using minimal fallback:', error);
    en = minimalEnFallback;
  }

  // Load other translations, defaulting to empty objects if they fail (i18next will use fallbackLng)
  cs = await loadSingleTranslation(() => import('../translations/cs.ts'));
  de = await loadSingleTranslation(() => import('../translations/de.ts'));
  es = await loadSingleTranslation(() => import('../translations/es.ts'));
  fr = await loadSingleTranslation(() => import('../translations/fr.ts'));
  zh = await loadSingleTranslation(() => import('../translations/zh.ts'));

  const resources = {
    en: { translation: en }, // i18next expects resources in { lang: { namespace: { key: value } } }
    cs: { translation: cs }, // Assuming 'translation' is your default namespace
    de: { translation: de },
    es: { translation: es },
    fr: { translation: fr },
    zh: { translation: zh },
  };
  console.log('[translationLoader] Translations loaded:', resources);
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
