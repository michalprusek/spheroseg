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
import { pipeline } from 'stream';
import { createHash } from 'crypto';
import logger from '../utils/logger';
import config from '../config';
import { ApiError } from '../utils/errors';

// Promisifikace funkcí
const pipelineAsync = promisify(pipeline);
const statAsync = promisify(fs.stat);
const mkdirAsync = promisify(fs.mkdir);
const existsAsync = promisify(fs.exists);

// Konfigurace
const UPLOAD_DIR = config.storage.uploadDir || path.join(__dirname, '../../uploads');
const THUMBNAIL_SIZE = { width: 300, height: 300 };
const MAX_IMAGE_SIZE = 100 * 1024 * 1024; // 100 MB
const SUPPORTED_FORMATS = ['jpeg', 'jpg', 'png', 'tiff', 'webp'];

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
 * Ověří, zda je soubor platným obrázkem
 */
export async function validateImage(filePath: string): Promise<boolean> {
  try {
    // Ověření existence souboru
    if (!(await existsAsync(filePath))) {
      throw new ApiError(`Soubor neexistuje: ${filePath}`, 404);
    }

    // Ověření velikosti souboru
    const stats = await statAsync(filePath);
    if (stats.size > MAX_IMAGE_SIZE) {
      throw new ApiError(`Soubor je příliš velký: ${stats.size} bytů`, 413);
    }

    // Ověření formátu obrázku
    const metadata = await sharp(filePath).metadata();
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
  }
}

/**
 * Získá metadata obrázku
 */
export async function getImageMetadata(filePath: string): Promise<ImageMetadata> {
  try {
    // Ověření existence souboru
    if (!(await existsAsync(filePath))) {
      throw new ApiError(`Soubor neexistuje: ${filePath}`, 404);
    }

    // Získání metadat pomocí sharp
    const metadata = await sharp(filePath).metadata();
    const stats = await statAsync(filePath);

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
  }
}

/**
 * Vytvoří náhled obrázku
 */
export async function createThumbnail(
  sourcePath: string,
  targetPath: string,
  options: ThumbnailOptions = {},
): Promise<string> {
  try {
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
    await sharp(sourcePath)
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
  }
}

/**
 * Optimalizuje obrázek pro web
 */
export async function optimizeImage(
  sourcePath: string,
  targetPath: string,
  format: 'jpeg' | 'png' | 'webp' = 'jpeg',
  quality: number = 80,
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
