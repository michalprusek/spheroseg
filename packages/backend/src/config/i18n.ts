import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import middleware from 'i18next-http-middleware';
import path from 'path';

// Initialize i18next
i18next
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init({
    backend: {
      loadPath: path.join(__dirname, '../translations/{{lng}}.json'),
    },
    detection: {
      // Order of language detection
      order: ['header', 'querystring', 'cookie'],
      // Keys to look for in each detection method
      lookupHeader: 'accept-language',
      lookupQuerystring: 'lang',
      lookupCookie: 'i18next',
      // Cache user language
      caches: ['cookie'],
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'cs', 'de', 'es', 'fr', 'zh'],
    preload: ['en', 'cs', 'de', 'es', 'fr', 'zh'],
    saveMissing: true,
    saveMissingTo: 'current',
    saveMissingPath: path.join(__dirname, '../translations/{{lng}}-missing.json'),
    interpolation: {
      escapeValue: false, // Not needed for API responses
    },
    returnObjects: true, // Allow returning objects for complex translations
  });

export default i18next;
export const i18nMiddleware = middleware.handle(i18next);

// Helper function to get translation with user's preferred language
export async function getUserTranslation(
  userId: string | null,
  key: string,
  options?: any
): Promise<string> {
  if (!userId) {
    return i18next.t(key, options);
  }

  // TODO: Fetch user's preferred language from database
  // For now, use default behavior
  return i18next.t(key, options);
}