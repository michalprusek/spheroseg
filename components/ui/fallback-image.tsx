"use client"

import React, { useState, useEffect, useRef } from 'react'
import Image, { ImageProps } from 'next/image'
import { ImageIcon } from 'lucide-react'
import { isOfflineMode } from '@/app/api/api-config'
import { cn } from '@/lib/utils'

interface FallbackImageProps extends Omit<ImageProps, 'src' | 'onError'> {
  src: string | null | undefined
  fallbackSrc?: string
  maxRetries?: number
  retryDelay?: number
  forceOffline?: boolean
  alt: string
  className?: string
  imgClassName?: string
}

/**
 * Adjusts image URLs to ensure they work correctly
 * - Replaces minio:9000 with localhost:9000
 * - Adds cache-busting parameter for development
 * - Routes thumbnail URLs through our proxy endpoint
 */
export function adjustImageUrl(url: string | null | undefined): string {
  if (!url) return '';

  // Handle thumbnail URLs by routing them through our proxy
  if (url.includes('/thumbnails/thumb_')) {
    // Extract the object name from the URL
    const objectNameMatch = url.match(/\/thumbnails\/(thumb_[a-f0-9-]+\.png)/);
    if (objectNameMatch && objectNameMatch[1]) {
      const objectName = objectNameMatch[1];
      
      // Get the token from localStorage to include in the URL
      let token = '';
      if (typeof window !== 'undefined') {
        token = localStorage.getItem('token') || '';
      }
      
      // Determine the correct API host - use current hostname from browser
      const host = typeof window !== 'undefined' ? 
        `${window.location.protocol}//${window.location.hostname}${window.location.port ? `:${window.location.port}` : ''}` : '';
      
      // Include the token in the URL for authentication
      return `${host}/api/proxy/thumbnail?object_name=${encodeURIComponent(objectName)}${token ? `&token=${token}` : ''}`;
    }
  }

  // Replace minio:9000 with localhost:9000 for direct image access
  let adjustedUrl = url.replace('minio:9000', 'localhost:9000');
  
  // Add cache busting for development
  if (process.env.NODE_ENV === 'development') {
    const separator = adjustedUrl.includes('?') ? '&' : '?';
    adjustedUrl = `${adjustedUrl}${separator}t=${Date.now()}`;
  }

  return adjustedUrl;
}

export function FallbackImage({ 
  src, 
  fallbackSrc = "/images/placeholder-thumbnail.svg", 
  alt,
  maxRetries = 3,
  retryDelay = 1000,
  forceOffline = false,
  className,
  imgClassName,
  ...props 
}: FallbackImageProps) {
  const [error, setError] = useState(false)
  const [imageSrc, setImageSrc] = useState<string>('')
  const [offline, setOffline] = useState<boolean>(isOfflineMode() || forceOffline)
  const retriesRef = useRef(0)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  useEffect(() => {
    // Cleanup timeout on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  useEffect(() => {
    // Check offline mode
    const offlineStatus = isOfflineMode() || forceOffline;
    setOffline(offlineStatus);
    
    // Reset error state and retry counter when src changes
    setError(false);
    retriesRef.current = 0;
    
    // If src is empty or we're in offline mode, use fallback right away
    if (!src || offlineStatus) {
      setImageSrc(fallbackSrc);
      return;
    }
    
    // Adjust image URL
    try {
      const adjustedSrc = adjustImageUrl(src);
      
      // Only set image source if it's not empty
      if (adjustedSrc) {
        setImageSrc(adjustedSrc);
      } else {
        console.error("FallbackImage: Empty adjusted source URL");
        setImageSrc(fallbackSrc);
        setError(true);
      }
    } catch (error) {
      console.error("FallbackImage: Error adjusting URL");
      setImageSrc(fallbackSrc);
      setError(true);
    }
  }, [src, fallbackSrc, forceOffline]);

  // If we're in offline mode or error occurred, show fallback
  if (offline || error) {
    return (
      <div className={cn("flex h-full w-full items-center justify-center bg-muted/20", className)}>
        {fallbackSrc ? (
          <Image
            src={fallbackSrc}
            alt={alt || "Image placeholder"}
            width={props.width || 100}
            height={props.height || 100}
            unoptimized={true}
            priority={props.priority || true}
            onError={(e) => {
              // If fallback fails too, show icon
              if (e.currentTarget) {
                e.currentTarget.onerror = null;
              }
              setImageSrc("");
            }}
            // Don't pass props that would conflict with width/height
            className={props.className}
            style={props.style}
            quality={props.quality}
            sizes={props.sizes}
            loading={props.loading}
          />
        ) : (
          <ImageIcon className="h-10 w-10 text-muted-foreground" />
        )}
      </div>
    )
  }

  // Handle empty imageSrc
  if (!imageSrc) {
    setError(true);
    return (
      <div className={cn("flex h-full w-full items-center justify-center bg-muted/20", className)}>
        {fallbackSrc ? (
          <Image
            src={fallbackSrc}
            alt={alt || "Image placeholder"}
            width={props.width || 100}
            height={props.height || 100}
            unoptimized={true}
            priority={true}
            // Don't pass props that would conflict with width/height
            className={props.className}
            style={props.style}
            quality={props.quality}
            sizes={props.sizes}
            loading={props.loading}
          />
        ) : (
          <ImageIcon className="h-10 w-10 text-muted-foreground" />
        )}
      </div>
    );
  }
  
  // Show original image with error handling
  return (
    <div className={className}>
      <Image
        src={imageSrc}
        alt={alt || ""}
        width={props.width || 100}
        height={props.height || 100}
        onError={(e) => {
          // Prevent multiple error events
          if (e.currentTarget) {
            e.currentTarget.onerror = null;
          }
          
          // In offline mode, use fallback immediately
          if (offline) {
            setError(true);
            return;
          }
          
          // Try to reload the image
          if (retriesRef.current < maxRetries) {
            retriesRef.current += 1;
            
            // Use timeout for delayed retry with exponential backoff
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
            }
            
            const exponentialDelay = retryDelay * Math.pow(2, retriesRef.current - 1);
            timeoutRef.current = setTimeout(() => {
              // Try proxy for images if available
              if (retriesRef.current === 2 && imageSrc.includes('localhost:9000')) {
                // If it's the second attempt, try using API proxy
                const imageId = imageSrc.match(/\/([a-f0-9-]+)(\.[a-z]+)?(\?|$)/)?.[1];
                if (imageId) {
                  // Determine the correct API host
                  const host = window?.location?.hostname === 'localhost' ? 
                    `http://${window.location.hostname}:${window.location.port || 3000}` : '';
                  const proxyUrl = `${host}/api/proxy/image/${imageId}?_cb=${Date.now()}_retry${retriesRef.current}`;
                  setImageSrc(proxyUrl);
                  return;
                }
              }
              
              // Add parameter for cache-busting
              const baseUrl = imageSrc.split('?')[0];
              const retryUrl = `${baseUrl}?_cb=${Date.now()}_retry${retriesRef.current}`;
              setImageSrc(retryUrl);
            }, exponentialDelay);
          } else {
            setError(true);
          }
        }}
        unoptimized={true}
        priority={props.priority || true}
        className={imgClassName}
        // Only pass props that don't conflict with width/height/fill
        style={props.style}
        quality={props.quality}
        sizes={props.sizes}
        loading={props.loading}
        // If fill is true, don't pass width and height
        {...(props.fill ? {fill: true} : {})}
      />
    </div>
  )
}