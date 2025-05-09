import { useState, useEffect, useCallback, useRef } from 'react';
import { createLogger } from '@/lib/logger';

const logger = createLogger('hooks:useImageLoader');

interface ImageLoaderOptions {
  crossOrigin?: 'anonymous' | 'use-credentials' | '';
  cacheBuster?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

interface ImageLoaderResult {
  isLoading: boolean;
  error: Error | null;
  image: HTMLImageElement | null;
  retry: () => void;
  abort: () => void;
}

/**
 * Hook for loading images with advanced features like retries, timeouts, and cache busting
 */
export const useImageLoader = (
  src: string | null,
  options: ImageLoaderOptions = {}
): ImageLoaderResult => {
  const {
    crossOrigin = 'anonymous',
    cacheBuster = true,
    maxRetries = 2,
    retryDelay = 1000,
    timeout = 30000,
  } = options;

  const [isLoading, setIsLoading] = useState<boolean>(!!src);
  const [error, setError] = useState<Error | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
  
  const imgRef = useRef<HTMLImageElement | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Add cache-busting parameter to prevent browser caching
  const addCacheBuster = useCallback((url: string): string => {
    if (!cacheBuster) return url;
    const cacheBusterParam = `_cb=${Date.now()}`;
    return url.includes('?') ? `${url}&${cacheBusterParam}` : `${url}?${cacheBusterParam}`;
  }, [cacheBuster]);

  // Function to abort current loading
  const abort = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    if (imgRef.current) {
      imgRef.current.onload = null;
      imgRef.current.onerror = null;
      imgRef.current.src = '';
      imgRef.current = null;
    }
  }, []);

  // Function to retry loading
  const retry = useCallback(() => {
    if (!src) return;
    
    setRetryCount(prev => prev + 1);
    setError(null);
    setIsLoading(true);
    
    // Small delay before retrying
    setTimeout(() => {
      loadImage(src);
    }, retryDelay);
  }, [src, retryDelay]);

  // Function to load the image
  const loadImage = useCallback((imageSrc: string) => {
    // Abort any previous loading
    abort();
    
    // Create a new abort controller
    abortControllerRef.current = new AbortController();
    
    // Create a new image
    const img = new Image();
    imgRef.current = img;
    
    // Set crossOrigin
    if (crossOrigin) {
      img.crossOrigin = crossOrigin;
    }
    
    // Set up timeout
    if (timeout > 0) {
      timeoutRef.current = window.setTimeout(() => {
        logger.warn(`Image load timeout after ${timeout}ms: ${imageSrc}`);
        setError(new Error(`Image load timeout after ${timeout}ms`));
        setIsLoading(false);
        abort();
      }, timeout);
    }
    
    // Set up load handler
    img.onload = () => {
      logger.debug(`Image loaded successfully: ${imageSrc}`);
      
      // Clear timeout
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      setImage(img);
      setIsLoading(false);
      setError(null);
    };
    
    // Set up error handler
    img.onerror = (e) => {
      logger.error(`Error loading image: ${imageSrc}`, e);
      
      // Clear timeout
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      setError(new Error(`Failed to load image: ${imageSrc}`));
      setIsLoading(false);
    };
    
    // Start loading the image with cache-busting
    const urlWithCacheBuster = addCacheBuster(imageSrc);
    logger.debug(`Loading image: ${urlWithCacheBuster}`);
    img.src = urlWithCacheBuster;
  }, [abort, addCacheBuster, crossOrigin, timeout]);

  // Effect to load the image when src changes
  useEffect(() => {
    if (!src) {
      setIsLoading(false);
      setError(null);
      setImage(null);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setRetryCount(0);
    
    loadImage(src);
    
    // Cleanup
    return () => {
      abort();
    };
  }, [src, loadImage, abort]);

  // Effect to retry loading if needed
  useEffect(() => {
    if (error && retryCount < maxRetries) {
      logger.info(`Auto-retrying image load (${retryCount + 1}/${maxRetries}): ${src}`);
      retry();
    }
  }, [error, retryCount, maxRetries, retry, src]);

  return { isLoading, error, image, retry, abort };
};

export default useImageLoader;
