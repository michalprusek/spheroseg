/* eslint-disable no-prototype-builtins */
/**
 * Project Images API
 *
 * This module provides functions for working with project images
 * when the standard API endpoints are not available.
 */
import { Image, ProjectImage, ImageStatus } from '@/types';
import { constructUrl } from '@/lib/urlUtils';
import { storeImageBlob } from '@/utils/indexedDBService';
import apiClient from '@/lib/apiClient';
import cacheService, { CacheLayer } from '@/services/unifiedCacheService';
import logger from '@/utils/logger';

/**
 * Default illustration images to use when no real images are available
 */
const DEFAULT_ILLUSTRATIONS = [
  '/assets/illustrations/026f6ae6-fa28-487c-8263-f49babd99dd3.png',
  '/assets/illustrations/19687f60-a78f-49e3-ada7-8dfc6a5fab4e.png',
  '/assets/illustrations/8f483962-36d5-4bae-8c90-c9542f8cc2d8.png',
];

/**
 * Generate a unique ID for an image
 * This creates a consistent format that can be validated
 */
export const generateImageId = (): string => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `img-${timestamp}-${random}`;
};

/**
 * Validate an image ID
 * @param id The image ID to validate
 * @returns True if the ID is valid, false otherwise
 */
export const isValidImageId = (id: string | undefined | null): boolean => {
  if (!id) return false;

  // Check for standard img-timestamp-random format
  if (id.startsWith('img-') && /^img-\d+-\d+$/.test(id)) {
    return true;
  }

  // Check for UUID format (for backend-generated IDs)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return true;
  }

  return false;
};

/**
 * Create a synthetic image object from a path
 */
export const createImageFromPath = (path: string, projectId: string): Image => {
  const imageUuid = generateImageId();
  const now = new Date().toISOString();

  return {
    id: imageUuid,
    project_id: projectId,
    user_id: 'system-generated',
    name: `Image ${imageUuid.substring(0, 8)}`,
    storage_path: path,
    thumbnail_path: path,
    width: 800,
    height: 600,
    metadata: {
      source: 'illustration',
    },
    status: 'completed' as ImageStatus,
    created_at: now,
    updated_at: now,
    segmentation_result: null,
  };
};

/**
 * Map an API image to a ProjectImage for the UI
 */
export const mapApiImageToProjectImage = (apiImage: Image): ProjectImage => {
  const ensurePath = (path: string | undefined | null): string | undefined => {
    if (!path) return undefined;
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    if (path.includes('assets/illustrations/')) {
      return `/${path.startsWith('/') ? path.substring(1) : path}`;
    }
    return constructUrl(path);
  };

  const imageUrl = ensurePath(apiImage.storage_path);
  const thumbnailUrl = apiImage.thumbnail_path ? ensurePath(apiImage.thumbnail_path) : null;

  if (!imageUrl) {
    logger.warn(`Could not construct URL for image: ${apiImage.id}`, apiImage);
  }

  let segmentationResultPathValue: string | null = null;
  const pathFromApi = apiImage.segmentation_result?.path;
  if (pathFromApi) {
    const ensuredPath = ensurePath(pathFromApi);
    segmentationResultPathValue = ensuredPath === undefined ? null : ensuredPath;
  }

  // Prioritize segmentation_status field from database
  let finalStatus = 'without_segmentation';
  if (apiImage.segmentation_status) {
    finalStatus = apiImage.segmentation_status;
  } else if (apiImage.segmentationStatus) {
    finalStatus = apiImage.segmentationStatus;
  } else if (apiImage.status) {
    finalStatus = apiImage.status;
  }

  return {
    id: apiImage.id,
    project_id: apiImage.project_id,
    imageUuid: apiImage.id,
    name: apiImage.name || `Image ${apiImage.id.substring(0, 8)}`,
    url: imageUrl || '/placeholder-image.png',
    thumbnail_url: thumbnailUrl ?? null,
    createdAt: new Date(apiImage.created_at),
    updatedAt: new Date(apiImage.updated_at),
    width: apiImage.width || null,
    height: apiImage.height || null,
    segmentationStatus: finalStatus,
    segmentationResultPath: segmentationResultPathValue,
    segmentation_status: apiImage.segmentation_status, // Keep original field for reference
  };
};

/**
 * Get default illustration images for a project
 */
export const getDefaultProjectImages = (projectId: string): Image[] => {
  return DEFAULT_ILLUSTRATIONS.map((path) => createImageFromPath(path, projectId));
};

// Legacy cache for backward compatibility - will be removed
export const projectImagesCache: Record<string, { data: ProjectImage[]; timestamp: number }> = {};

const getLocalStorageKey = (projectId: string) => `spheroseg_images_${projectId}`;

export const loadImagesFromStorage = (projectId: string): ProjectImage[] => {
  const key = getLocalStorageKey(projectId);
  try {
    const storedImages = localStorage.getItem(key);
    if (storedImages) {
      const parsedImages = JSON.parse(storedImages) as Array<unknown>;

      // Načteme obrázky z localStorage
      const images = parsedImages
        .map((img: unknown) => {
          // Basic validation and transformation
          if (!img || typeof img.id !== 'string') {
            logger.warn('Skipping invalid image data from localStorage:', img);
            return null;
          }

          // Vytvoříme základní objekt obrázku
          const imageObject = {
            ...img,
            id: img.id || generateImageId(),
            imageUuid: img.imageUuid || img.id,
            createdAt: img.createdAt ? new Date(img.createdAt) : new Date(),
            updatedAt: img.updatedAt ? new Date(img.updatedAt) : new Date(),
            segmentationStatus: img.segmentationStatus || 'without_segmentation',
            project_id: img.project_id || projectId,
            name: img.name || 'Unnamed Image',
            url: img.url || '',
            thumbnail_url: img.thumbnail_url || null,
            width: img.width || null,
            height: img.height || null,
            segmentationResultPath: img.segmentationResultPath || null,
          } as ProjectImage;

          // Check for IndexedDB flags instead of URL schemes
          if (img._hasIndexedDBImage) {
            imageObject._needsIndexedDBLoad = true;
          }

          if (img._hasIndexedDBThumb) {
            imageObject._needsIndexedDBThumbLoad = true;
          }

          // Handle legacy indexed-db:// URLs for backward compatibility
          if (imageObject.url && imageObject.url.startsWith('indexed-db://')) {
            imageObject._needsIndexedDBLoad = true;
            imageObject.url = '';
          }

          if (imageObject.thumbnail_url && imageObject.thumbnail_url.startsWith('indexed-db-thumb://')) {
            imageObject._needsIndexedDBThumbLoad = true;
            imageObject.thumbnail_url = null;
          }

          return imageObject;
        })
        .filter((img) => img !== null) as ProjectImage[];

      // Asynchronně načteme data z IndexedDB pro obrázky, které to potřebují
      if (images.some((img) => img._needsIndexedDBLoad || img._needsIndexedDBThumbLoad)) {
        logger.debug(`Some images need to load data from IndexedDB for project ${projectId}`);

        // Asynchronně načteme data z IndexedDB
        import('../utils/indexedDBService')
          .then(({ getImageBlob }) => {
            images.forEach(async (img) => {
              try {
                // Načteme hlavní obrázek z IndexedDB
                if (img._needsIndexedDBLoad) {
                  const blob = await getImageBlob(img.id);
                  if (blob) {
                    img.url = URL.createObjectURL(blob);
                    logger.debug(`Loaded image ${img.id} from IndexedDB`);
                    delete img._needsIndexedDBLoad;
                  }
                }

                // Načteme thumbnail z IndexedDB
                if (img._needsIndexedDBThumbLoad) {
                  const blob = await getImageBlob(`thumb-${img.id}`);
                  if (blob) {
                    img.thumbnail_url = URL.createObjectURL(blob);
                    logger.debug(`Loaded thumbnail for image ${img.id} from IndexedDB`);
                    delete img._needsIndexedDBThumbLoad;
                  }
                }
              } catch (blobError) {
                logger.error(`Failed to load image ${img.id} from IndexedDB:`, blobError);
              }
            });
          })
          .catch((err) => {
            logger.error('Failed to import indexedDBService:', err);
          });
      }

      return images;
    }
  } catch (error) {
    logger.error('Error loading images from localStorage:', error);
  }
  return [];
};

export const saveImagesToStorage = (projectId: string, images: ProjectImage[]): void => {
  const key = getLocalStorageKey(projectId);
  try {
    // Připravíme data pro uložení
    const imagesToStore = images.map((image) => ({
      ...image,
      createdAt: image.createdAt instanceof Date ? image.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: image.updatedAt instanceof Date ? image.updatedAt.toISOString() : new Date().toISOString(),
      _tempUrl: undefined,
    }));

    // Rozdělíme obrázky na ty s velkými daty (base64) a metadata
    const largeImages = imagesToStore.filter(
      (img) => (img.url && img.url.startsWith('data:')) || (img.thumbnail_url && img.thumbnail_url.startsWith('data:')),
    );

    // Pro velké obrázky uložíme pouze metadata do localStorage
    const metadataImages = imagesToStore.map((img) => ({
      ...img,
      // Pokud je URL base64, označíme ji pro IndexedDB a nastavíme prázdný string
      url: img.url && img.url.startsWith('data:') ? '' : img.url,
      // Pokud je thumbnail base64, označíme ho pro IndexedDB a nastavíme null
      thumbnail_url: img.thumbnail_url && img.thumbnail_url.startsWith('data:') ? null : img.thumbnail_url,
      // Přidáme flagy pro označení, že data jsou v IndexedDB
      _hasIndexedDBImage: img.url && img.url.startsWith('data:'),
      _hasIndexedDBThumb: img.thumbnail_url && img.thumbnail_url.startsWith('data:'),
    }));

    // Uložíme metadata do localStorage
    localStorage.setItem(key, JSON.stringify(metadataImages));

    // Pokud máme velké obrázky, uložíme je do IndexedDB
    if (largeImages.length > 0) {
      logger.debug(`Storing ${largeImages.length} large images in IndexedDB for project ${projectId}`);

      // Asynchronně uložíme velké obrázky do IndexedDB
      import('../utils/indexedDBService')
        .then(({ storeImageBlob }) => {
          largeImages.forEach(async (img) => {
            try {
              // Pokud máme base64 URL, převedeme ji na Blob a uložíme
              if (img.url && img.url.startsWith('data:')) {
                const response = await fetch(img.url);
                const blob = await response.blob();
                await storeImageBlob(img.id, projectId, blob);
              }

              // Pokud máme base64 thumbnail, převedeme ho na Blob a uložíme s prefixem thumb-
              if (img.thumbnail_url && img.thumbnail_url.startsWith('data:')) {
                const response = await fetch(img.thumbnail_url);
                const blob = await response.blob();
                await storeImageBlob(`thumb-${img.id}`, projectId, blob);
              }
            } catch (blobError) {
              logger.error(`Failed to store image ${img.id} in IndexedDB:`, blobError);
            }
          });
        })
        .catch((err) => {
          logger.error('Failed to import indexedDBService:', err);
        });
    }
  } catch (error) {
    logger.error('Error saving images to localStorage:', error);
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      logger.warn('LocalStorage quota exceeded. Consider clearing some data or using a different storage solution.');
    }
  }
};

const CACHE_EXPIRATION = 5 * 60 * 1000;
const CACHE_KEY_PREFIX = 'project-images';

export const cleanLocalStorageFromBlobUrls = (projectId: string): void => {
  const key = getLocalStorageKey(projectId);
  try {
    const storedImages = localStorage.getItem(key);
    if (storedImages) {
      const images: ProjectImage[] = JSON.parse(storedImages);
      let updated = false;
      const cleanedImages = images.map((image) => {
        if (image.url && image.url.startsWith('blob:')) {
          logger.debug(`Removing blob URL for image ${image.id}: ${image.url}`);
          updated = true;
          return { ...image, url: '', _tempUrl: undefined };
        }
        if (image._tempUrl) {
          updated = true;
          return { ...image, _tempUrl: undefined };
        }
        return image;
      });

      if (updated) {
        localStorage.setItem(key, JSON.stringify(cleanedImages));
        logger.debug('Cleaned blob URLs from localStorage for project:', projectId);
      }
    }
  } catch (error) {
    logger.error('Error cleaning blob URLs from localStorage:', error);
  }
};

/**
 * Update image status in all caches
 * This ensures the image status is updated in all storage layers
 * @param projectId The ID of the project
 * @param imageId The ID of the image to update
 * @param status The new segmentation status
 * @param resultPath Optional segmentation result path
 */
export const updateImageStatusInCache = async (
  projectId: string,
  imageId: string,
  status: string,
  resultPath?: string | null,
): Promise<void> => {
  // Clean projectId to ensure consistent format
  const cleanProjectId = projectId.startsWith('project-') ? projectId.substring(8) : projectId;

  try {
    // 1. Update unified cache
    const cacheKey = `${CACHE_KEY_PREFIX}:${cleanProjectId}`;
    const cachedImages = await cacheService.get<ProjectImage[]>(cacheKey);
    if (cachedImages) {
      const updatedImages = cachedImages.map((img) => {
        if (img.id === imageId) {
          return {
            ...img,
            segmentationStatus: status,
            segmentationResultPath: resultPath !== undefined ? resultPath : img.segmentationResultPath,
          };
        }
        return img;
      });
      await cacheService.set(cacheKey, updatedImages, {
        ttl: CACHE_EXPIRATION,
        layer: [CacheLayer.MEMORY, CacheLayer.LOCAL_STORAGE],
        tags: ['project-data', `project-${cleanProjectId}`, 'images'],
      });
    }

    // 2. Update legacy project images cache
    if (projectImagesCache && projectImagesCache[cleanProjectId]) {
      projectImagesCache[cleanProjectId].data = projectImagesCache[cleanProjectId].data.map((img) => {
        if (img.id === imageId) {
          return {
            ...img,
            segmentationStatus: status,
            segmentationResultPath: resultPath !== undefined ? resultPath : img.segmentationResultPath,
          };
        }
        return img;
      });
    }

    // 3. Update localStorage
    const storageKey = getLocalStorageKey(cleanProjectId);
    const storedImages = localStorage.getItem(storageKey);
    if (storedImages) {
      const images = JSON.parse(storedImages) as ProjectImage[];
      const updatedImages = images.map((img) => {
        if (img.id === imageId) {
          return {
            ...img,
            segmentationStatus: status,
            segmentationResultPath: resultPath !== undefined ? resultPath : img.segmentationResultPath,
          };
        }
        return img;
      });
      localStorage.setItem(storageKey, JSON.stringify(updatedImages));
    }

    logger.debug(`Updated image ${imageId} status to ${status} in all caches`);
  } catch (error) {
    logger.error(`Failed to update image ${imageId} status in caches:`, error);
  }
};

/**
 * Clean all storages for a specific image
 * This ensures an image is completely removed from all caches and storage
 * @param projectId The ID of the project
 * @param imageId The ID of the image to clean
 */
export const cleanImageFromAllStorages = async (projectId: string, imageId: string): Promise<void> => {
  // Clean projectId to ensure consistent format
  const cleanProjectId = projectId.startsWith('project-') ? projectId.substring(8) : projectId;

  try {
    // 1. Clean unified cache
    const cacheKey = `${CACHE_KEY_PREFIX}:${cleanProjectId}`;
    const cachedImages = await cacheService.get<ProjectImage[]>(cacheKey);
    if (cachedImages) {
      const updatedImages = cachedImages.filter((img) => img.id !== imageId);
      await cacheService.set(cacheKey, updatedImages, {
        ttl: CACHE_EXPIRATION,
        layer: [CacheLayer.MEMORY, CacheLayer.LOCAL_STORAGE],
        tags: ['project-data', `project-${cleanProjectId}`, 'images'],
      });
    }

    // 2. Clean legacy project images cache
    if (projectImagesCache && projectImagesCache[cleanProjectId]) {
      logger.debug(`Cleaning image ${imageId} from project images cache`);
      if (projectImagesCache[cleanProjectId].data) {
        projectImagesCache[cleanProjectId].data = projectImagesCache[cleanProjectId].data.filter(
          (img) => img.id !== imageId,
        );
      }
    }

    // 2. Clean localStorage items
    const storageKeys = [`spheroseg_images_${cleanProjectId}`, `spheroseg_uploaded_images_${cleanProjectId}`];

    for (const key of storageKeys) {
      const storedData = localStorage.getItem(key);
      if (storedData) {
        try {
          const parsedData = JSON.parse(storedData);
          if (Array.isArray(parsedData)) {
            // Filter out the image
            const updatedData = parsedData.filter((item) => item.id !== imageId);
            localStorage.setItem(key, JSON.stringify(updatedData));
            logger.debug(`Removed image ${imageId} from localStorage key ${key}`);
          }
        } catch (parseError) {
          logger.error(`Error parsing localStorage data for key ${key}:`, parseError);
        }
      }
    }

    // 3. Clean IndexedDB
    try {
      const { deleteImageFromDB } = await import('@/utils/indexedDBService');
      await deleteImageFromDB(imageId);
      logger.debug(`Deleted image ${imageId} from IndexedDB`);
    } catch (dbError) {
      logger.error(`Error deleting image ${imageId} from IndexedDB:`, dbError);
    }

    // 4. If there are any blob URLs, revoke them
    try {
      const storageKey = getLocalStorageKey(cleanProjectId);
      const storedImages = localStorage.getItem(storageKey);
      if (storedImages) {
        const images = JSON.parse(storedImages) as ProjectImage[];
        const image = images.find((img) => img.id === imageId);

        if (image) {
          if (image.url && image.url.startsWith('blob:')) {
            URL.revokeObjectURL(image.url);
            logger.debug(`Revoked blob URL for image ${imageId}: ${image.url}`);
          }

          if (image._tempUrl && typeof image._tempUrl === 'string' && image._tempUrl.startsWith('blob:')) {
            URL.revokeObjectURL(image._tempUrl);
            logger.debug(`Revoked temporary blob URL for image ${imageId}: ${image._tempUrl}`);
          }
        }
      }
    } catch (blobError) {
      logger.error(`Error revoking blob URLs for image ${imageId}:`, blobError);
    }

    logger.debug(`Completed cleaning image ${imageId} from all storages for project ${cleanProjectId}`);
  } catch (error) {
    logger.error(`Failed to clean image ${imageId} from all storages:`, error);
  }
};

export const storeUploadedImages = async (projectId: string, imagesToStore: ProjectImage[]): Promise<void> => {
  if (!projectId) {
    logger.error('Project ID is required to store uploaded images.');
    return;
  }

  const processedImages: ProjectImage[] = [];

  for (const image of imagesToStore) {
    let imageUrl = image.url;
    let tempUrlToRevoke: string | undefined = undefined;

    if (image.url && image.url.startsWith('blob:')) {
      try {
        const response = await fetch(image.url);
        const blob = await response.blob();
        tempUrlToRevoke = image.url;
        await storeImageBlob(image.id, projectId, blob);
        imageUrl = image.url;
        logger.debug(`Stored blob in IndexedDB for image ${image.id}`);
      } catch (error) {
        logger.error(`Failed to process and store blob for image ${image.id}:`, error);
      }
    }

    processedImages.push({
      ...image,
      url: imageUrl,
      _tempUrl: imageUrl.startsWith('blob:') ? imageUrl : undefined,
    });

    if (tempUrlToRevoke) {
      URL.revokeObjectURL(tempUrlToRevoke);
      logger.debug(`Revoked object URL: ${tempUrlToRevoke}`);
    }
  }

  const existingImages = loadImagesFromStorage(projectId);
  const updatedImages = [
    ...existingImages.filter((ex) => !processedImages.find((pi) => pi.id === ex.id)),
    ...processedImages,
  ];
  saveImagesToStorage(projectId, updatedImages);
  logger.debug(
    `Stored/updated ${processedImages.length} images with blob URLs in localStorage for project ${projectId}.`,
  );
};

/**
 * Clear all caches for a specific project
 * This ensures fresh data is fetched on the next request
 * @param projectId The ID of the project to clear cache for
 */
export const clearProjectImageCache = async (projectId: string): Promise<void> => {
  const cleanProjectId = projectId.startsWith('project-') ? projectId.substring(8) : projectId;

  try {
    // 1. Clear unified cache
    const cacheKey = `${CACHE_KEY_PREFIX}:${cleanProjectId}`;
    await cacheService.delete(cacheKey);

    // 2. Clear legacy project images cache
    if (projectImagesCache[cleanProjectId]) {
      delete projectImagesCache[cleanProjectId];
    }

    // 3. Clear localStorage
    const storageKey = getLocalStorageKey(cleanProjectId);
    localStorage.removeItem(storageKey);

    logger.debug(`Cleared all caches for project ${cleanProjectId}`);
  } catch (error) {
    logger.error(`Failed to clear cache for project ${cleanProjectId}:`, error);
  }
};

export const getProjectImages = async (projectId: string, skipCache: boolean = false): Promise<ProjectImage[]> => {
  const cleanProjectId = projectId.startsWith('project-') ? projectId.substring(8) : projectId;
  cleanLocalStorageFromBlobUrls(cleanProjectId);

  // Try unified cache first unless skipCache is true
  if (!skipCache) {
    const cacheKey = `${CACHE_KEY_PREFIX}:${cleanProjectId}`;
    const cachedImages = await cacheService.get<ProjectImage[]>(cacheKey, {
      layer: [CacheLayer.MEMORY, CacheLayer.LOCAL_STORAGE],
    });

    // Only return cached data if it's not an empty array
    // This ensures we always try to fetch from API when there are no images in cache
    if (cachedImages && cachedImages.length > 0) {
      logger.debug(`Retrieved ${cachedImages.length} images from unified cache for project ${cleanProjectId}`);
      return cachedImages;
    }
  }

  try {
    logger.debug(`Fetching images from API for project: ${cleanProjectId}`);
    const response = await apiClient.get(`/api/projects/${cleanProjectId}/images`);
    const responseData = response.data;

    if (
      typeof responseData !== 'object' ||
      responseData === null ||
      !('images' in responseData) ||
      !Array.isArray(responseData.images)
    ) {
      logger.warn(`API returned unexpected data for project ${cleanProjectId}:`, responseData);
      throw new Error('Invalid data from API');
    }

    const apiImages = responseData.images;

    logger.debug(`Retrieved ${apiImages.length} images from API for project ${cleanProjectId}`);
    const mappedImages = apiImages.map((image: Image) => {
      const projectImage = mapApiImageToProjectImage(image);
      // Removed explicit placeholder assignment for TIFFs as backend now handles conversion
      return projectImage;
    });

    // Store in unified cache
    const cacheKey = `${CACHE_KEY_PREFIX}:${cleanProjectId}`;
    await cacheService.set(cacheKey, mappedImages, {
      ttl: CACHE_EXPIRATION,
      layer: [CacheLayer.MEMORY, CacheLayer.LOCAL_STORAGE],
      tags: ['project-data', `project-${cleanProjectId}`, 'images'],
    });

    // Keep legacy cache for backward compatibility
    projectImagesCache[cleanProjectId] = { data: mappedImages, timestamp: Date.now() };
    saveImagesToStorage(cleanProjectId, mappedImages); // Save to local storage
    return mappedImages;
  } catch (apiError) {
    logger.warn(`Failed to fetch images from API for project ${cleanProjectId}:`, apiError);

    const localImages = loadImagesFromStorage(cleanProjectId);
    if (localImages.length > 0) {
      logger.debug(`Loaded ${localImages.length} images from local storage for project ${cleanProjectId}`);
      return localImages;
    }

    logger.error(`No images available for project ${cleanProjectId}`);
    return [];
  }
};
