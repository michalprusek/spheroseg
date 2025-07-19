import React, { useState, useEffect, useRef, ImgHTMLAttributes } from 'react';
import { Box, Skeleton } from '@mui/material';
import { getOptimizedImageUrl, getImageSrcSet, isCDNEnabled } from '../../utils/cdn';

export interface CDNImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  sizes?: string;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png' | 'auto';
  lazy?: boolean;
  placeholder?: 'blur' | 'skeleton' | 'none';
  blurDataURL?: string;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  fallbackSrc?: string;
  priority?: boolean;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  responsive?: boolean;
  responsiveSizes?: number[];
}

const CDNImage: React.FC<CDNImageProps> = ({
  src,
  alt,
  width,
  height,
  sizes,
  quality,
  format = 'auto',
  lazy = true,
  placeholder = 'skeleton',
  blurDataURL,
  onLoad,
  onError,
  fallbackSrc,
  priority = false,
  objectFit = 'cover',
  responsive = true,
  responsiveSizes = [320, 640, 960, 1280, 1920],
  className,
  style,
  ...props
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const imgRef = useRef<HTMLImageElement>(null);
  const [isInView, setIsInView] = useState(!lazy);

  // Generate optimized URL
  const optimizedSrc = getOptimizedImageUrl(src, {
    width,
    height,
    quality,
    format,
  });

  // Generate srcset for responsive images
  const srcSet = responsive && isCDNEnabled() ? getImageSrcSet(src, responsiveSizes, { quality, format }) : undefined;

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!lazy || priority) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px',
        threshold: 0.01,
      },
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [lazy, priority]);

  // Preload priority images
  useEffect(() => {
    if (priority && src) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = optimizedSrc;
      if (srcSet) {
        link.imageSrcset = srcSet;
        if (sizes) {
          link.imageSizes = sizes;
        }
      }
      document.head.appendChild(link);

      return () => {
        document.head.removeChild(link);
      };
    }
  }, [priority, src, optimizedSrc, srcSet, sizes]);

  // Update current source when in view
  useEffect(() => {
    if (isInView && !error) {
      setCurrentSrc(optimizedSrc);
    }
  }, [isInView, optimizedSrc, error]);

  const handleLoad = () => {
    setLoading(false);
    setError(false);
    onLoad?.();
  };

  const handleError = () => {
    setError(true);
    setLoading(false);

    // Try fallback source
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      setError(false);
      setLoading(true);
    } else {
      onError?.(new Error(`Failed to load image: ${src}`));
    }
  };

  // Styles
  const imageStyle: React.CSSProperties = {
    objectFit,
    width: width || '100%',
    height: height || 'auto',
    opacity: loading ? 0 : 1,
    transition: 'opacity 0.3s ease-in-out',
    ...style,
  };

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: width || '100%',
    height: height || 'auto',
    overflow: 'hidden',
  };

  return (
    <Box sx={containerStyle} className={className}>
      {/* Placeholder */}
      {loading && placeholder === 'skeleton' && (
        <Skeleton
          variant="rectangular"
          width={width || '100%'}
          height={height || 200}
          animation="wave"
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 1,
          }}
        />
      )}

      {/* Blur placeholder */}
      {loading && placeholder === 'blur' && blurDataURL && (
        <img
          src={blurDataURL}
          alt=""
          aria-hidden="true"
          style={{
            ...imageStyle,
            filter: 'blur(20px)',
            transform: 'scale(1.1)',
            opacity: 1,
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        />
      )}

      {/* Main image */}
      {isInView && (
        <img
          ref={imgRef}
          src={currentSrc}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          loading={lazy && !priority ? 'lazy' : 'eager'}
          decoding={priority ? 'sync' : 'async'}
          onLoad={handleLoad}
          onError={handleError}
          style={imageStyle}
          {...props}
        />
      )}

      {/* Error state */}
      {error && !fallbackSrc && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: height || 200,
            backgroundColor: 'grey.200',
            color: 'text.secondary',
          }}
        >
          <span>Failed to load image</span>
        </Box>
      )}
    </Box>
  );
};

// Wrapper component for gallery images
export const GalleryImage: React.FC<CDNImageProps> = (props) => {
  return (
    <CDNImage {...props} responsive sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" quality={85} />
  );
};

// Wrapper component for thumbnail images
export const ThumbnailImage: React.FC<CDNImageProps> = (props) => {
  return (
    <CDNImage {...props} responsive={false} quality={70} width={props.width || 300} height={props.height || 300} />
  );
};

// Wrapper component for hero/banner images
export const HeroImage: React.FC<CDNImageProps> = (props) => {
  return <CDNImage {...props} priority responsive sizes="100vw" quality={90} placeholder="blur" />;
};

export default CDNImage;
