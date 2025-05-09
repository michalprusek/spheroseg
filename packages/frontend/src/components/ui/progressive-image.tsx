import React, { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { createLogger } from '@/lib/logger';
import { constructUrl } from '@/lib/urlUtils';

const logger = createLogger('ui:progressive-image');

interface ProgressiveImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  lowResSrc?: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  onLoad?: () => void;
  onError?: () => void;
  fallbackSrc?: string;
  showSkeleton?: boolean;
}

/**
 * ProgressiveImage component that shows a low-resolution image or skeleton while loading
 * the high-resolution image, with fallback handling and error states.
 */
export const ProgressiveImage: React.FC<ProgressiveImageProps> = ({
  src,
  lowResSrc,
  alt,
  className,
  containerClassName,
  onLoad,
  onError,
  fallbackSrc = '/placeholder.svg',
  showSkeleton = true,
  ...props
}) => {
  const [imgSrc, setImgSrc] = useState<string>(lowResSrc ? constructUrl(lowResSrc) : fallbackSrc);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState<number>(0);
  const maxRetries = 2;

  // Add cache-busting parameter to prevent browser caching
  const addCacheBuster = (url: string): string => {
    const cacheBuster = `_cb=${Date.now()}`;
    return url.includes('?') ? `${url}&${cacheBuster}` : `${url}?${cacheBuster}`;
  };

  useEffect(() => {
    // Reset states when src changes
    if (lowResSrc) {
      setImgSrc(constructUrl(lowResSrc));
    }
    setIsLoading(true);
    setHasError(false);
    setRetryCount(0);

    // Create a new image object to preload the high-res image
    const img = new Image();

    // Set crossOrigin to anonymous to avoid CORS issues
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      logger.debug(`Image loaded successfully: ${src}`);
      setImgSrc(processedSrc);
      setIsLoading(false);
      setHasError(false);
      if (onLoad) onLoad();
    };

    img.onerror = () => {
      logger.error(`Error loading image: ${src}`);

      // Retry loading with cache-busting if we haven't reached max retries
      if (retryCount < maxRetries) {
        logger.info(`Retrying image load (${retryCount + 1}/${maxRetries}): ${src}`);
        setRetryCount(prev => prev + 1);
        img.src = addCacheBuster(constructUrl(src));
      } else {
        setImgSrc(fallbackSrc);
        setIsLoading(false);
        setHasError(true);
        if (onError) onError();
      }
    };

    // Process the URL with constructUrl and add cache-busting
    const processedSrc = constructUrl(src);
    img.src = addCacheBuster(processedSrc);

    // Clean up
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src, lowResSrc, fallbackSrc, onLoad, onError, retryCount]);

  return (
    <div className={cn('relative overflow-hidden', containerClassName)}>
      {isLoading && showSkeleton && (
        <Skeleton className="absolute inset-0 z-10 bg-muted/80" />
      )}
      <img
        src={imgSrc}
        alt={alt}
        className={cn(
          'w-full h-full object-cover transition-opacity duration-300',
          isLoading ? 'opacity-60 blur-sm' : 'opacity-100 blur-0',
          hasError ? 'grayscale' : '',
          className
        )}
        {...props}
      />
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 text-muted-foreground text-sm">
          Failed to load image
        </div>
      )}
    </div>
  );
};

export default ProgressiveImage;
