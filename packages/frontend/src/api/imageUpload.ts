/**
 * Image Upload API
 *
 * This module provides functions for uploading images to the server
 */
import apiClient from '@/lib/apiClient';
import uploadClient from '@/lib/uploadClient';
import { Image as ApiImageType, ProjectImage } from '@/types';
import { mapApiImageToProjectImage } from './projectImages';

const UNIFIED_UPLOAD_ENDPOINT = (projectId: string) => `/api/projects/${projectId}/images`;

/**
 * Upload a single file to the server using the unified endpoint.
 * @param projectId The project ID to upload the file to
 * @param file The file to upload
 * @returns The uploaded image data including server-generated UUID
 */
export const uploadFile = async (projectId: string, file: File): Promise<ProjectImage> => {
  try {
    const formData = new FormData();
    formData.append('images', file); // Backend expects an array under 'images' key
    // projectId is in the URL, no need to append to formData unless backend specifically requires it.

    // Don't set Content-Type header explicitly for FormData
    // axios will automatically set it with the correct boundary
    const config = {};

    // Explicitly state that we expect an array of Image-like objects from the backend
    // even for a single file upload, as per the new unified spec.
    const response = await uploadClient.post<ApiImageType[]>(UNIFIED_UPLOAD_ENDPOINT(projectId), formData, config);

    // Assuming backend returns an array even for a single file upload as per new spec
    if (Array.isArray(response.data) && response.data.length > 0) {
      return mapApiImageToProjectImage(response.data[0]);
    }
    // Fallback if backend returns a single Image-like object directly (less ideal but handle for robustness)
    // This case should ideally not happen if backend adheres to spec (always returning an array)
    if (response.data && !Array.isArray(response.data)) {
      console.warn('Backend returned a single object for single file upload, expected an array. Attempting to map.');
      // We need to cast to 'any' then 'Image' if we are sure about the structure
      // but it's safer to assume the backend should always return an array.
      // If this path is hit, it indicates a backend deviation from spec.
      // For now, to satisfy type checking if backend sends single object that IS an Image:
      return mapApiImageToProjectImage(response.data as unknown as ApiImageType);
    }
    throw new Error('Invalid response from server after file upload');
  } catch (error) {
    console.error('Error uploading single file:', error);
    throw error;
  }
};

/**
 * Upload multiple files to the server using the unified endpoint.
 * @param projectId The project ID to upload the files to
 * @param files The files to upload
 * @returns The uploaded image data including server-generated UUIDs
 */
export const uploadFiles = async (projectId: string, files: File[]): Promise<ProjectImage[]> => {
  if (files.length === 0) {
    return [];
  }

  try {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('images', file); // Backend expects multiple files under the same 'images' key
    });
    // projectId is in the URL

    // Don't set Content-Type header explicitly for FormData
    // axios will automatically set it with the correct boundary
    const config = {};

    // Explicitly state that we expect an array of Image-like objects from the backend.
    const response = await uploadClient.post<ApiImageType[]>(UNIFIED_UPLOAD_ENDPOINT(projectId), formData, config);

    if (Array.isArray(response.data)) {
      // Explicitly cast response.data to ApiImageType[] to ensure TypeScript understands the shape
      return (response.data as ApiImageType[]).map(mapApiImageToProjectImage);
    }
    throw new Error('Invalid response from server after files upload; expected an array.');
  } catch (error) {
    console.error('Error uploading multiple files:', error);
    // The original error is re-thrown, no more internal fallbacks to other endpoints.
    // The `uploadFilesWithFallback` will handle the local storage fallback if this throws.
    throw error;
  }
};

/**
 * Upload files with proper error handling
 * @param projectId The project ID to upload the files to
 * @param files The files to upload
 * @returns The uploaded image data
 * @throws Error if upload fails
 */
export const uploadFilesWithoutFallback = async (projectId: string, files: File[]): Promise<ProjectImage[]> => {
  try {
    // Try to upload the files to the server using the now unified uploadFiles function
    return await uploadFiles(projectId, files);
  } catch (error) {
    console.error('Error uploading files (no fallback):', error);
    // Do not use fallback, just propagate the error
    throw error;
  }
};

/**
 * Upload files with fallback to local storage if API fails
 * @param projectId The project ID to upload the files to
 * @param files The files to upload
 * @param onProgress Optional progress callback (fileName, progress, fileIndex, totalFiles)
 * @returns The uploaded image data
 */
export const uploadFilesWithFallback = async (
  projectId: string, 
  files: File[], 
  onProgress?: (fileName: string, progress: number, fileIndex: number, totalFiles: number) => void
): Promise<ProjectImage[]> => {
  // Kontrola, zda máme nějaké soubory k nahrání
  if (!files || files.length === 0) {
    console.log('No files to upload');
    return [];
  }

  try {
    // Kontrola velikosti dávky - backend má limit 20 souborů na jeden požadavek
    const BATCH_SIZE = 20;

    // Pokud je souborů méně než BATCH_SIZE, použijeme standardní uploadFiles
    if (files.length <= BATCH_SIZE) {
      // Report progress for single batch
      if (onProgress) {
        files.forEach((file, index) => {
          onProgress(file.name, 50, index, files.length);
        });
      }
      
      const result = await uploadFiles(projectId, files);
      
      // Report completion
      if (onProgress) {
        files.forEach((file, index) => {
          onProgress(file.name, 100, index, files.length);
        });
      }
      
      return result;
    }

    // Pokud je souborů více, rozdělíme je na dávky
    console.log(`Splitting ${files.length} files into batches of ${BATCH_SIZE}`);

    const allUploadedImages: ProjectImage[] = [];

    // Rozdělíme soubory do dávek a nahrajeme je postupně
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(files.length / BATCH_SIZE);

      console.log(`Uploading batch ${batchNumber}/${totalBatches} with ${batch.length} files`);

      // Report progress for current batch start
      if (onProgress) {
        batch.forEach((file, batchIndex) => {
          const globalIndex = i + batchIndex;
          onProgress(file.name, 25, globalIndex, files.length);
        });
      }

      try {
        // Nahrajeme dávku
        const batchImages = await uploadFiles(projectId, batch);
        console.log(`Successfully uploaded batch ${batchNumber}/${totalBatches} with ${batchImages.length} images`);

        // Report progress for current batch completion
        if (onProgress) {
          batch.forEach((file, batchIndex) => {
            const globalIndex = i + batchIndex;
            onProgress(file.name, 100, globalIndex, files.length);
          });
        }

        // Přidáme nahraná data do celkového výsledku
        allUploadedImages.push(...batchImages);
      } catch (batchError) {
        console.error(`Error uploading batch ${batchNumber}/${totalBatches}:`, batchError);

        // Report progress for fallback processing
        if (onProgress) {
          batch.forEach((file, batchIndex) => {
            const globalIndex = i + batchIndex;
            onProgress(file.name, 75, globalIndex, files.length);
          });
        }

        // Pokud selže nahrávání dávky, vytvoříme lokální obrázky pro tuto dávku
        const localBatchImages = await createLocalImages(projectId, batch);
        allUploadedImages.push(...localBatchImages);

        // Report completion for fallback
        if (onProgress) {
          batch.forEach((file, batchIndex) => {
            const globalIndex = i + batchIndex;
            onProgress(file.name, 100, globalIndex, files.length);
          });
        }
      }
    }

    return allUploadedImages;
  } catch (error) {
    console.error('Error uploading files to server, using local fallback:', error);

    // Report progress for fallback processing
    if (onProgress) {
      files.forEach((file, index) => {
        onProgress(file.name, 50, index, files.length);
      });
    }

    // Vytvoříme lokální obrázky pro všechny soubory
    const result = await createLocalImages(projectId, files);

    // Report completion for fallback
    if (onProgress) {
      files.forEach((file, index) => {
        onProgress(file.name, 100, index, files.length);
      });
    }

    return result;
  }
};

/**
 * Vytvoří lokální ProjectImage objekty pro soubory
 * @param projectId ID projektu
 * @param files Soubory k zpracování
 * @returns Pole ProjectImage objektů
 */
async function createLocalImages(projectId: string, files: File[]): Promise<ProjectImage[]> {
  // Import the generateImageId function
  const { generateImageId } = await import('./projectImages');

  // Create local ProjectImage objects for each file
  const localImages: ProjectImage[] = await Promise.all(
    files.map(async (file) => {
      // Generate a unique ID for the image using the proper function
      const id = generateImageId();

      // Convert file to base64 string
      const base64String = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          } else {
            reject(new Error('FileReader did not return a string'));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Get the current date as ISO string
      const now = new Date().toISOString();

      // Get image dimensions if possible
      let width = 0;
      let height = 0;

      try {
        // Only try to get dimensions for image types that can be loaded in browser
        const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
        const fileType = file.type.toLowerCase();
        
        if (imageTypes.includes(fileType)) {
          // Create an image element to get dimensions
          const img = new Image();
          img.src = base64String;

          // Wait for the image to load with timeout
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Image load timeout'));
            }, 5000); // 5 second timeout
            
            img.onload = () => {
              clearTimeout(timeout);
              resolve(undefined);
            };
            img.onerror = () => {
              clearTimeout(timeout);
              reject(new Error('Image failed to load'));
            };
          });

          width = img.width;
          height = img.height;
        } else {
          // For unsupported types like TIFF/BMP, dimensions will remain 0
          console.log(`Skipping dimension extraction for unsupported type: ${fileType}`);
        }
      } catch (dimensionError) {
        // This is expected for certain file types, so use debug level logging
        console.debug(`Could not get image dimensions for ${file.name}:`, dimensionError);
      }

      // Create a thumbnail from the base64 string
      let thumbnailBase64 = base64String;
      try {
        // For TIFF/BMP files, use canvas preview
        const ext = file.name.toLowerCase();
        if (ext.endsWith('.tiff') || ext.endsWith('.tif') || ext.endsWith('.bmp')) {
          const { generateCanvasPreview } = await import('../utils/tiffPreview');
          thumbnailBase64 = generateCanvasPreview(file);
        } else {
          // Simple thumbnail creation by loading the image and drawing it to a smaller canvas
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            console.warn('Could not get 2D context for thumbnail generation');
            thumbnailBase64 = base64String; // Use original if context fails
          } else {
            // Create an image element to get dimensions
            const tempImg = new Image();
            tempImg.src = base64String;

            await new Promise<void>((resolveLoad, rejectLoad) => {
              tempImg.onload = () => resolveLoad();
              tempImg.onerror = (e) => {
                console.warn(`Image failed to load for thumbnail: ${file.name}`);
                rejectLoad(new Error(`Temp image for thumbnail failed to load: ${e}`));
              };
            });

          const MAX_THUMB_WIDTH = 150;
          const MAX_THUMB_HEIGHT = 150;
          let thumbWidth = tempImg.width;
          let thumbHeight = tempImg.height;

          if (thumbWidth > MAX_THUMB_WIDTH) {
            thumbHeight = (MAX_THUMB_WIDTH / thumbWidth) * thumbHeight;
            thumbWidth = MAX_THUMB_WIDTH;
          }
          if (thumbHeight > MAX_THUMB_HEIGHT) {
            thumbWidth = (MAX_THUMB_HEIGHT / thumbHeight) * thumbWidth;
            thumbHeight = MAX_THUMB_HEIGHT;
          }

          canvas.width = thumbWidth;
          canvas.height = thumbHeight;
          ctx.drawImage(tempImg, 0, 0, thumbWidth, thumbHeight);
          thumbnailBase64 = canvas.toDataURL(file.type); // Use original file type if possible
          }
        }
      } catch (thumbError) {
        console.warn('Could not create thumbnail:', thumbError);
        // thumbnailBase64 remains original base64String in case of error
      }

      // Return a ProjectImage object
      return {
        id,
        project_id: projectId,
        name: file.name,
        url: base64String,
        thumbnail_url: thumbnailBase64,
        createdAt: now,
        updatedAt: now,
        width,
        height,
        segmentationStatus: 'pending',
        segmentationResultPath: null,
      };
    }),
  );

  console.log(`Created ${localImages.length} local images`);

  // Store the images in localStorage
  try {
    const { storeUploadedImages } = await import('./projectImages');
    storeUploadedImages(projectId, localImages);
  } catch (storageError) {
    console.error('Failed to store images in localStorage:', storageError);
  }

  return localImages;
}
