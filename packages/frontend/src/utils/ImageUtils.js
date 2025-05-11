/**
 * Utility pro zpracování a načítání obrázků
 */

/**
 * Funkce pro získání správné cesty k obrázku v závislosti na prostředí
 *
 * @param {string} imagePath - Relativní cesta k obrázku
 * @returns {string} - Správná URL nebo cesta k obrázku
 */
export function getImageUrl(imagePath) {
  // Začíná-li cesta lomítkem, nechte ji tak
  if (imagePath.startsWith('/')) {
    console.log(`Image path with leading slash: ${imagePath}`);
    return imagePath;
  }

  // Jinak přidejte k cestě základní URL
  const baseUrl = '/';
  console.log(`Resolved image path: ${baseUrl}${imagePath}`);
  return `${baseUrl}${imagePath}`;
}

/**
 * Preload obrázků pro rychlejší zobrazení
 *
 * @param {Array<string>} imagePaths - Pole s cestami k obrázkům
 */
export function preloadImages(imagePaths) {
  imagePaths.forEach((path) => {
    const img = new Image();
    img.src = getImageUrl(path);
  });
}

export default {
  getImageUrl,
  preloadImages,
};
