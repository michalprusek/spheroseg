/**
 * Optimalizované databázové dotazy
 *
 * Tento soubor obsahuje optimalizované dotazy pro nejčastější operace:
 * - Použití indexů pro rychlejší vyhledávání
 * - Omezení počtu sloupců pro snížení objemu dat
 * - Stránkování pro velké datové sady
 * - Optimalizované spojení tabulek
 * - Cachování výsledků častých dotazů
 */

import { PoolClient } from 'pg';
import NodeCache from 'node-cache';
import pool from './index';
import logger from '../utils/logger';
import config from '../config';
import { ApiError } from '../utils/errors';

// Konfigurace cache
const CACHE_TTL = config.db.cacheTtl || 60; // 60 sekund
const CACHE_CHECK_PERIOD = config.db.cacheCheckPeriod || 120; // 120 sekund

// Inicializace cache
const queryCache = new NodeCache({
  stdTTL: CACHE_TTL,
  checkperiod: CACHE_CHECK_PERIOD,
  useClones: false,
});

/**
 * Generuje klíč pro cache
 */
function generateCacheKey(query: string, params: any[]): string {
  return `${query}:${JSON.stringify(params)}`;
}

/**
 * Provede dotaz s cachováním výsledků
 */
export async function queryCached<T>(
  query: string,
  params: any[] = [],
  ttl: number = CACHE_TTL,
  skipCache: boolean = false,
): Promise<T[]> {
  // Generování klíče pro cache
  const cacheKey = generateCacheKey(query, params);

  // Pokud není cachování zakázáno, zkusíme získat výsledek z cache
  if (!skipCache) {
    const cachedResult = queryCache.get<T[]>(cacheKey);
    if (cachedResult) {
      logger.debug('Cache hit pro dotaz', { cacheKey });
      return cachedResult;
    }
  }

  // Provedení dotazu
  try {
    const result = await pool.query(query, params);

    // Uložení výsledku do cache
    if (!skipCache) {
      queryCache.set(cacheKey, result.rows, ttl);
    }

    return result.rows as T[];
  } catch (error) {
    logger.error('Chyba při provádění dotazu', { error, query, params });
    throw error;
  }
}

/**
 * Invaliduje cache pro daný klíč
 */
export function invalidateCache(query: string, params: any[] = []): void {
  const cacheKey = generateCacheKey(query, params);
  queryCache.del(cacheKey);
}

/**
 * Invaliduje všechny cache pro danou tabulku
 */
export function invalidateTableCache(tableName: string): void {
  const keys = queryCache.keys();
  const tableKeys = keys.filter((key) => key.includes(tableName));
  tableKeys.forEach((key) => queryCache.del(key));
}

/**
 * Provede transakci s více dotazy
 */
export async function executeTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Chyba při provádění transakce', { error });
    throw error;
  } finally {
    client.release();
  }
}

// --- Optimalizované dotazy pro projekty ---

/**
 * Získá projekty uživatele s počtem obrázků a náhledem
 */
export async function getUserProjects(
  userId: string,
  page: number = 1,
  pageSize: number = 20,
  sortBy: string = 'updated_at',
  sortOrder: 'ASC' | 'DESC' = 'DESC',
  filter: string = '',
): Promise<any[]> {
  const offset = (page - 1) * pageSize;

  // Validace řazení pro zabránění SQL injection
  const validSortColumns = ['title', 'created_at', 'updated_at', 'image_count'];
  if (!validSortColumns.includes(sortBy)) {
    sortBy = 'updated_at';
  }

  // Validace směru řazení
  if (sortOrder !== 'ASC' && sortOrder !== 'DESC') {
    sortOrder = 'DESC';
  }

  // Sestavení dotazu
  const query = `
    SELECT 
      p.id,
      p.title,
      p.description,
      p.created_at,
      p.updated_at,
      COUNT(i.id) AS image_count,
      (
        SELECT i2.thumbnail_path
        FROM images i2
        WHERE i2.project_id = p.id
        ORDER BY i2.created_at DESC
        LIMIT 1
      ) AS thumbnail_path
    FROM 
      projects p
    LEFT JOIN 
      images i ON p.id = i.project_id
    WHERE 
      p.user_id = $1
      ${filter ? 'AND p.title ILIKE $4' : ''}
    GROUP BY 
      p.id
    ORDER BY 
      ${sortBy} ${sortOrder}
    LIMIT $2 OFFSET $3
  `;

  const params = filter ? [userId, pageSize, offset, `%${filter}%`] : [userId, pageSize, offset];

  return await queryCached(query, params);
}

/**
 * Získá detail projektu s počtem obrázků a stavem segmentace
 */
export async function getProjectDetail(projectId: string, userId: string): Promise<any> {
  const query = `
    SELECT 
      p.id,
      p.title,
      p.description,
      p.created_at,
      p.updated_at,
      COUNT(i.id) AS image_count,
      SUM(CASE WHEN sr.status = 'completed' THEN 1 ELSE 0 END) AS segmented_count,
      SUM(CASE WHEN sr.status = 'processing' THEN 1 ELSE 0 END) AS processing_count,
      SUM(CASE WHEN sr.status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
      SUM(CASE WHEN sr.status = 'failed' THEN 1 ELSE 0 END) AS failed_count
    FROM 
      projects p
    LEFT JOIN 
      images i ON p.id = i.project_id
    LEFT JOIN 
      segmentation_results sr ON i.id = sr.image_id
    WHERE 
      p.id = $1 AND p.user_id = $2
    GROUP BY 
      p.id
  `;

  const result = await queryCached(query, [projectId, userId]);

  if (result.length === 0) {
    throw new ApiError('Projekt nebyl nalezen nebo k němu nemáte přístup', 404);
  }

  return result[0];
}

// --- Optimalizované dotazy pro obrázky ---

/**
 * Získá obrázky projektu s informacemi o segmentaci
 */
export async function getProjectImages(
  projectId: string,
  page: number = 1,
  pageSize: number = 50,
  sortBy: string = 'created_at',
  sortOrder: 'ASC' | 'DESC' = 'DESC',
  filter: string = '',
  segmentationStatus: string = '',
): Promise<any[]> {
  const offset = (page - 1) * pageSize;

  // Validace řazení pro zabránění SQL injection
  const validSortColumns = ['name', 'created_at', 'updated_at', 'status'];
  if (!validSortColumns.includes(sortBy)) {
    sortBy = 'created_at';
  }

  // Validace směru řazení
  if (sortOrder !== 'ASC' && sortOrder !== 'DESC') {
    sortOrder = 'DESC';
  }

  // Sestavení dotazu
  let query = `
    SELECT 
      i.id,
      i.name,
      i.storage_path,
      i.thumbnail_path,
      i.width,
      i.height,
      i.created_at,
      i.updated_at,
      i.status,
      sr.status AS segmentation_status,
      sr.id AS segmentation_id
    FROM 
      images i
    LEFT JOIN 
      segmentation_results sr ON i.id = sr.image_id
    WHERE 
      i.project_id = $1
  `;

  const params: any[] = [projectId];
  let paramIndex = 2;

  // Přidání filtru podle názvu
  if (filter) {
    query += ` AND i.name ILIKE $${paramIndex}`;
    params.push(`%${filter}%`);
    paramIndex++;
  }

  // Přidání filtru podle stavu segmentace
  if (segmentationStatus) {
    query += ` AND sr.status = $${paramIndex}`;
    params.push(segmentationStatus);
    paramIndex++;
  }

  // Přidání řazení, limitu a offsetu
  query += `
    ORDER BY 
      ${sortBy === 'status' ? 'sr.status' : `i.${sortBy}`} ${sortOrder}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  params.push(pageSize, offset);

  return await queryCached(query, params);
}

/**
 * Získá detail obrázku s informacemi o segmentaci
 */
export async function getImageDetail(imageId: string, userId: string): Promise<any> {
  const query = `
    SELECT 
      i.id,
      i.project_id,
      i.name,
      i.storage_path,
      i.thumbnail_path,
      i.width,
      i.height,
      i.created_at,
      i.updated_at,
      i.status,
      sr.status AS segmentation_status,
      sr.id AS segmentation_id,
      sr.result_data,
      sr.updated_at AS segmentation_updated_at
    FROM 
      images i
    LEFT JOIN 
      segmentation_results sr ON i.id = sr.image_id
    JOIN 
      projects p ON i.project_id = p.id
    WHERE 
      i.id = $1 AND p.user_id = $2
  `;

  const result = await queryCached(query, [imageId, userId]);

  if (result.length === 0) {
    throw new ApiError('Obrázek nebyl nalezen nebo k němu nemáte přístup', 404);
  }

  return result[0];
}

// --- Optimalizované dotazy pro segmentaci ---

/**
 * Získá výsledek segmentace obrázku
 */
export async function getSegmentationResult(imageId: string, userId: string): Promise<any> {
  const query = `
    SELECT 
      sr.id,
      sr.image_id,
      sr.result_data,
      sr.parameters,
      sr.status,
      sr.created_at,
      sr.updated_at
    FROM 
      segmentation_results sr
    JOIN 
      images i ON sr.image_id = i.id
    JOIN 
      projects p ON i.project_id = p.id
    WHERE 
      sr.image_id = $1 AND p.user_id = $2
  `;

  const result = await queryCached(query, [imageId, userId]);

  if (result.length === 0) {
    return null;
  }

  return result[0];
}

/**
 * Aktualizuje výsledek segmentace obrázku
 */
export async function updateSegmentationResult(
  imageId: string,
  userId: string,
  resultData: any,
  status: string = 'completed',
): Promise<any> {
  return await executeTransaction(async (client) => {
    // Ověření přístupu k obrázku
    const accessCheck = await client.query(
      `
      SELECT 1
      FROM images i
      JOIN projects p ON i.project_id = p.id
      WHERE i.id = $1 AND p.user_id = $2
    `,
      [imageId, userId],
    );

    if (accessCheck.rows.length === 0) {
      throw new ApiError('Obrázek nebyl nalezen nebo k němu nemáte přístup', 404);
    }

    // Kontrola existence záznamu segmentace
    const checkResult = await client.query(
      `
      SELECT 1 FROM segmentation_results WHERE image_id = $1
    `,
      [imageId],
    );

    let result;

    if (checkResult.rows.length === 0) {
      // Vytvoření nového záznamu
      result = await client.query(
        `
        INSERT INTO segmentation_results (image_id, result_data, status, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
        RETURNING *
      `,
        [imageId, resultData, status],
      );
    } else {
      // Aktualizace existujícího záznamu
      result = await client.query(
        `
        UPDATE segmentation_results
        SET result_data = $1, status = $2, updated_at = NOW()
        WHERE image_id = $3
        RETURNING *
      `,
        [resultData, status, imageId],
      );
    }

    // Aktualizace stavu obrázku
    await client.query(
      `
      UPDATE images
      SET status = $1, updated_at = NOW()
      WHERE id = $2
    `,
      [status, imageId],
    );

    // Invalidace cache
    invalidateCache(
      `
      SELECT 
        sr.id,
        sr.image_id,
        sr.result_data,
        sr.parameters,
        sr.status,
        sr.created_at,
        sr.updated_at
      FROM 
        segmentation_results sr
      JOIN 
        images i ON sr.image_id = i.id
      JOIN 
        projects p ON i.project_id = p.id
      WHERE 
        sr.image_id = $1 AND p.user_id = $2
    `,
      [imageId, userId],
    );

    return result.rows[0];
  });
}

export default {
  queryCached,
  invalidateCache,
  invalidateTableCache,
  executeTransaction,
  getUserProjects,
  getProjectDetail,
  getProjectImages,
  getImageDetail,
  getSegmentationResult,
  updateSegmentationResult,
};
