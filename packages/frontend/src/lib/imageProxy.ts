/**
 * Image proxy utility to handle various image path formats in Docker environment
 */

import { constructUrl } from './urlUtils';
import { API_BASE_URL } from '@/config';

/**
 * Creates a proxy URL for images that handles Docker networking
 * @param path Original image path
 * @returns Proxied image URL
 */
export const getProxiedImageUrl = (path: string | null | undefined): string => {
  if (!path) return '/placeholder.png';

  // Log the original path for debugging
  console.log(`[imageProxy] Original path: ${path}`);

  // Handle absolute URLs
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  // Normalize the path using constructUrl
  const normalizedPath = constructUrl(path);
  console.log(`[imageProxy] Normalized path: ${normalizedPath}`);

  // Ensure the path starts with /uploads/ for backend images
  if (normalizedPath.includes('/uploads/') || normalizedPath.startsWith('/uploads/')) {
    // Use API_BASE_URL to ensure we're using the correct backend URL
    const proxyUrl = `${API_BASE_URL}${normalizedPath}`;
    console.log(`[imageProxy] Proxied URL: ${proxyUrl}`);
    return proxyUrl;
  }

  // For other paths, return as is
  return normalizedPath;
};

/**
 * Creates a thumbnail URL for images
 * @param path Original image path
 * @returns Thumbnail URL
 */
export const getThumbnailUrl = (path: string | null | undefined): string => {
  const proxiedUrl = getProxiedImageUrl(path);
  console.log(`[imageProxy] Thumbnail URL: ${proxiedUrl}`);
  return proxiedUrl;
};
