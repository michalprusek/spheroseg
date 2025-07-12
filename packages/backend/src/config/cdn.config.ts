import { config } from './index';

export interface CDNConfig {
  enabled: boolean;
  provider: 'cloudfront' | 'cloudflare' | 'fastly' | 'custom' | 'none';
  baseUrl: string;
  assetPrefix: string;
  imagePrefix: string;
  
  // Cache control
  cacheControl: {
    images: string;
    css: string;
    js: string;
    fonts: string;
    default: string;
  };
  
  // Security
  signedUrls: boolean;
  signedUrlExpiry: number; // seconds
  secretKey?: string;
  
  // CloudFront specific
  cloudfront?: {
    distributionId: string;
    keypairId: string;
    privateKey?: string;
  };
  
  // Cloudflare specific
  cloudflare?: {
    zoneId: string;
    apiToken: string;
    accountId: string;
  };
  
  // Custom headers
  customHeaders: Record<string, string>;
  
  // Invalidation
  invalidation: {
    enabled: boolean;
    patterns: string[];
    maxRetries: number;
  };
}

// Default CDN configuration
export const cdnConfig: CDNConfig = {
  enabled: process.env.CDN_ENABLED === 'true',
  provider: (process.env.CDN_PROVIDER as CDNConfig['provider']) || 'none',
  baseUrl: process.env.CDN_BASE_URL || '',
  assetPrefix: process.env.CDN_ASSET_PREFIX || '/assets',
  imagePrefix: process.env.CDN_IMAGE_PREFIX || '/uploads',
  
  cacheControl: {
    images: process.env.CDN_CACHE_IMAGES || 'public, max-age=31536000, immutable',
    css: process.env.CDN_CACHE_CSS || 'public, max-age=31536000, immutable',
    js: process.env.CDN_CACHE_JS || 'public, max-age=31536000, immutable',
    fonts: process.env.CDN_CACHE_FONTS || 'public, max-age=31536000, immutable',
    default: process.env.CDN_CACHE_DEFAULT || 'public, max-age=3600',
  },
  
  signedUrls: process.env.CDN_SIGNED_URLS === 'true',
  signedUrlExpiry: parseInt(process.env.CDN_SIGNED_URL_EXPIRY || '3600', 10),
  secretKey: process.env.CDN_SECRET_KEY,
  
  cloudfront: process.env.CDN_PROVIDER === 'cloudfront' ? {
    distributionId: process.env.CDN_CF_DISTRIBUTION_ID || '',
    keypairId: process.env.CDN_CF_KEYPAIR_ID || '',
    privateKey: process.env.CDN_CF_PRIVATE_KEY,
  } : undefined,
  
  cloudflare: process.env.CDN_PROVIDER === 'cloudflare' ? {
    zoneId: process.env.CDN_CLOUDFLARE_ZONE_ID || '',
    apiToken: process.env.CDN_CLOUDFLARE_API_TOKEN || '',
    accountId: process.env.CDN_CLOUDFLARE_ACCOUNT_ID || '',
  } : undefined,
  
  customHeaders: {
    'X-CDN-Provider': process.env.CDN_PROVIDER || 'none',
    'X-Content-Type-Options': 'nosniff',
  },
  
  invalidation: {
    enabled: process.env.CDN_INVALIDATION_ENABLED === 'true',
    patterns: (process.env.CDN_INVALIDATION_PATTERNS || '').split(',').filter(Boolean),
    maxRetries: parseInt(process.env.CDN_INVALIDATION_MAX_RETRIES || '3', 10),
  },
};

// Helper to determine if CDN should be used
export function shouldUseCDN(): boolean {
  return cdnConfig.enabled && 
         cdnConfig.provider !== 'none' && 
         !!cdnConfig.baseUrl &&
         config.env === 'production';
}

// Get CDN URL for an asset
export function getCDNUrl(path: string): string {
  if (!shouldUseCDN()) {
    return path;
  }
  
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // Determine prefix based on path
  let prefix = '';
  if (cleanPath.startsWith('assets/')) {
    prefix = cdnConfig.assetPrefix;
  } else if (cleanPath.startsWith('uploads/')) {
    prefix = cdnConfig.imagePrefix;
  }
  
  // Build CDN URL
  const baseUrl = cdnConfig.baseUrl.endsWith('/') 
    ? cdnConfig.baseUrl.slice(0, -1) 
    : cdnConfig.baseUrl;
    
  return `${baseUrl}${prefix}/${cleanPath}`;
}

// Get cache control header for file type
export function getCacheControl(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  
  switch (ext) {
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
    case 'svg':
    case 'ico':
      return cdnConfig.cacheControl.images;
    case 'css':
      return cdnConfig.cacheControl.css;
    case 'js':
    case 'mjs':
      return cdnConfig.cacheControl.js;
    case 'woff':
    case 'woff2':
    case 'ttf':
    case 'eot':
    case 'otf':
      return cdnConfig.cacheControl.fonts;
    default:
      return cdnConfig.cacheControl.default;
  }
}

export default cdnConfig;