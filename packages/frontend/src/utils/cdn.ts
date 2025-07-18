
export interface CDNConfig {
  enabled: boolean;
  baseUrl: string;
  provider: 'cloudfront' | 'cloudflare' | 'fastly' | 'custom' | 'none';
  imageOptimization: boolean;
  lazyLoading: boolean;
}

export interface ImageTransform {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png' | 'auto';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

// CDN configuration from environment
const cdnConfig: CDNConfig = {
  enabled: import.meta.env.VITE_CDN_ENABLED === 'true',
  baseUrl: import.meta.env.VITE_CDN_BASE_URL || '',
  provider: (import.meta.env.VITE_CDN_PROVIDER as CDNConfig['provider']) || 'none',
  imageOptimization: import.meta.env.VITE_CDN_IMAGE_OPTIMIZATION !== 'false',
  lazyLoading: import.meta.env.VITE_CDN_LAZY_LOADING !== 'false',
};

/**
 * Check if CDN is enabled
 */
export function isCDNEnabled(): boolean {
  return cdnConfig.enabled && cdnConfig.baseUrl !== '' && cdnConfig.provider !== 'none';
}

/**
 * Get CDN URL for an asset
 */
export function getCDNUrl(path: string, transform?: ImageTransform): string {
  if (!path) return '';

  // If CDN is not enabled, return the original path
  if (!isCDNEnabled()) {
    return path;
  }

  // If already a full URL, check if it's from our domain
  if (path.startsWith('http://') || path.startsWith('https://')) {
    const url = new URL(path);
    if (!url.hostname.includes(window.location.hostname)) {
      return path; // External URL, don't modify
    }
    // Extract path from full URL
    path = url.pathname;
  }

  // Ensure path starts with /
  if (!path.startsWith('/')) {
    path = '/' + path;
  }

  // Build CDN URL
  let cdnUrl = cdnConfig.baseUrl;
  if (!cdnUrl.endsWith('/')) {
    cdnUrl += '/';
  }
  cdnUrl += path.startsWith('/') ? path.slice(1) : path;

  // Apply transformations if provided
  if (transform && cdnConfig.imageOptimization && isImagePath(path)) {
    cdnUrl = applyImageTransform(cdnUrl, transform);
  }

  return cdnUrl;
}

/**
 * Get optimized image URL with transformations
 */
export function getOptimizedImageUrl(
  path: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'jpeg' | 'png' | 'auto';
    devicePixelRatio?: number;
  } = {},
): string {
  if (!cdnConfig.imageOptimization) {
    return getCDNUrl(path);
  }

  // Apply device pixel ratio
  const dpr = options.devicePixelRatio || window.devicePixelRatio || 1;
  const transform: ImageTransform = {
    width: options.width ? Math.round(options.width * dpr) : undefined,
    height: options.height ? Math.round(options.height * dpr) : undefined,
    quality: options.quality || getQualityForDPR(dpr),
    format: options.format || 'auto',
  };

  return getCDNUrl(path, transform);
}

/**
 * Preload critical images
 */
export function preloadImage(
  url: string,
  options?: {
    as?: 'image';
    type?: string;
    media?: string;
  },
): void {
  if (!url) return;

  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = options?.as || 'image';
  link.href = getCDNUrl(url);

  if (options?.type) {
    link.type = options.type;
  }

  if (options?.media) {
    link.media = options.media;
  }

  document.head.appendChild(link);
}

/**
 * Get srcset for responsive images
 */
export function getImageSrcSet(
  path: string,
  sizes: number[],
  options: {
    quality?: number;
    format?: 'webp' | 'jpeg' | 'png' | 'auto';
  } = {},
): string {
  if (!cdnConfig.imageOptimization) {
    return getCDNUrl(path);
  }

  const srcset = sizes
    .map((size) => {
      const url = getOptimizedImageUrl(path, {
        width: size,
        quality: options.quality,
        format: options.format,
      });
      return `${url} ${size}w`;
    })
    .join(', ');

  return srcset;
}

/**
 * Get CDN URL for static assets (CSS, JS, fonts)
 */
export function getAssetUrl(path: string): string {
  if (!path) return '';

  // Handle different asset types
  if (path.startsWith('/assets/')) {
    return getCDNUrl(path);
  }

  // Handle Vite asset imports
  if (path.includes('/src/assets/')) {
    // This will be handled by Vite's build process
    return path;
  }

  return getCDNUrl(path);
}

/**
 * Prefetch resources for faster navigation
 */
export function prefetchResources(urls: string[]): void {
  if (!isCDNEnabled() || !('link' in document.createElement('link'))) {
    return;
  }

  urls.forEach((url) => {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = getCDNUrl(url);
    document.head.appendChild(link);
  });
}

/**
 * Clear CDN cache for specific paths (admin only)
 */
export async function purgeCDNCache(
  paths?: string[],
  options: {
    patterns?: string[];
    purgeAll?: boolean;
  } = {},
): Promise<boolean> {
  try {
    const response = await fetch('/api/cdn/purge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
      },
      body: JSON.stringify({
        paths,
        patterns: options.patterns,
        purgeAll: options.purgeAll,
      }),
    });

    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('Failed to purge CDN cache:', error);
    return false;
  }
}

// Helper functions

function isImagePath(path: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff'];
  const lowerPath = path.toLowerCase();
  return imageExtensions.some((ext) => lowerPath.includes(ext));
}

function applyImageTransform(url: string, transform: ImageTransform): string {
  switch (cdnConfig.provider) {
    case 'cloudfront':
      return applyCloudFrontTransform(url, transform);
    case 'cloudflare':
      return applyCloudflareTransform(url, transform);
    case 'fastly':
      return applyFastlyTransform(url, transform);
    default:
      return url;
  }
}

function applyCloudFrontTransform(url: string, transform: ImageTransform): string {
  const params: string[] = [];

  if (transform.width) params.push(`w=${transform.width}`);
  if (transform.height) params.push(`h=${transform.height}`);
  if (transform.quality) params.push(`q=${transform.quality}`);
  if (transform.format && transform.format !== 'auto') {
    params.push(`f=${transform.format}`);
  }
  if (transform.fit) params.push(`fit=${transform.fit}`);

  if (params.length > 0) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${params.join('&')}`;
  }

  return url;
}

function applyCloudflareTransform(url: string, transform: ImageTransform): string {
  const options: string[] = [];

  if (transform.width) options.push(`width=${transform.width}`);
  if (transform.height) options.push(`height=${transform.height}`);
  if (transform.quality) options.push(`quality=${transform.quality}`);
  if (transform.format === 'auto') {
    options.push('format=auto');
  } else if (transform.format) {
    options.push(`format=${transform.format}`);
  }
  if (transform.fit) options.push(`fit=${transform.fit}`);

  if (options.length > 0) {
    // Cloudflare Image Resizing format
    const baseUrl = new URL(url);
    const imagePath = baseUrl.pathname;
    baseUrl.pathname = `/cdn-cgi/image/${options.join(',')}${imagePath}`;
    return baseUrl.toString();
  }

  return url;
}

function applyFastlyTransform(url: string, transform: ImageTransform): string {
  const params: string[] = [];

  if (transform.width) params.push(`width=${transform.width}`);
  if (transform.height) params.push(`height=${transform.height}`);
  if (transform.quality) params.push(`quality=${transform.quality}`);
  if (transform.format) params.push(`format=${transform.format}`);
  if (transform.fit) params.push(`fit=${transform.fit}`);

  if (params.length > 0) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${params.join('&')}`;
  }

  return url;
}

function getQualityForDPR(dpr: number): number {
  // Adjust quality based on device pixel ratio
  if (dpr >= 3) return 60; // Very high DPR, lower quality
  if (dpr >= 2) return 75; // High DPR, medium quality
  return 85; // Standard DPR, high quality
}

// Export configuration for other components
export { cdnConfig };
