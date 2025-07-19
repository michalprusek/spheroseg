import crypto from 'crypto';
import fetch from 'node-fetch';
import fs from 'fs';
import logger from '../utils/logger';
import { cdnConfig, getCDNUrl, getCacheControl } from '../config/cdn.config';

// Optional AWS SDK import for CloudFront features
let AWS: any;
async function loadAWS() {
  try {
    AWS = await import('aws-sdk');
  } catch (error) {
    logger.warn('AWS SDK not installed, CloudFront features will be disabled');
  }
}
// Load AWS SDK on startup
loadAWS();

export interface CDNService {
  getUrl(path: string, options?: UrlOptions): string;
  getSignedUrl(path: string, expiresIn?: number): Promise<string>;
  invalidate(paths: string[]): Promise<boolean>;
  uploadFile(localPath: string, cdnPath: string): Promise<string>;
  deleteFile(cdnPath: string): Promise<boolean>;
  purgeCache(patterns?: string[]): Promise<boolean>;
}

export interface UrlOptions {
  transform?: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'jpeg' | 'png';
  };
  signed?: boolean;
  expiresIn?: number;
}

// Base CDN Service
abstract class BaseCDNService implements CDNService {
  abstract getUrl(path: string, options?: UrlOptions): string;
  abstract getSignedUrl(path: string, expiresIn?: number): Promise<string>;
  abstract invalidate(paths: string[]): Promise<boolean>;
  abstract uploadFile(localPath: string, cdnPath: string): Promise<string>;
  abstract deleteFile(cdnPath: string): Promise<boolean>;
  abstract purgeCache(patterns?: string[]): Promise<boolean>;

  protected buildTransformParams(transform?: UrlOptions['transform']): string {
    if (!transform) return '';

    const params: string[] = [];
    if (transform.width) params.push(`w=${transform.width}`);
    if (transform.height) params.push(`h=${transform.height}`);
    if (transform.quality) params.push(`q=${transform.quality}`);
    if (transform.format) params.push(`f=${transform.format}`);

    return params.length > 0 ? `?${params.join('&')}` : '';
  }
}

// CloudFront CDN Service
class CloudFrontService extends BaseCDNService {
  private cloudfront: any;
  private s3: any;

  constructor() {
    super();
    if (AWS) {
      this.cloudfront = new AWS.CloudFront({
        region: process.env["AWS_REGION"] || 'us-east-1',
      });
      this.s3 = new AWS.S3({
        region: process.env["AWS_REGION"] || 'us-east-1',
      });
    }
  }

  getUrl(path: string, options?: UrlOptions): string {
    const cdnUrl = getCDNUrl(path);

    if (options?.transform) {
      // CloudFront uses Lambda@Edge for transformations
      const transformParams = this.buildTransformParams(options.transform);
      return `${cdnUrl}${transformParams}`;
    }

    return cdnUrl;
  }

  async getSignedUrl(path: string, expiresIn?: number): Promise<string> {
    if (!cdnConfig.cloudfront) {
      throw new Error('CloudFront configuration missing');
    }

    if (!AWS) {
      throw new Error('AWS SDK not installed, CloudFront signed URLs are not available');
    }

    const url = getCDNUrl(path);
    const expires = Math.floor(Date.now() / 1000) + (expiresIn || cdnConfig.signedUrlExpiry);

    const signer = new AWS.CloudFront.Signer(
      cdnConfig.cloudfront.keypairId,
      cdnConfig.cloudfront.privateKey || ''
    );

    return new Promise((resolve, reject) => {
      signer.getSignedUrl(
        {
          url,
          expires,
        },
        (err, signedUrl) => {
          if (err) {
            logger.error('CloudFront signed URL error:', err);
            reject(err);
          } else {
            resolve(signedUrl);
          }
        }
      );
    });
  }

  async invalidate(paths: string[]): Promise<boolean> {
    if (!cdnConfig.cloudfront) {
      throw new Error('CloudFront configuration missing');
    }

    if (!AWS) {
      throw new Error('AWS SDK not installed, CloudFront invalidation is not available');
    }

    try {
      const params: any = {
        DistributionId: cdnConfig.cloudfront.distributionId,
        InvalidationBatch: {
          CallerReference: `spheroseg-${Date.now()}`,
          Paths: {
            Quantity: paths.length,
            Items: paths.map((p) => (p.startsWith('/') ? p : `/${p}`)),
          },
        },
      };

      const result = await this.cloudfront.createInvalidation(params).promise();
      logger.info('CloudFront invalidation created:', result.Invalidation?.Id);
      return true;
    } catch (error) {
      logger.error('CloudFront invalidation error:', error);
      return false;
    }
  }

  async uploadFile(localPath: string, cdnPath: string): Promise<string> {
    if (!AWS) {
      throw new Error('AWS SDK not installed, S3 upload is not available');
    }

    // Upload to S3 bucket that CloudFront uses as origin
    const bucketName = process.env["CDN_S3_BUCKET"];
    if (!bucketName) {
      throw new Error('CDN S3 bucket not configured');
    }

    const fileContent = fs.readFileSync(localPath);
    const contentType = this.getContentType(cdnPath);

    const params: any = {
      Bucket: bucketName,
      Key: cdnPath,
      Body: fileContent,
      ContentType: contentType,
      CacheControl: getCacheControl(cdnPath),
      ServerSideEncryption: 'AES256',
    };

    await this.s3.putObject(params).promise();

    // Invalidate the path
    await this.invalidate([cdnPath]);

    return getCDNUrl(cdnPath);
  }

  async deleteFile(cdnPath: string): Promise<boolean> {
    const bucketName = process.env["CDN_S3_BUCKET"];
    if (!bucketName) {
      throw new Error('CDN S3 bucket not configured');
    }

    try {
      await this.s3
        .deleteObject({
          Bucket: bucketName,
          Key: cdnPath,
        })
        .promise();

      // Invalidate the path
      await this.invalidate([cdnPath]);

      return true;
    } catch (error) {
      logger.error('S3 delete error:', error);
      return false;
    }
  }

  async purgeCache(patterns?: string[]): Promise<boolean> {
    const pathsToInvalidate = patterns || ['/*'];
    return this.invalidate(pathsToInvalidate);
  }

  private getContentType(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      css: 'text/css',
      js: 'application/javascript',
      json: 'application/json',
      woff: 'font/woff',
      woff2: 'font/woff2',
      ttf: 'font/ttf',
      eot: 'application/vnd.ms-fontobject',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }
}

// Cloudflare CDN Service
class CloudflareService extends BaseCDNService {
  private apiBase = 'https://api.cloudflare.com/client/v4';

  getUrl(path: string, options?: UrlOptions): string {
    const cdnUrl = getCDNUrl(path);

    if (options?.transform) {
      // Cloudflare uses URL parameters for image transformations
      const transform = options.transform;
      const variants: string[] = [];

      if (transform.width) variants.push(`width=${transform.width}`);
      if (transform.height) variants.push(`height=${transform.height}`);
      if (transform.quality) variants.push(`quality=${transform.quality}`);
      if (transform.format) variants.push(`format=${transform.format}`);

      if (variants.length > 0) {
        return `${cdnUrl}/cdn-cgi/image/${variants.join(',')}/${path}`;
      }
    }

    return cdnUrl;
  }

  async getSignedUrl(path: string, expiresIn?: number): Promise<string> {
    // Cloudflare uses URL signing with HMAC
    const url = getCDNUrl(path);
    const expires = Math.floor(Date.now() / 1000) + (expiresIn || cdnConfig.signedUrlExpiry);

    if (!cdnConfig.secretKey) {
      throw new Error('CDN secret key not configured');
    }

    const auth = crypto
      .createHmac('sha256', cdnConfig.secretKey)
      .update(`${url}${expires}`)
      .digest('hex');

    return `${url}?expires=${expires}&signature=${auth}`;
  }

  async invalidate(paths: string[]): Promise<boolean> {
    if (!cdnConfig.cloudflare) {
      throw new Error('Cloudflare configuration missing');
    }

    try {
      const response = await fetch(
        `${this.apiBase}/zones/${cdnConfig.cloudflare.zoneId}/purge_cache`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cdnConfig.cloudflare.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            files: paths.map((p) => `${cdnConfig.baseUrl}${p}`),
          }),
        }
      );

      const result = await response.json();

      if (!result.success) {
        logger.error('Cloudflare purge error:', result.errors);
        return false;
      }

      logger.info('Cloudflare cache purged successfully');
      return true;
    } catch (error) {
      logger.error('Cloudflare API error:', error);
      return false;
    }
  }

  async uploadFile(localPath: string, cdnPath: string): Promise<string> {
    // Cloudflare typically uses origin pull, so files should be uploaded to origin server
    // This is a placeholder - actual implementation depends on setup
    logger.warn('Cloudflare uploadFile not implemented - files should be on origin server');
    return getCDNUrl(cdnPath);
  }

  async deleteFile(_cdnPath: string): Promise<boolean> {
    // Files should be deleted from origin server
    logger.warn('Cloudflare deleteFile not implemented - delete from origin server');
    return true;
  }

  async purgeCache(patterns?: string[]): Promise<boolean> {
    if (!cdnConfig.cloudflare) {
      throw new Error('Cloudflare configuration missing');
    }

    try {
      const body = patterns
        ? { files: patterns.map((p) => `${cdnConfig.baseUrl}${p}`) }
        : { purge_everything: true };

      const response = await fetch(
        `${this.apiBase}/zones/${cdnConfig.cloudflare.zoneId}/purge_cache`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cdnConfig.cloudflare.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      const result = await response.json();
      return result.success;
    } catch (error) {
      logger.error('Cloudflare purge error:', error);
      return false;
    }
  }
}

// No-op CDN Service (for development/testing)
class NoOpCDNService extends BaseCDNService {
  getUrl(path: string, _options?: UrlOptions): string {
    return path;
  }

  async getSignedUrl(path: string, _expiresIn?: number): Promise<string> {
    return path;
  }

  async invalidate(paths: string[]): Promise<boolean> {
    logger.debug('No-op CDN invalidate:', paths);
    return true;
  }

  async uploadFile(localPath: string, cdnPath: string): Promise<string> {
    logger.debug('No-op CDN upload:', { localPath, cdnPath });
    return cdnPath;
  }

  async deleteFile(cdnPath: string): Promise<boolean> {
    logger.debug('No-op CDN delete:', cdnPath);
    return true;
  }

  async purgeCache(patterns?: string[]): Promise<boolean> {
    logger.debug('No-op CDN purge:', patterns);
    return true;
  }
}

// Factory to create CDN service based on provider
export function createCDNService(): CDNService {
  switch (cdnConfig.provider) {
    case 'cloudfront':
      return new CloudFrontService();
    case 'cloudflare':
      return new CloudflareService();
    case 'fastly':
      // Fastly implementation would go here
      throw new Error('Fastly CDN not implemented yet');
    case 'custom':
      // Custom CDN implementation would go here
      throw new Error('Custom CDN not implemented yet');
    default:
      return new NoOpCDNService();
  }
}

// Singleton instance
let cdnService: CDNService;

export function getCDNService(): CDNService {
  if (!cdnService) {
    cdnService = createCDNService();
  }
  return cdnService;
}

// Export types and utilities
export { getCDNUrl, getCacheControl } from '../config/cdn.config';
