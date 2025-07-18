/**
 * Utility for loading images directly from the database
 */

import apiClient from '@/lib/apiClient';

/**
 * Attempts to load image data directly from the database
 * @param projectId Project ID
 * @param imageId Image ID
 * @returns Promise resolving to image data if found, null otherwise
 */
export const loadImageFromDatabase = async (projectId: string, imageId: string): Promise<any | null> => {
  console.log(`Attempting to load image from database: projectId=${projectId}, imageId=${imageId}`);

  // Try all possible endpoints in sequence
  const endpoints = [
    // 1. Direct image by ID
    {
      url: `/api/projects/${projectId}/images/${imageId}`,
      method: 'get',
      description: 'direct by ID',
    },
    // 2. All images, then filter
    {
      url: `/api/projects/${projectId}/images`,
      method: 'get',
      description: 'all images',
      process: (data: any[]) => {
        if (!Array.isArray(data)) return null;

        // Try to find by ID first
        let match = data.find((img) => img.id === imageId);

        // If not found by ID, try by name
        if (!match) {
          match = data.find((img) => img.name === imageId);
        }

        // If still not found, try by partial match on name or ID
        if (!match) {
          match = data.find((img) => (img.id && img.id.includes(imageId)) || (img.name && img.name.includes(imageId)));
        }

        return match;
      },
    },
    // 3. Query by name
    {
      url: `/api/projects/${projectId}/images?name=${encodeURIComponent(imageId)}`,
      method: 'get',
      description: 'by name',
      process: (data: any[]) => (Array.isArray(data) && data.length > 0 ? data[0] : null),
    },
    // 4. Alternative endpoint
    {
      url: `/api/images/${imageId}`,
      method: 'get',
      description: 'alternative endpoint',
    },
    // 5. Another alternative endpoint
    {
      url: `/api/projects/images/${imageId}`,
      method: 'get',
      description: 'another alternative',
    },
  ];

  // Try each endpoint in sequence
  for (const endpoint of endpoints) {
    try {
      console.log(`Trying to fetch image via ${endpoint.description}: ${endpoint.url}`);

      // Add cache-busting query parameter
      const url = `${endpoint.url}${endpoint.url.includes('?') ? '&' : '?'}_=${Date.now()}`;

      const response = await apiClient[endpoint.method](url, {
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      });

      let imageData = response.data;

      // If we need to process the data (e.g., filter from a list)
      if (endpoint.process && typeof endpoint.process === 'function') {
        imageData = endpoint.process(response.data);
        if (!imageData) {
          console.log(`No matching image found in ${endpoint.description} response`);
          continue; // Try next endpoint if no match found
        }
      }

      console.log(`Successfully fetched image via ${endpoint.description}:`, imageData.id);

      // Ensure we have width and height
      if (!imageData.width || !imageData.height) {
        console.log(`Image data missing dimensions, using defaults`);
        imageData.width = imageData.width || 800;
        imageData.height = imageData.height || 600;
      }

      // Ensure we have a src property
      if (!imageData.src && imageData.storage_path) {
        imageData.src = imageData.storage_path;
      }

      return imageData;
    } catch (error) {
      console.error(`Error fetching image via ${endpoint.description}:`, error);
      // Continue to next endpoint
    }
  }

  console.log(`Could not find image in database`);
  return null;
};

/**
 * Attempts to load all images for a project from the database
 * @param projectId Project ID
 * @returns Promise resolving to array of image data
 */
export const loadAllImagesFromDatabase = async (projectId: string): Promise<any[]> => {
  console.log(`Attempting to load all images for project: ${projectId}`);

  try {
    // Add cache-busting query parameter
    const url = `/projects/${projectId}/images?_=${Date.now()}`;

    const response = await apiClient.get(url, {
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });

    if (Array.isArray(response.data)) {
      console.log(`Successfully loaded ${response.data.length} images for project ${projectId}`);
      return response.data;
    }

    console.log(`No images found for project ${projectId}`);
    return [];
  } catch (error) {
    console.error(`Error loading images for project ${projectId}:`, error);
    return [];
  }
};
