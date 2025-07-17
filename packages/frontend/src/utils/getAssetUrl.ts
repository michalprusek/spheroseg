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

  // For all other assets in development, use direct path
  // In production, use the assets URL
  if (isDev) {
    // In development, Vite serves files from the public directory
    const url = `/${cleanPath}`;
    console.log(`Generated asset URL (dev): ${url}`);
    return url;
  } else {
    // In production, use the configured assets URL
    const assetsUrl = import.meta.env.VITE_ASSETS_URL || '';
    const url = assetsUrl ? `${assetsUrl}/${cleanPath}` : `/${cleanPath}`;
    console.log(`Generated asset URL (prod): ${url}`);
    return url;
  }
}

export default getAssetUrl;
