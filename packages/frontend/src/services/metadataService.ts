import { z } from 'zod';
import exifr from 'exifr';
import { getConfigValue } from '@/config';

/**
 * Unified Metadata Service
 * Comprehensive metadata management for all data types
 */

// Base metadata interface
export interface BaseMetadata {
  id?: string;
  type: string;
  version: string;
  created: Date;
  modified: Date;
  createdBy?: string;
  modifiedBy?: string;
  tags?: string[];
  keywords?: string[];
  description?: string;
  custom?: Record<string, any>;
}

// Image metadata with EXIF/IPTC/XMP support
export interface ImageMetadata extends BaseMetadata {
  type: 'image';
  width: number;
  height: number;
  format: string;
  colorSpace?: string;
  bitDepth?: number;
  fileSize: number;
  
  // EXIF data
  exif?: {
    make?: string;
    model?: string;
    dateTime?: Date;
    exposureTime?: number;
    fNumber?: number;
    iso?: number;
    focalLength?: number;
    flash?: boolean;
    orientation?: number;
    gps?: {
      latitude: number;
      longitude: number;
      altitude?: number;
    };
  };
  
  // IPTC data
  iptc?: {
    headline?: string;
    caption?: string;
    credit?: string;
    copyright?: string;
    category?: string;
    keywords?: string[];
    city?: string;
    country?: string;
  };
  
  // XMP data
  xmp?: {
    creator?: string;
    rights?: string;
    subject?: string[];
    rating?: number;
  };
  
  // Scientific metadata
  scientific?: {
    magnification?: number;
    pixelSize?: number;
    pixelUnit?: string;
    channel?: string;
    zStack?: number;
    timePoint?: number;
    modality?: string;
    staining?: string;
  };
}

// Document metadata
export interface DocumentMetadata extends BaseMetadata {
  type: 'document';
  title: string;
  author?: string;
  subject?: string;
  language?: string;
  pageCount?: number;
  wordCount?: number;
  readingTime?: number;
  fileSize: number;
  format: string;
}

// Project metadata
export interface ProjectMetadata extends BaseMetadata {
  type: 'project';
  title: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  visibility: 'private' | 'public' | 'shared';
  collaborators?: string[];
  startDate?: Date;
  endDate?: Date;
  completionPercentage?: number;
  settings?: Record<string, any>;
}

// Cell/Segmentation metadata
export interface SegmentationMetadata extends BaseMetadata {
  type: 'segmentation';
  imageId: string;
  algorithm: string;
  parameters: Record<string, any>;
  
  // Metrics
  metrics: {
    area: number;
    perimeter: number;
    circularity: number;
    sphericity: number;
    solidity: number;
    compactness: number;
    convexity: number;
    eccentricity?: number;
    majorAxis?: number;
    minorAxis?: number;
    orientation?: number;
    centroid: [number, number];
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
  
  // Classification
  classification?: {
    type?: string;
    confidence?: number;
    features?: Record<string, number>;
  };
}

// SEO metadata
export interface SEOMetadata {
  title: string;
  description: string;
  keywords?: string[];
  canonical?: string;
  robots?: string;
  
  // Open Graph
  og?: {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
    type?: string;
    siteName?: string;
  };
  
  // Twitter Card
  twitter?: {
    card?: 'summary' | 'summary_large_image' | 'app' | 'player';
    title?: string;
    description?: string;
    image?: string;
    creator?: string;
  };
  
  // Structured data (JSON-LD)
  jsonLd?: Record<string, any>;
}

// Metadata schemas for validation
const ImageMetadataSchema = z.object({
  type: z.literal('image'),
  version: z.string(),
  created: z.date(),
  modified: z.date(),
  width: z.number().positive(),
  height: z.number().positive(),
  format: z.string(),
  fileSize: z.number().positive(),
  exif: z.object({
    make: z.string().optional(),
    model: z.string().optional(),
    dateTime: z.date().optional(),
    // ... other EXIF fields
  }).optional(),
  // ... other fields
});

// Metadata extraction strategies
interface ExtractionStrategy<T> {
  extract(source: any): Promise<T>;
  validate(metadata: T): boolean;
}

class MetadataService {
  private cache = new Map<string, any>();
  private extractors = new Map<string, ExtractionStrategy<any>>();

  constructor() {
    this.registerDefaultExtractors();
  }

  /**
   * Register default metadata extractors
   */
  private registerDefaultExtractors() {
    // Image extractor
    this.registerExtractor('image', {
      extract: async (file: File | Blob): Promise<ImageMetadata> => {
        const basicMetadata = await this.extractBasicImageMetadata(file);
        const exifData = await this.extractEXIF(file);
        
        return {
          ...basicMetadata,
          exif: exifData,
        };
      },
      validate: (metadata: ImageMetadata) => {
        try {
          ImageMetadataSchema.parse(metadata);
          return true;
        } catch {
          return false;
        }
      },
    });
  }

  /**
   * Extract basic image metadata
   */
  private async extractBasicImageMetadata(file: File | Blob): Promise<Partial<ImageMetadata>> {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({
          type: 'image',
          version: '1.0',
          created: new Date(),
          modified: new Date(),
          width: img.width,
          height: img.height,
          format: file.type.split('/')[1] || 'unknown',
          fileSize: file.size,
        });
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({
          type: 'image',
          version: '1.0',
          created: new Date(),
          modified: new Date(),
          fileSize: file.size,
        } as any);
      };
      
      img.src = url;
    });
  }

  /**
   * Extract EXIF metadata
   */
  private async extractEXIF(file: File | Blob): Promise<ImageMetadata['exif']> {
    try {
      const exifData = await exifr.parse(file, {
        pick: [
          'Make', 'Model', 'DateTime', 'ExposureTime', 'FNumber',
          'ISO', 'FocalLength', 'Flash', 'Orientation',
          'GPSLatitude', 'GPSLongitude', 'GPSAltitude',
        ],
      });

      if (!exifData) return undefined;

      return {
        make: exifData.Make,
        model: exifData.Model,
        dateTime: exifData.DateTime ? new Date(exifData.DateTime) : undefined,
        exposureTime: exifData.ExposureTime,
        fNumber: exifData.FNumber,
        iso: exifData.ISO,
        focalLength: exifData.FocalLength,
        flash: Boolean(exifData.Flash),
        orientation: exifData.Orientation,
        gps: exifData.GPSLatitude && exifData.GPSLongitude ? {
          latitude: exifData.GPSLatitude,
          longitude: exifData.GPSLongitude,
          altitude: exifData.GPSAltitude,
        } : undefined,
      };
    } catch (error) {
      console.error('Failed to extract EXIF data:', error);
      return undefined;
    }
  }

  /**
   * Extract metadata from any source
   */
  async extract<T extends BaseMetadata>(
    source: any,
    type: string,
    options?: Record<string, any>
  ): Promise<T> {
    const cacheKey = this.getCacheKey(source, type);
    
    // Check cache
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Get extractor
    const extractor = this.extractors.get(type);
    if (!extractor) {
      throw new Error(`No extractor registered for type: ${type}`);
    }

    // Extract metadata
    const metadata = await extractor.extract(source);
    
    // Validate
    if (!extractor.validate(metadata)) {
      throw new Error('Invalid metadata extracted');
    }

    // Cache result
    this.cache.set(cacheKey, metadata);
    
    return metadata;
  }

  /**
   * Register custom extractor
   */
  registerExtractor<T extends BaseMetadata>(
    type: string,
    extractor: ExtractionStrategy<T>
  ): void {
    this.extractors.set(type, extractor);
  }

  /**
   * Update metadata
   */
  async update<T extends BaseMetadata>(
    id: string,
    updates: Partial<T>
  ): Promise<T> {
    // This would typically update in the backend
    const response = await fetch(`/api/metadata/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...updates,
        modified: new Date(),
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to update metadata');
    }

    const updated = await response.json();
    
    // Invalidate cache
    this.invalidateCache(id);
    
    return updated;
  }

  /**
   * Search metadata
   */
  async search(query: {
    type?: string;
    tags?: string[];
    keywords?: string[];
    dateRange?: { start: Date; end: Date };
    custom?: Record<string, any>;
  }): Promise<BaseMetadata[]> {
    const params = new URLSearchParams();
    
    if (query.type) params.append('type', query.type);
    if (query.tags) params.append('tags', query.tags.join(','));
    if (query.keywords) params.append('keywords', query.keywords.join(','));
    if (query.dateRange) {
      params.append('startDate', query.dateRange.start.toISOString());
      params.append('endDate', query.dateRange.end.toISOString());
    }
    if (query.custom) {
      params.append('custom', JSON.stringify(query.custom));
    }

    const response = await fetch(`/api/metadata/search?${params}`);
    
    if (!response.ok) {
      throw new Error('Failed to search metadata');
    }

    return response.json();
  }

  /**
   * Batch update metadata
   */
  async batchUpdate(
    items: Array<{ id: string; updates: Partial<BaseMetadata> }>
  ): Promise<void> {
    const response = await fetch('/api/metadata/batch', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(items),
    });

    if (!response.ok) {
      throw new Error('Failed to batch update metadata');
    }

    // Invalidate cache for all items
    items.forEach(item => this.invalidateCache(item.id));
  }

  /**
   * Export metadata
   */
  export(metadata: BaseMetadata[], format: 'json' | 'csv' | 'xml' = 'json'): string {
    switch (format) {
      case 'csv':
        return this.exportCSV(metadata);
      case 'xml':
        return this.exportXML(metadata);
      case 'json':
      default:
        return JSON.stringify(metadata, null, 2);
    }
  }

  /**
   * Import metadata
   */
  async import(data: string, format: 'json' | 'csv' | 'xml' = 'json'): Promise<BaseMetadata[]> {
    let metadata: BaseMetadata[];
    
    switch (format) {
      case 'csv':
        metadata = this.importCSV(data);
        break;
      case 'xml':
        metadata = this.importXML(data);
        break;
      case 'json':
      default:
        metadata = JSON.parse(data);
    }

    // Validate all items
    // ... validation logic

    return metadata;
  }

  /**
   * Generate SEO metadata
   */
  generateSEOMetadata(data: {
    title: string;
    description: string;
    image?: string;
    url?: string;
    type?: string;
  }): SEOMetadata {
    const baseUrl = getConfigValue<string>('app.baseUrl') || '';
    
    return {
      title: data.title,
      description: data.description,
      canonical: data.url ? `${baseUrl}${data.url}` : undefined,
      
      og: {
        title: data.title,
        description: data.description,
        image: data.image,
        url: data.url ? `${baseUrl}${data.url}` : undefined,
        type: data.type || 'website',
        siteName: getConfigValue<string>('app.name'),
      },
      
      twitter: {
        card: data.image ? 'summary_large_image' : 'summary',
        title: data.title,
        description: data.description,
        image: data.image,
      },
      
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': data.type === 'article' ? 'Article' : 'WebPage',
        headline: data.title,
        description: data.description,
        image: data.image,
        url: data.url ? `${baseUrl}${data.url}` : undefined,
      },
    };
  }

  /**
   * Enrich metadata with AI
   */
  async enrichWithAI(metadata: BaseMetadata): Promise<BaseMetadata> {
    // This would call an AI service to enrich metadata
    // For example: auto-tagging, keyword extraction, description generation
    
    const response = await fetch('/api/metadata/enrich', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });

    if (!response.ok) {
      throw new Error('Failed to enrich metadata');
    }

    return response.json();
  }

  /**
   * Calculate metadata quality score
   */
  calculateQualityScore(metadata: BaseMetadata): number {
    let score = 0;
    const weights = {
      description: 20,
      tags: 15,
      keywords: 15,
      custom: 10,
    };

    // Basic fields
    if (metadata.description && metadata.description.length > 50) score += weights.description;
    if (metadata.tags && metadata.tags.length >= 3) score += weights.tags;
    if (metadata.keywords && metadata.keywords.length >= 5) score += weights.keywords;
    if (metadata.custom && Object.keys(metadata.custom).length > 0) score += weights.custom;

    // Type-specific scoring
    if (metadata.type === 'image') {
      const imageMetadata = metadata as ImageMetadata;
      if (imageMetadata.exif) score += 10;
      if (imageMetadata.iptc) score += 10;
      if (imageMetadata.scientific) score += 20;
    }

    return Math.min(score, 100);
  }

  /**
   * Get metadata statistics
   */
  async getStatistics(filter?: {
    type?: string;
    dateRange?: { start: Date; end: Date };
  }): Promise<{
    total: number;
    byType: Record<string, number>;
    averageQualityScore: number;
    missingFields: Record<string, number>;
  }> {
    const params = new URLSearchParams();
    
    if (filter?.type) params.append('type', filter.type);
    if (filter?.dateRange) {
      params.append('startDate', filter.dateRange.start.toISOString());
      params.append('endDate', filter.dateRange.end.toISOString());
    }

    const response = await fetch(`/api/metadata/statistics?${params}`);
    
    if (!response.ok) {
      throw new Error('Failed to get metadata statistics');
    }

    return response.json();
  }

  /**
   * Cache key generation
   */
  private getCacheKey(source: any, type: string): string {
    if (source instanceof File) {
      return `${type}-${source.name}-${source.size}-${source.lastModified}`;
    }
    if (typeof source === 'string') {
      return `${type}-${source}`;
    }
    return `${type}-${JSON.stringify(source)}`;
  }

  /**
   * Invalidate cache
   */
  private invalidateCache(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Export to CSV
   */
  private exportCSV(metadata: BaseMetadata[]): string {
    if (metadata.length === 0) return '';

    // Get all unique keys
    const keys = new Set<string>();
    metadata.forEach(item => {
      Object.keys(item).forEach(key => keys.add(key));
    });

    // Create header
    const headers = Array.from(keys);
    const rows = [headers.join(',')];

    // Add data rows
    metadata.forEach(item => {
      const row = headers.map(key => {
        const value = (item as any)[key];
        if (value === undefined || value === null) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value).includes(',') ? `"${value}"` : value;
      });
      rows.push(row.join(','));
    });

    return rows.join('\n');
  }

  /**
   * Import from CSV
   */
  private importCSV(data: string): BaseMetadata[] {
    const lines = data.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',');
    const results: BaseMetadata[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const item: any = {};

      headers.forEach((header, index) => {
        let value = values[index];
        if (value?.startsWith('"') && value?.endsWith('"')) {
          value = value.slice(1, -1);
        }
        
        // Try to parse JSON values
        try {
          item[header] = JSON.parse(value);
        } catch {
          item[header] = value;
        }
      });

      results.push(item as BaseMetadata);
    }

    return results;
  }

  /**
   * Export to XML
   */
  private exportXML(metadata: BaseMetadata[]): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<metadata>\n';
    
    metadata.forEach(item => {
      xml += '  <item>\n';
      Object.entries(item).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          xml += `    <${key}>${JSON.stringify(value)}</${key}>\n`;
        } else {
          xml += `    <${key}>${this.escapeXML(String(value))}</${key}>\n`;
        }
      });
      xml += '  </item>\n';
    });
    
    xml += '</metadata>';
    return xml;
  }

  /**
   * Import from XML
   */
  private importXML(data: string): BaseMetadata[] {
    // Simplified XML parsing - in production use proper XML parser
    const items: BaseMetadata[] = [];
    const itemMatches = data.match(/<item>([\s\S]*?)<\/item>/g) || [];
    
    itemMatches.forEach(itemXml => {
      const item: any = {};
      const fieldMatches = itemXml.match(/<(\w+)>([\s\S]*?)<\/\1>/g) || [];
      
      fieldMatches.forEach(fieldXml => {
        const match = fieldXml.match(/<(\w+)>([\s\S]*?)<\/\1>/);
        if (match) {
          const [, key, value] = match;
          try {
            item[key] = JSON.parse(value);
          } catch {
            item[key] = this.unescapeXML(value);
          }
        }
      });
      
      items.push(item as BaseMetadata);
    });
    
    return items;
  }

  /**
   * XML escape/unescape utilities
   */
  private escapeXML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private unescapeXML(str: string): string {
    return str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }
}

// Export singleton instance
export const metadataService = new MetadataService();

// Export types
export type { ExtractionStrategy };