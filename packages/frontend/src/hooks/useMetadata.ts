import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  metadataService,
  BaseMetadata,
  ImageMetadata,
  DocumentMetadata,
  ProjectMetadata,
  SegmentationMetadata,
  SEOMetadata,
} from '@/services/metadataService';
import { useNotifications } from '@/hooks/useNotifications';
import { useTranslation } from 'react-i18next';

/**
 * Unified Metadata Hooks
 * React hooks for metadata management
 */

// Hook options
interface UseMetadataOptions {
  autoExtract?: boolean;
  cacheTime?: number;
  onSuccess?: (metadata: BaseMetadata) => void;
  onError?: (error: Error) => void;
}

interface UseMetadataSearchOptions {
  debounceMs?: number;
  limit?: number;
}

/**
 * Hook for extracting metadata from files
 */
export function useMetadataExtraction(options: UseMetadataOptions = {}) {
  const { notify } = useNotifications();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const extractMutation = useMutation({
    mutationFn: async ({ file, type }: { file: File | Blob; type: string }) => {
      return metadataService.extract(file, type);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['metadata'] });
      options.onSuccess?.(data);
      notify({
        title: t('metadata.extraction.success'),
        type: 'success',
      });
    },
    onError: (error: Error) => {
      options.onError?.(error);
      notify({
        title: t('metadata.extraction.error'),
        message: error.message,
        type: 'error',
      });
    },
  });

  const extractFromFile = useCallback(
    (file: File | Blob, type: string = 'image') => {
      return extractMutation.mutate({ file, type });
    },
    [extractMutation]
  );

  return {
    extract: extractFromFile,
    isExtracting: extractMutation.isPending,
    error: extractMutation.error,
    data: extractMutation.data,
  };
}

/**
 * Hook for updating metadata
 */
export function useMetadataUpdate<T extends BaseMetadata>() {
  const { notify } = useNotifications();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<T> }) => {
      return metadataService.update<T>(id, updates);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['metadata', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['metadata-search'] });
      notify({
        title: t('metadata.update.success'),
        type: 'success',
      });
    },
    onError: (error: Error) => {
      notify({
        title: t('metadata.update.error'),
        message: error.message,
        type: 'error',
      });
    },
  });

  return {
    update: updateMutation.mutate,
    updateAsync: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    error: updateMutation.error,
  };
}

/**
 * Hook for searching metadata
 */
export function useMetadataSearch(
  query: {
    type?: string;
    tags?: string[];
    keywords?: string[];
    dateRange?: { start: Date; end: Date };
    custom?: Record<string, any>;
  },
  options: UseMetadataSearchOptions = {}
) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  // Debounce query changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, options.debounceMs || 300);

    return () => clearTimeout(timer);
  }, [query, options.debounceMs]);

  const searchQuery = useQuery({
    queryKey: ['metadata-search', debouncedQuery],
    queryFn: () => metadataService.search(debouncedQuery),
    enabled: Object.keys(debouncedQuery).length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const results = useMemo(() => {
    if (!searchQuery.data) return [];
    if (!options.limit) return searchQuery.data;
    return searchQuery.data.slice(0, options.limit);
  }, [searchQuery.data, options.limit]);

  return {
    results,
    isSearching: searchQuery.isLoading,
    error: searchQuery.error,
    refetch: searchQuery.refetch,
  };
}

/**
 * Hook for batch metadata operations
 */
export function useMetadataBatch() {
  const { notify } = useNotifications();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const batchUpdateMutation = useMutation({
    mutationFn: async (items: Array<{ id: string; updates: Partial<BaseMetadata> }>) => {
      return metadataService.batchUpdate(items);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metadata'] });
      queryClient.invalidateQueries({ queryKey: ['metadata-search'] });
      notify({
        title: t('metadata.batchUpdate.success'),
        type: 'success',
      });
    },
    onError: (error: Error) => {
      notify({
        title: t('metadata.batchUpdate.error'),
        message: error.message,
        type: 'error',
      });
    },
  });

  return {
    batchUpdate: batchUpdateMutation.mutate,
    batchUpdateAsync: batchUpdateMutation.mutateAsync,
    isUpdating: batchUpdateMutation.isPending,
    error: batchUpdateMutation.error,
  };
}

/**
 * Hook for metadata export/import
 */
export function useMetadataPortability() {
  const { notify } = useNotifications();
  const { t } = useTranslation();

  const exportMetadata = useCallback(
    (metadata: BaseMetadata[], format: 'json' | 'csv' | 'xml' = 'json') => {
      try {
        const data = metadataService.export(metadata, format);
        const blob = new Blob([data], { type: getMimeType(format) });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `metadata.${format}`;
        a.click();
        URL.revokeObjectURL(url);
        
        notify({
          title: t('metadata.export.success'),
          type: 'success',
        });
      } catch (error) {
        notify({
          title: t('metadata.export.error'),
          message: error instanceof Error ? error.message : 'Unknown error',
          type: 'error',
        });
      }
    },
    [notify, t]
  );

  const importMetadata = useCallback(
    async (file: File, format?: 'json' | 'csv' | 'xml') => {
      try {
        const text = await file.text();
        const detectedFormat = format || detectFormat(file.name);
        const metadata = await metadataService.import(text, detectedFormat);
        
        notify({
          title: t('metadata.import.success'),
          message: t('metadata.import.successMessage', { count: metadata.length }),
          type: 'success',
        });
        
        return metadata;
      } catch (error) {
        notify({
          title: t('metadata.import.error'),
          message: error instanceof Error ? error.message : 'Unknown error',
          type: 'error',
        });
        throw error;
      }
    },
    [notify, t]
  );

  return {
    exportMetadata,
    importMetadata,
  };
}

/**
 * Hook for SEO metadata generation
 */
export function useSEOMetadata() {
  const [seoMetadata, setSeoMetadata] = useState<SEOMetadata | null>(null);

  const generateSEO = useCallback((data: {
    title: string;
    description: string;
    image?: string;
    url?: string;
    type?: string;
  }) => {
    const metadata = metadataService.generateSEOMetadata(data);
    setSeoMetadata(metadata);
    return metadata;
  }, []);

  const applyToDocument = useCallback((metadata: SEOMetadata) => {
    // Update document title
    document.title = metadata.title;

    // Update meta tags
    updateMetaTag('description', metadata.description);
    if (metadata.keywords) {
      updateMetaTag('keywords', metadata.keywords.join(', '));
    }
    if (metadata.canonical) {
      updateLinkTag('canonical', metadata.canonical);
    }

    // Open Graph tags
    if (metadata.og) {
      updateMetaTag('og:title', metadata.og.title);
      updateMetaTag('og:description', metadata.og.description);
      updateMetaTag('og:image', metadata.og.image);
      updateMetaTag('og:url', metadata.og.url);
      updateMetaTag('og:type', metadata.og.type);
      updateMetaTag('og:site_name', metadata.og.siteName);
    }

    // Twitter Card tags
    if (metadata.twitter) {
      updateMetaTag('twitter:card', metadata.twitter.card);
      updateMetaTag('twitter:title', metadata.twitter.title);
      updateMetaTag('twitter:description', metadata.twitter.description);
      updateMetaTag('twitter:image', metadata.twitter.image);
      updateMetaTag('twitter:creator', metadata.twitter.creator);
    }

    // JSON-LD structured data
    if (metadata.jsonLd) {
      let script = document.querySelector('script[type="application/ld+json"]');
      if (!script) {
        script = document.createElement('script');
        script.setAttribute('type', 'application/ld+json');
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(metadata.jsonLd);
    }
  }, []);

  return {
    seoMetadata,
    generateSEO,
    applyToDocument,
  };
}

/**
 * Hook for metadata quality scoring
 */
export function useMetadataQuality(metadata: BaseMetadata | null) {
  const score = useMemo(() => {
    if (!metadata) return 0;
    return metadataService.calculateQualityScore(metadata);
  }, [metadata]);

  const suggestions = useMemo(() => {
    if (!metadata) return [];
    
    const items: string[] = [];
    
    if (!metadata.description || metadata.description.length < 50) {
      items.push('Add a detailed description (at least 50 characters)');
    }
    
    if (!metadata.tags || metadata.tags.length < 3) {
      items.push('Add at least 3 relevant tags');
    }
    
    if (!metadata.keywords || metadata.keywords.length < 5) {
      items.push('Add at least 5 keywords');
    }
    
    if (metadata.type === 'image') {
      const imageMetadata = metadata as ImageMetadata;
      if (!imageMetadata.exif) {
        items.push('EXIF data is missing');
      }
      if (!imageMetadata.scientific) {
        items.push('Add scientific metadata for better analysis');
      }
    }
    
    return items;
  }, [metadata]);

  const qualityLevel = useMemo(() => {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    return 'poor';
  }, [score]);

  return {
    score,
    qualityLevel,
    suggestions,
  };
}

/**
 * Hook for metadata statistics
 */
export function useMetadataStatistics(filter?: {
  type?: string;
  dateRange?: { start: Date; end: Date };
}) {
  const query = useQuery({
    queryKey: ['metadata-statistics', filter],
    queryFn: () => metadataService.getStatistics(filter),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    statistics: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook for AI metadata enrichment
 */
export function useMetadataEnrichment() {
  const { notify } = useNotifications();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const enrichMutation = useMutation({
    mutationFn: async (metadata: BaseMetadata) => {
      return metadataService.enrichWithAI(metadata);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['metadata'] });
      notify({
        title: t('metadata.enrich.success'),
        message: t('metadata.enrich.successMessage'),
        type: 'success',
      });
    },
    onError: (error: Error) => {
      notify({
        title: t('metadata.enrich.error'),
        message: error.message,
        type: 'error',
      });
    },
  });

  return {
    enrich: enrichMutation.mutate,
    enrichAsync: enrichMutation.mutateAsync,
    isEnriching: enrichMutation.isPending,
    error: enrichMutation.error,
    enrichedData: enrichMutation.data,
  };
}

// Helper functions
function getMimeType(format: string): string {
  switch (format) {
    case 'csv':
      return 'text/csv';
    case 'xml':
      return 'application/xml';
    case 'json':
    default:
      return 'application/json';
  }
}

function detectFormat(filename: string): 'json' | 'csv' | 'xml' {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'csv':
      return 'csv';
    case 'xml':
      return 'xml';
    case 'json':
    default:
      return 'json';
  }
}

function updateMetaTag(name: string, content?: string) {
  if (!content) return;
  
  let meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    if (name.startsWith('og:') || name.startsWith('twitter:')) {
      meta.setAttribute('property', name);
    } else {
      meta.setAttribute('name', name);
    }
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

function updateLinkTag(rel: string, href?: string) {
  if (!href) return;
  
  let link = document.querySelector(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', rel);
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}