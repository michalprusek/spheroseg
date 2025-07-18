/**
 * Služba pro optimalizované zpracování obrázků
 *
 * Tato služba poskytuje funkce pro efektivní zpracování obrázků:
 * - Streamované zpracování velkých souborů
 * - Paralelní generování náhledů
 * - Extrakce metadat
 * - Validace obrázků
 * - Optimalizace obrázků
 */

import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import logger from '../utils/logger';
import { ApiError } from '../utils/errors';

// Promisifikace funkcí
const statAsync = promisify(fs.stat);
const mkdirAsync = promisify(fs.mkdir);
const existsAsync = promisify(fs.exists);

// Konfigurace
const THUMBNAIL_SIZE = { width: 300, height: 300 };
const MAX_IMAGE_SIZE = 100 * 1024 * 1024; // 100 MB
const SUPPORTED_FORMATS = ['jpeg', 'jpg', 'png', 'tiff', 'tif', 'webp', 'bmp'];

/**
 * Rozhraní pro metadata obrázku
 */
export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
  hasAlpha?: boolean;
  orientation?: number;
  exif?: any;
}

/**
 * Rozhraní pro možnosti náhledu
 */
export interface ThumbnailOptions {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  background?: string;
  withoutEnlargement?: boolean;
}

/**
 * Převede obrázek na standardní formát (JPEG) a vrátí cestu k novému souboru.
 * Používá se pro BMP a TIFF, které Sharp nemusí přímo podporovat pro všechny operace.
 */
export async function convertToStandardFormat(
  sourcePath: string,
  targetFormat: 'jpeg' | 'png' | 'webp' = 'jpeg'
): Promise<string> {
  const ext = path.extname(sourcePath).toLowerCase();
  if (ext === '.bmp' || ext === '.tiff' || ext === '.tif') {
    const tempFileName = `${path.basename(sourcePath, ext)}_${Date.now()}.${targetFormat}`;
    const tempPath = path.join(path.dirname(sourcePath), tempFileName);
    logger.info(
      `Konvertuji ${ext} na ${targetFormat} pro zpracování: ${sourcePath} -> ${tempPath}`
    );
    try {
      await sharp(sourcePath).toFormat(targetFormat).toFile(tempPath);
      return tempPath;
    } catch (error) {
      logger.error(`Chyba při konverzi ${ext} na ${targetFormat}:`, { sourcePath, error });
      throw new ApiError(
        `Nelze konvertovat soubor ${ext} na ${targetFormat}: ${error.message}`,
        500
      );
    }
  }
  return sourcePath; // Není potřeba konverze
}

/**
 * Ověří, zda je soubor platným obrázkem
 */
export async function validateImage(filePath: string): Promise<boolean> {
  let processedFilePath = filePath;
  try {
    // Převedeme na standardní formát, pokud je to potřeba
    processedFilePath = await convertToStandardFormat(filePath);

    // Ověření existence souboru
    if (!(await existsAsync(processedFilePath))) {
      throw new ApiError(`Soubor neexistuje: ${processedFilePath}`, 404);
    }

    // Ověření velikosti souboru
    const stats = await statAsync(processedFilePath);
    if (stats.size > MAX_IMAGE_SIZE) {
      throw new ApiError(`Soubor je příliš velký: ${stats.size} bytů`, 413);
    }

    // Ověření formátu obrázku
    const metadata = await sharp(processedFilePath).metadata();
    if (!metadata.format || !SUPPORTED_FORMATS.includes(metadata.format.toLowerCase())) {
      throw new ApiError(`Nepodporovaný formát obrázku: ${metadata.format}`, 415);
    }

    return true;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    logger.error('Chyba při validaci obrázku:', { error, filePath });
    throw new ApiError(`Neplatný obrázek: ${error.message}`, 400);
  } finally {
    // Smažeme dočasný soubor, pokud byl vytvořen
    if (processedFilePath !== filePath) {
      try {
        await fs.promises.unlink(processedFilePath);
        logger.debug(`Dočasný soubor ${processedFilePath} smazán.`);
      } catch (unlinkError) {
        logger.warn(`Nepodařilo se smazat dočasný soubor ${processedFilePath}:`, unlinkError);
      }
    }
  }
}

/**
 * Získá metadata obrázku
 */
export async function getImageMetadata(filePath: string): Promise<ImageMetadata> {
  let processedFilePath = filePath;
  try {
    // Převedeme na standardní formát, pokud je to potřeba
    processedFilePath = await convertToStandardFormat(filePath);

    // Ověření existence souboru
    if (!(await existsAsync(processedFilePath))) {
      throw new ApiError(`Soubor neexistuje: ${processedFilePath}`, 404);
    }

    const stats = await statAsync(processedFilePath);
    const metadata = await sharp(processedFilePath).metadata();

    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
      size: stats.size,
      hasAlpha: metadata.hasAlpha,
      orientation: metadata.orientation,
      exif: metadata.exif,
    };
  } catch (error) {
    logger.error('Chyba při získávání metadat obrázku:', { error, filePath });
    throw new ApiError(`Nelze získat metadata obrázku: ${error.message}`, 500);
  } finally {
    // Smažeme dočasný soubor, pokud byl vytvořen
    if (processedFilePath !== filePath) {
      try {
        await fs.promises.unlink(processedFilePath);
        logger.debug(`Dočasný soubor ${processedFilePath} smazán.`);
      } catch (unlinkError) {
        logger.warn(`Nepodařilo se smazat dočasný soubor ${processedFilePath}:`, unlinkError);
      }
    }
  }
}

/**
 * Vytvoří náhled obrázku
 */
export async function createThumbnail(
  sourcePath: string,
  targetPath: string,
  options: ThumbnailOptions = {}
): Promise<string> {
  let processedSourcePath = sourcePath;
  try {
    // Převedeme na standardní formát, pokud je to potřeba
    processedSourcePath = await convertToStandardFormat(sourcePath);

    // Nastavení výchozích hodnot
    const opts = {
      width: options.width || THUMBNAIL_SIZE.width,
      height: options.height || THUMBNAIL_SIZE.height,
      fit: options.fit || 'cover',
      background: options.background || { r: 255, g: 255, b: 255, alpha: 1 },
      withoutEnlargement: options.withoutEnlargement !== false,
    };

    // Vytvoření adresáře pro náhled, pokud neexistuje
    const targetDir = path.dirname(targetPath);
    await mkdirAsync(targetDir, { recursive: true });

    // Vytvoření náhledu
    await sharp(processedSourcePath)
      .resize(opts.width, opts.height, {
        fit: opts.fit as any,
        background: opts.background,
        withoutEnlargement: opts.withoutEnlargement,
      })
      .toFormat('jpeg', { quality: 80 })
      .toFile(targetPath);

    return targetPath;
  } catch (error) {
    logger.error('Chyba při vytváření náhledu:', {
      error,
      sourcePath,
      targetPath,
    });
    throw new ApiError(`Nelze vytvořit náhled: ${error.message}`, 500);
  } finally {
    // Smažeme dočasný soubor, pokud byl vytvořen
    if (processedSourcePath !== sourcePath) {
      try {
        await fs.promises.unlink(processedSourcePath);
        logger.debug(`Dočasný soubor ${processedSourcePath} smazán.`);
      } catch (unlinkError) {
        logger.warn(`Nepodařilo se smazat dočasný soubor ${processedSourcePath}:`, unlinkError);
      }
    }
  }
}

/**
 * Optimalizuje obrázek pro web
 */
export async function optimizeImage(
  sourcePath: string,
  targetPath: string,
  format: 'jpeg' | 'png' | 'webp' = 'jpeg',
  quality: number = 80
): Promise<string> {
  try {
    // Vytvoření adresáře pro optimalizovaný obrázek, pokud neexistuje
    const targetDir = path.dirname(targetPath);
    await mkdirAsync(targetDir, { recursive: true });

    // Optimalizace obrázku
    await sharp(sourcePath).toFormat(format, { quality }).toFile(targetPath);

    return targetPath;
  } catch (error) {
    logger.error('Chyba při optimalizaci obrázku:', {
      error,
      sourcePath,
      targetPath,
    });
    throw new ApiError(`Nelze optimalizovat obrázek: ${error.message}`, 500);
  }
}

export default {
  validateImage,
  getImageMetadata,
  createThumbnail,
  optimizeImage,
};
