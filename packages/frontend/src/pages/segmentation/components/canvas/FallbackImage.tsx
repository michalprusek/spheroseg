import React, { useState, useEffect, useRef } from 'react';
import { constructUrl } from '@/lib/urlUtils';
import { createDataUrl } from '../../utils/directImageLoader';
import { toast } from 'sonner';

interface FallbackImageProps {
  src: string;
  alt?: string;
  width: number;
  height: number;
  fallbackSrc?: string;
  alternativeUrls?: string[];
  onLoad?: (width: number, height: number) => void;
}

/**
 * Renders an SVG image. If the primary `src` fails to load,
 * it falls back to displaying the `fallbackSrc`.
 */
const FallbackImage: React.FC<FallbackImageProps> = ({
  src,
  alt = "Image",
  width,
  height,
  fallbackSrc = "/placeholder.svg",
  alternativeUrls = [],
  onLoad
}) => {
  const [imageSource, setImageSource] = useState<string>(src);
  const [hasErrored, setHasErrored] = useState<boolean>(false);
  const [loadAttempts, setLoadAttempts] = useState<number>(0);
  const isMounted = useRef(true); // Track mount status

  console.log(`[FallbackImage] Rendering with src=${src}, width=${width}, height=${height}`);
  console.log(`[FallbackImage] Timestamp: ${new Date().toISOString()}`);
  console.log(`[FallbackImage] Alternative URLs available: ${alternativeUrls?.length || 0}`);

  // Process the source URL when it changes
  useEffect(() => {
    const loadImage = async () => {
      if (!src) {
        console.log(`[FallbackImage] No source URL provided, using fallback`);
        setImageSource(fallbackSrc);
        return;
      }

      console.log(`[FallbackImage] Processing src: ${src}`);

      // First try with constructUrl to ensure proper formatting
      try {
        const processedSrc = constructUrl(src);
        console.log(`[FallbackImage] Processed src: ${processedSrc}`);

        // Reset state
        setHasErrored(false);
        setLoadAttempts(0);

        // Check if the URL is accessible with a HEAD request
        try {
          const response = await fetch(processedSrc, {
            method: 'HEAD',
            cache: 'no-cache',
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });

          if (response.ok) {
            console.log(`[FallbackImage] URL is accessible: ${processedSrc}, status: ${response.status}`);
            const contentType = response.headers.get('Content-Type');
            console.log(`[FallbackImage] Content-Type: ${contentType}`);

            if (contentType && contentType.startsWith('image/')) {
              console.log(`[FallbackImage] URL is an image, using directly: ${processedSrc}`);
              setImageSource(processedSrc);
              return;
            }
          } else {
            console.log(`[FallbackImage] URL is not accessible: ${processedSrc}, status: ${response.status}`);
          }
        } catch (headError) {
          console.error(`[FallbackImage] Error checking URL accessibility:`, headError);
        }

        // Try to create a data URL to avoid CORS issues
        try {
          console.log(`[FallbackImage] Attempting to create data URL from ${processedSrc}`);
          const dataUrl = await createDataUrl(processedSrc);
          if (dataUrl) {
            console.log(`[FallbackImage] Created data URL successfully`);
            setImageSource(dataUrl);
            return;
          }
        } catch (error) {
          console.error(`[FallbackImage] Error creating data URL:`, error);
        }
      } catch (urlError) {
        console.error(`[FallbackImage] Error processing URL:`, urlError);
      }

      // If data URL creation fails, try with alternative URLs if available
      if (alternativeUrls && alternativeUrls.length > 0) {
        console.log(`FallbackImage: Trying to create data URL from alternative URLs (${alternativeUrls.length} available)`);

        for (const altUrl of alternativeUrls) {
          try {
            const dataUrl = await createDataUrl(altUrl);
            if (dataUrl) {
              console.log(`FallbackImage: Created data URL successfully from alternative URL: ${altUrl}`);
              setImageSource(dataUrl);
              return;
            }
          } catch (altError) {
            console.error(`FallbackImage: Error creating data URL from alternative URL ${altUrl}:`, altError);
          }
        }
      }

      // If all data URL creation attempts fail, use the processed URL directly
      console.log(`FallbackImage: All data URL creation attempts failed, using processed URL directly: ${processedSrc}`);
      setImageSource(processedSrc);
    };

    loadImage();
  }, [src, alternativeUrls]);

  // Cleanup ref on unmount
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleError = (event: React.SyntheticEvent<SVGImageElement, Event>) => {
    // Check if component is still mounted before updating state
    if (!isMounted.current) return;

    if (!hasErrored && imageSource !== fallbackSrc) {
      console.error(`[FallbackImage] Failed to load image source: ${imageSource}. Error event:`, event);

      // Log additional information for debugging
      console.log(`[FallbackImage] Current load attempts: ${loadAttempts}`);
      console.log(`[FallbackImage] Has errored: ${hasErrored}`);
      console.log(`[FallbackImage] Image source: ${imageSource}`);
      console.log(`[FallbackImage] Original src: ${src}`);

      // Try to fetch the image with a GET request to see the actual error
      fetch(imageSource, {
        method: 'GET',
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })
      .then(response => {
        console.log(`[FallbackImage] GET response for ${imageSource}: ${response.status} ${response.statusText}`);
        response.headers.forEach((value, key) => {
          console.log(`[FallbackImage] Header ${key}: ${value}`);
        });
        return response.text();
      })
      .then(text => {
        if (text.length < 1000) {
          console.log(`[FallbackImage] Response body: ${text}`);
        } else {
          console.log(`[FallbackImage] Response body too large to log (${text.length} bytes)`);
        }
      })
      .catch(error => {
        console.error(`[FallbackImage] Error fetching image with GET:`, error);
      });

      // Try alternative approaches before falling back
      if (loadAttempts < 15) { // Increase max attempts to try all alternatives
        const nextAttempt = loadAttempts + 1;
        setLoadAttempts(nextAttempt);

        // First try any provided alternative URLs
        if (alternativeUrls && alternativeUrls.length > 0 && nextAttempt <= alternativeUrls.length) {
          const alternativeUrl = alternativeUrls[nextAttempt - 1];
          console.log(`[FallbackImage] Trying alternative URL ${nextAttempt}/${alternativeUrls.length}: ${alternativeUrl}`);
          setImageSource(alternativeUrl);
          return;
        }

        // If we've exhausted alternative URLs or none were provided, try different URL formats
        const remainingAttempts = nextAttempt - ((alternativeUrls?.length) || 0);

        // Extract filename and project ID from the source URL
        const segments = src.split('/');
        const filename = segments.pop() || '';
        const projectId = segments.length > 1 ? segments[segments.length - 1] : '';

        // Try different URL formats based on remaining attempts
        if (remainingAttempts === 1) {
          // Try with direct URL
          const directUrl = `/uploads/${filename}`;
          console.log(`FallbackImage: Trying direct URL: ${directUrl}`);
          setImageSource(directUrl);
          return;
        } else if (remainingAttempts === 2) {
          // Try with project-specific URL
          if (projectId) {
            const projectUrl = `/uploads/${projectId}/${filename}`;
            console.log(`FallbackImage: Trying project URL: ${projectUrl}`);
            setImageSource(projectUrl);
            return;
          }
        } else if (remainingAttempts === 3) {
          // Try with API URL
          const apiUrl = `/api/uploads/${filename}`;
          console.log(`FallbackImage: Trying API URL: ${apiUrl}`);
          setImageSource(apiUrl);
          return;
        } else if (remainingAttempts === 4) {
          // Try with project-specific API URL
          if (projectId) {
            const projectApiUrl = `/api/uploads/${projectId}/${filename}`;
            console.log(`FallbackImage: Trying project API URL: ${projectApiUrl}`);
            setImageSource(projectApiUrl);
            return;
          }
        } else if (remainingAttempts === 5) {
          // Try with absolute URL
          const absoluteUrl = `${window.location.origin}${src}`;
          console.log(`FallbackImage: Trying absolute URL: ${absoluteUrl}`);
          setImageSource(absoluteUrl);
          return;
        } else if (remainingAttempts === 6) {
          // Try with cache-busting parameter
          const cacheBustUrl = `${src}?_=${Date.now()}`;
          console.log(`FallbackImage: Trying cache-busting URL: ${cacheBustUrl}`);
          setImageSource(cacheBustUrl);
          return;
        } else if (remainingAttempts === 7) {
          // Try with direct backend URL
          const backendUrl = `http://localhost:5001/uploads/${filename}`;
          console.log(`FallbackImage: Trying direct backend URL: ${backendUrl}`);
          setImageSource(backendUrl);
          return;
        } else if (remainingAttempts === 8) {
          // Try with project-specific backend URL
          if (projectId) {
            const projectBackendUrl = `http://localhost:5001/uploads/${projectId}/${filename}`;
            console.log(`FallbackImage: Trying project backend URL: ${projectBackendUrl}`);
            setImageSource(projectBackendUrl);
            return;
          }
        } else if (remainingAttempts === 9) {
          // Try with Docker network URL
          const dockerUrl = `http://cellseg-backend:5000/uploads/${filename}`;
          console.log(`FallbackImage: Trying Docker network URL: ${dockerUrl}`);
          setImageSource(dockerUrl);
          return;
        } else if (remainingAttempts === 10) {
          // Try with project-specific Docker network URL
          if (projectId) {
            const projectDockerUrl = `http://cellseg-backend:5000/uploads/${projectId}/${filename}`;
            console.log(`FallbackImage: Trying project Docker network URL: ${projectDockerUrl}`);
            setImageSource(projectDockerUrl);
            return;
          }
        }
      }

      // If all attempts fail, use fallback
      setHasErrored(true);
      setImageSource(fallbackSrc);
      toast.error("Failed to load image, using placeholder image");
    }
  };

  const handleLoad = (event: React.SyntheticEvent<SVGImageElement, Event>) => {
    // Check if component is still mounted before updating state or calling onLoad
    if (!isMounted.current) return;

    // Only call the onLoad prop if the image loaded successfully
    console.log(`[FallbackImage] Successfully loaded image source: ${imageSource}`);
    console.log(`[FallbackImage] Load attempts: ${loadAttempts}`);
    console.log(`[FallbackImage] Has errored: ${hasErrored}`);

    // Try to get the actual dimensions of the loaded image
    try {
      const img = new Image();
      img.onload = () => {
        console.log(`[FallbackImage] Actual image dimensions: ${img.naturalWidth}x${img.naturalHeight}`);

        // If the actual dimensions are different from the props, call onLoad with the actual dimensions
        if (img.naturalWidth !== width || img.naturalHeight !== height) {
          console.log(`[FallbackImage] Dimensions differ from props: ${width}x${height} vs ${img.naturalWidth}x${img.naturalHeight}`);
          if (onLoad) {
            onLoad(img.naturalWidth, img.naturalHeight);
          }
        } else {
          // If dimensions match, call onLoad with the props
          if (onLoad) {
            onLoad(width, height);
          }
        }
      };
      img.onerror = () => {
        console.error(`[FallbackImage] Failed to load image for dimension check: ${imageSource}`);
        // Fall back to using the props
        if (onLoad) {
          onLoad(width, height);
        }
      };
      img.src = imageSource;
    } catch (error) {
      console.error(`[FallbackImage] Error checking image dimensions:`, error);
      // Fall back to using the props
      if (onLoad) {
        onLoad(width, height);
      }
    }

    // Show success toast if we recovered from errors
    if (loadAttempts > 0 && !hasErrored) {
      toast.success("Image loaded successfully");
    }
  };

  return (
    <image
      href={imageSource} // Use the state variable which might be src or fallbackSrc
      width={width}
      height={height}
      onLoad={handleLoad}
      onError={handleError}
      style={{ imageRendering: 'crisp-edges' }}
    />
  );
};

export default FallbackImage;
