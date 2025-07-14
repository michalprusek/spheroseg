/**
 * Utility pro získání URL adres assetů
 */

/**
 * Vrátí kompletní URL pro statický asset
 *
 * @param path Relativní cesta k assetu
 * @returns Kompletní URL k assetu
 */
export function getAssetUrl(path: string): string {
  if (!path) {
    console.warn('Empty path provided to getAssetUrl');
    return '/placeholder.svg';
  }

  // Odstraňení počátečního lomítka, pokud existuje
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;

  // Check if we're in development mode
  const isDev = import.meta.env.DEV;

  // For illustration assets, always use direct path
  if (cleanPath.includes('assets/illustrations/')) {
    console.log(`Loading illustration asset: /${cleanPath}`);

    // Check if the path contains a UUID pattern (common in our illustrations)
    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    if (uuidPattern.test(cleanPath)) {
      // Extract the filename from the path
      const filename = cleanPath.split('/').pop() || '';

      // For UUID-based illustration assets, use the public path directly
      return `/${cleanPath}`;
    }

    return `/${cleanPath}`;
  }

  // For uploads, use direct path
  if (cleanPath.includes('uploads/')) {
    console.log(`Loading upload asset: /${cleanPath}`);
    return `/${cleanPath}`;
  }

  // For absolute URLs, return as is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  // For all other assets, use the configured assets URL
  // Získání základní URL pro assety z proměnných prostředí
  const assetsUrl = import.meta.env.VITE_ASSETS_URL || '';

  // If we have an assets URL, use it, otherwise use a relative path
  const url = assetsUrl ? `${assetsUrl}/${cleanPath}` : `/${cleanPath}`;
  console.log(`Generated asset URL: ${url}`);
  return url;
}

export default getAssetUrl;
