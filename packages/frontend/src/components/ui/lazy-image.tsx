import React, { useState, useEffect, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { createLogger } from '@/lib/logger';
import { constructUrl } from '@/lib/urlUtils';

const logger = createLogger('ui:lazy-image');

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  fallbackSrc?: string;
  threshold?: number;
  placeholderColor?: string;
  showSkeleton?: boolean;
}

/**
 * LazyImage component that loads images only when they enter the viewport
 * with fallback handling and error states.
 */
export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className,
  containerClassName,
  fallbackSrc = '/placeholder.svg',
  threshold = 0.1,
  placeholderColor = '#f3f4f6',
  showSkeleton = true,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [isInView, setIsInView] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [imgSrc, setImgSrc] = useState<string>('');
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Set up intersection observer to detect when image enters viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        setIsInView(entry.isIntersecting);
      },
      {
        root: null,
        rootMargin: '100px', // Start loading a bit before it enters the viewport
        threshold,
      },
    );

    const currentRef = containerRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [threshold]);

  // Load image when it enters viewport
  useEffect(() => {
    if (!isInView) return;

    // Process the URL with constructUrl
    const processedSrc = constructUrl(src);

    // Add cache-busting parameter to prevent browser caching
    const cacheBuster = `_cb=${Date.now()}`;
    const imgSrcWithCacheBuster = processedSrc.includes('?')
      ? `${processedSrc}&${cacheBuster}`
      : `${processedSrc}?${cacheBuster}`;

    setImgSrc(imgSrcWithCacheBuster);
    logger.debug(`Loading image in viewport: ${imgSrcWithCacheBuster} (original: ${src})`);
  }, [isInView, src]);

  // Handle image load and error events
  const handleLoad = () => {
    logger.debug(`Image loaded successfully: ${src}`);
    setIsLoaded(true);
    setHasError(false);
  };

  const handleError = () => {
    logger.error(`Error loading image: ${src}`);
    setIsLoaded(true);
    setHasError(true);
    setImgSrc(fallbackSrc);
  };

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-hidden bg-muted', containerClassName)}
      style={{ backgroundColor: placeholderColor }}
    >
      {!isLoaded && showSkeleton && <Skeleton className="absolute inset-0 z-10" />}

      {imgSrc && (
        <img
          ref={imgRef}
          src={imgSrc}
          alt={alt}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-300',
            !isLoaded ? 'opacity-0' : 'opacity-100',
            hasError ? 'grayscale' : '',
            className,
          )}
          onLoad={handleLoad}
          onError={handleError}
          {...props}
        />
      )}

      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 text-muted-foreground text-sm">
          Failed to load image
        </div>
      )}
    </div>
  );
};

export default LazyImage;
