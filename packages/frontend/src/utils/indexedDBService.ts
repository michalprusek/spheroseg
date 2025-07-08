/**
 * IndexedDB Service for storing and retrieving images
 * This service provides a way to store blob URLs and their corresponding binary data
 * in IndexedDB, which persists across page reloads.
 */

// Database configuration
const DB_NAME = 'spheroseg-images';
const DB_VERSION = 1;
const STORE_NAME = 'images';

// Open the database
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('Error opening IndexedDB:', event);
      reject('Error opening IndexedDB');
    };

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store for images if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('projectId', 'projectId', { unique: false });
        console.log('Created IndexedDB store for images');
      }
    };
  });
};

// Interface for image data
interface ImageData {
  id: string;
  projectId: string;
  blob: Blob;
  timestamp: number;
}

/**
 * Store an image blob in IndexedDB
 * @param imageId The ID of the image
 * @param projectId The ID of the project the image belongs to
 * @param blob The image blob to store
 */
export const storeImageBlob = async (imageId: string, projectId: string, blob: Blob): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const imageData: ImageData = {
      id: imageId,
      projectId,
      blob,
      timestamp: Date.now(),
    };

    const request = store.put(imageData);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        console.debug(`Stored image ${imageId} in IndexedDB`);
        resolve();
      };

      request.onerror = (event) => {
        console.error('Error storing image in IndexedDB:', event);
        reject('Error storing image');
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('Failed to store image in IndexedDB:', error);
    throw error;
  }
};

/**
 * Retrieve an image blob from IndexedDB
 * @param imageId The ID of the image to retrieve
 * @returns The image blob or null if not found
 */
export const getImageBlob = async (imageId: string): Promise<Blob | null> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(imageId);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const result = request.result as ImageData | undefined;
        if (result) {
          console.debug(`Retrieved image ${imageId} from IndexedDB`);
          resolve(result.blob);
        } else {
          // This is normal behavior when image hasn't been cached yet
          console.debug(`Image ${imageId} not found in IndexedDB cache`);
          resolve(null);
        }
      };

      request.onerror = (event) => {
        console.error('Error retrieving image from IndexedDB:', event);
        reject('Error retrieving image');
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('Failed to retrieve image from IndexedDB:', error);
    return null;
  }
};

/**
 * Delete an image from IndexedDB
 * @param imageId The ID of the image to delete
 */
export const deleteImageFromDB = async (imageId: string): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // First check if the image exists
    const checkRequest = store.count(imageId);

    return new Promise((resolve, reject) => {
      checkRequest.onsuccess = () => {
        if (checkRequest.result > 0) {
          // Image exists, delete it
          const deleteRequest = store.delete(imageId);

          deleteRequest.onsuccess = () => {
            console.log(`Deleted image ${imageId} from IndexedDB`);
            resolve();
          };

          deleteRequest.onerror = (event) => {
            console.error('Error deleting image from IndexedDB:', event);
            reject('Error deleting image');
          };
        } else {
          // Image doesn't exist, but we still consider it a success
          console.log(`Image ${imageId} not found in IndexedDB, nothing to delete`);
          resolve();
        }
      };

      checkRequest.onerror = (event) => {
        console.error('Error checking image existence in IndexedDB:', event);
        reject('Error checking image existence');
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('Failed to delete image from IndexedDB:', error);
    // We'll resolve rather than throw to ensure deletion workflow continues
    // even if IndexedDB operations fail
    return Promise.resolve();
  }
};

/**
 * Delete all images for a project from IndexedDB
 * @param projectId The ID of the project
 */
export const deleteProjectImages = async (projectId: string): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('projectId');
    const request = index.getAll(projectId);

    request.onsuccess = () => {
      const images = request.result as ImageData[];
      images.forEach((image) => {
        store.delete(image.id);
      });
      console.log(`Deleted ${images.length} images for project ${projectId} from IndexedDB`);
    };

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };

      transaction.onerror = (event) => {
        console.error('Error deleting project images from IndexedDB:', event);
        reject('Error deleting project images');
      };
    });
  } catch (error) {
    console.error('Failed to delete project images from IndexedDB:', error);
    throw error;
  }
};

/**
 * Clean up old data from IndexedDB
 * This function removes images older than the specified age
 * @param maxAgeMs Maximum age in milliseconds (default: 7 days)
 */
export const cleanupOldData = async (maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const now = Date.now();
      const images = request.result as ImageData[];
      let deletedCount = 0;

      images.forEach((image) => {
        // Check if the image is older than maxAgeMs
        if (now - image.timestamp > maxAgeMs) {
          store.delete(image.id);
          deletedCount++;
        }
      });

      console.log(`Cleaned up ${deletedCount} old images from IndexedDB`);
    };

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };

      transaction.onerror = (event) => {
        console.error('Error cleaning up old data from IndexedDB:', event);
        reject('Error cleaning up old data');
      };
    });
  } catch (error) {
    console.error('Failed to clean up old data from IndexedDB:', error);
    throw error;
  }
};

/**
 * Get database statistics
 * @returns Statistics about the database
 */
export const getDBStats = async (): Promise<{ count: number; totalSize: number }> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const countRequest = store.count();
    const allRequest = store.getAll();

    return new Promise((resolve, reject) => {
      allRequest.onsuccess = () => {
        const images = allRequest.result as ImageData[];
        let totalSize = 0;

        // Calculate total size
        images.forEach((image) => {
          totalSize += image.blob.size;
        });

        countRequest.onsuccess = () => {
          resolve({
            count: countRequest.result,
            totalSize,
          });
        };
      };

      transaction.oncomplete = () => {
        db.close();
      };

      transaction.onerror = (event) => {
        console.error('Error getting database statistics:', event);
        reject('Error getting database statistics');
      };
    });
  } catch (error) {
    console.error('Failed to get database statistics:', error);
    return { count: 0, totalSize: 0 };
  }
};

/**
 * Delete the entire IndexedDB database
 * This will clear all cached images completely
 * @returns Promise that resolves when database is cleared
 */
export const clearEntireDatabase = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
    
    deleteRequest.onsuccess = () => {
      console.log('IndexedDB database completely cleared');
      resolve();
    };
    
    deleteRequest.onerror = (event) => {
      console.error('Error clearing IndexedDB database:', event);
      reject(new Error('Error clearing database'));
    };
    
    deleteRequest.onblocked = () => {
      console.warn('Database deletion blocked - close all tabs and try again');
      reject(new Error('Database deletion blocked'));
    };
  });
};
