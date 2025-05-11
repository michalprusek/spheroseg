/**
 * Utility for accessing the file system directly using the File System Access API
 * This is a last resort when normal API methods fail
 */

import { toast } from 'sonner';

/**
 * Check if the File System Access API is available
 * @returns True if the API is available, false otherwise
 */
export const isFileSystemAccessAvailable = (): boolean => {
  return 'showOpenFilePicker' in window;
};

/**
 * Open a file picker dialog to select an image file
 * @returns Promise resolving to the selected file or null if canceled
 */
export const pickImageFile = async (): Promise<File | null> => {
  if (!isFileSystemAccessAvailable()) {
    console.log('File System Access API not available');
    return null;
  }

  try {
    const [fileHandle] = await window.showOpenFilePicker({
      types: [
        {
          description: 'Images',
          accept: {
            'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
          },
        },
      ],
      multiple: false,
    });

    return await fileHandle.getFile();
  } catch (error) {
    console.error('Error picking file:', error);
    return null;
  }
};

/**
 * Create an object URL from a file
 * @param file The file to create an object URL for
 * @returns The object URL
 */
export const createObjectURL = (file: File): string => {
  return URL.createObjectURL(file);
};

/**
 * Load an image file and get its dimensions
 * @param file The image file to load
 * @returns Promise resolving to the image dimensions and object URL
 */
export const loadImageFile = async (file: File): Promise<{ width: number; height: number; url: string } | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    const url = createObjectURL(file);

    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        url,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    img.src = url;
  });
};

/**
 * Pick an image file and load it
 * @returns Promise resolving to the image dimensions and object URL
 */
export const pickAndLoadImage = async (): Promise<{
  width: number;
  height: number;
  url: string;
  name: string;
} | null> => {
  const file = await pickImageFile();

  if (!file) {
    return null;
  }

  const result = await loadImageFile(file);

  if (!result) {
    toast.error('Failed to load the selected image');
    return null;
  }

  return {
    ...result,
    name: file.name,
  };
};

/**
 * Revoke an object URL to free up memory
 * @param url The object URL to revoke
 */
export const revokeObjectURL = (url: string): void => {
  URL.revokeObjectURL(url);
};
