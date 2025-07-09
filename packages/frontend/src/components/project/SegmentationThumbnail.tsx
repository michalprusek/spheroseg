import React, { useState, useEffect, useRef } from 'react';
import apiClient from '@/lib/apiClient';
import {
  Point as ApiPoint,
  Polygon as ApiPolygon,
  SegmentationResult as ApiSegmentationResult,
} from '@/lib/segmentation/types';
import { createSvgPath, scalePolygons, darkenColor } from '@/lib/svgUtils';
import { createNamespacedLogger } from '@/utils/logger';

const CLogger = createNamespacedLogger('SegmentationThumbnail');

// Define internal types based on ApiPolygon and to accommodate legacy fields
type InternalPolygon = ApiPolygon & {
  legacyLabel?: string;
  legacyScore?: number;
};

// Define a polygon type specific for display, adding color
interface DisplayPolygon extends ApiPolygon {
  color?: string;
}

interface InternalSegmentationDataState {
  polygons: InternalPolygon[];
  imageWidth?: number;
  imageHeight?: number;
}

// For legacy API responses that might be a simple array of polygons
interface LegacyListItem {
  points: ApiPoint[];
  label?: string;
  score?: number;
  id?: string;
  type?: 'external' | 'internal';
  class?: string;
  holes?: ApiPoint[][];
}

// Combined type for what axios.get might return
type ApiResponse = ApiSegmentationResult | LegacyListItem[];

interface SegmentationThumbnailProps {
  imageId: string;
  projectId: string;
  thumbnailUrl: string | null | undefined;
  fallbackSrc?: string;
  altText?: string;
  className?: string;
  width?: number;
  height?: number;
}

/**
 * Component that displays an image thumbnail with segmentation polygons overlaid
 */
const SegmentationThumbnail: React.FC<SegmentationThumbnailProps> = ({
  imageId,
  projectId,
  thumbnailUrl,
  fallbackSrc = '/placeholder.svg',
  altText = 'Image thumbnail',
  className = '',
  width = 300,
  height = 300,
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [triedDirectUrl, setTriedDirectUrl] = useState(false);
  const [segmentationData, setSegmentationData] = useState<InternalSegmentationDataState | null>(null);
  const [imageSize, setImageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [scaledPolygons, setScaledPolygons] = useState<DisplayPolygon[] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchSegmentationData = async () => {
      if (!imageId || !projectId) {
        CLogger.debug('No imageId or projectId provided, skipping fetch.', { imageId, projectId });
        return;
      }

      CLogger.debug(`Fetching segmentation data for image ${imageId} in project ${projectId}`);

      try {
        setIsLoading(true);

        // Try multiple endpoints to get segmentation data
        let success = false;

        // Define endpoints to try - using the most reliable one first based on backend code
        const endpoints = [
          { name: 'Primary Endpoint', url: `/api/images/${imageId}/segmentation` },
          // Only try these if needed
          { name: 'Project Endpoint', url: `/api/projects/${projectId}/images/${imageId}/segmentation` },
          { name: 'Legacy Endpoint', url: `/api/segmentations/${imageId}` },
        ];

        // Try each endpoint
        for (const endpoint of endpoints) {
          if (success) break;

          try {
            const response = await apiClient.get<ApiResponse>(endpoint.url);

            let fetchedPolygons: InternalPolygon[] = []; // Explicitly typed
            let width: number | undefined;
            let height: number | undefined;

            // Check for polygons in different response formats
            if (response.data) {
              // Direct polygons array
              if (Array.isArray(response.data)) {
                const legacyData = response.data as LegacyListItem[];
                fetchedPolygons = legacyData.map(
                  (p: LegacyListItem): InternalPolygon => ({
                    id: p.id || `legacy-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                    points: p.points,
                    type: p.type || 'external',
                    class: p.class || p.label, // Use p.class if available, otherwise p.label
                    holes: p.holes,
                    legacyLabel: p.label, // Store original label if it exists
                    legacyScore: p.score, // Store original score if it exists
                    // metadata is optional in ApiPolygon, so it's fine if not present here
                  }),
                );
                CLogger.warn(
                  `Fetched legacy segmentation format from ${endpoint.name}. Original image dimensions not available from this endpoint.`,
                );
                // width and height remain undefined, will use imageSize from loaded image later
              }
              // Polygons in result_data
              else if (response.data.polygons && Array.isArray(response.data.polygons)) {
                const currentData = response.data as ApiSegmentationResult;
                fetchedPolygons = currentData.polygons.map(
                  (apiPoly: ApiPolygon): InternalPolygon => ({
                    ...apiPoly, // Spread all fields from ApiPolygon
                    // legacyLabel and legacyScore will be undefined here as ApiPolygon doesn't have them
                    // This is fine as they are optional in InternalPolygon
                  }),
                );
                width = currentData.imageWidth;
                height = currentData.imageHeight;
                CLogger.info(
                  `Fetched segmentation data from ${endpoint.name}. Polygons: ${fetchedPolygons.length}, API imageWidth: ${width}, API imageHeight: ${height}`,
                );
              }
            }

            if (fetchedPolygons.length > 0 || (endpoint.name && response.status === 200)) {
              // If we got a 200 OK with empty array, it's valid
              CLogger.info(`${endpoint.name} success, got ${fetchedPolygons.length} polygons for image ${imageId}`);

              // Process polygons - ensure each polygon has a type
              const processedPolygons = fetchedPolygons.map(
                (polygon): InternalPolygon => ({
                  ...polygon,
                  id: polygon.id || `poly-${Math.random().toString(36).substring(2, 9)}`,
                  type: polygon.type || 'external',
                }),
              );

              setSegmentationData({
                polygons: processedPolygons,
                imageWidth: width, // This might be undefined if legacy API was used
                imageHeight: height, // This might be undefined if legacy API was used
              });
              success = true;

              // If we have image dimensions in the response, use them
              if (width && height) {
                setImageSize({
                  width,
                  height,
                });
                CLogger.info(`Dimensions for image ${imageId} from API: ${width}x${height}`);
              } else {
                CLogger.warn(
                  `API for image ${imageId} returned polygons but no explicit imageWidth/imageHeight. Scaling might be inaccurate if thumbnail dimensions are used as original dimensions for full-res polygons.`,
                );
                // imageSize will be set by handleImageLoad or default if API doesn't provide them
              }

              // Break the loop since we found valid data
              break;
            } else {
              CLogger.info(`${endpoint.name} for image ${imageId} returned no valid polygons`);
            }
          } catch (error) {
            if (error instanceof Error) {
              CLogger.warn(`Error fetching from ${endpoint.name} for image ${imageId}:`, error.message);
            } else {
              CLogger.warn(`Unknown error fetching from ${endpoint.name} for image ${imageId}:`, error);
            }
          }
        }

        // If no real data was found, set empty polygons
        if (!success) {
          CLogger.info(`No segmentation data found for image ${imageId} after trying all endpoints.`);

          // Set empty polygons array
          setSegmentationData({ polygons: [] });

          // Set default image size if not already set by API (which it wouldn't be if success is false)
          if (!imageSize) {
            CLogger.info(`Setting default imageSize for ${imageId} as API provided no dimensions and no polygons.`);
            setImageSize({ width: 100, height: 100 });
          }
        }
      } catch (error) {
        if (error instanceof Error) {
          CLogger.error(`Error fetching segmentation data for image ${imageId}:`, error.message);
        } else {
          CLogger.error(`Unknown error fetching segmentation data for image ${imageId}:`, error);
        }

        // Don't create demo polygons in case of error either
        setSegmentationData({ polygons: [] });

        // Set default image size if not already set
        if (!imageSize) {
          CLogger.info(`Setting default imageSize for ${imageId} due to error in fetchSegmentationData.`);
          setImageSize({ width: 100, height: 100 });
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchSegmentationData();

    // Reason: imageSize is set internally based on image load or API response within this fetchSegmentationData effect.
    // Including imageSize as a dependency would cause an infinite loop of re-fetching
    // as setImageSize inside this effect would trigger the effect again.
    // projectId is included as it's essential for constructing the correct API endpoint and ensures
    // data is re-fetched if the project context changes for the same imageId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageId, projectId]);

  // Set image source
  useEffect(() => {
    if (thumbnailUrl) {
      CLogger.debug(`Attempting to use direct thumbnailUrl: ${thumbnailUrl}`);
      setImageSrc(thumbnailUrl);
      setTriedDirectUrl(true); // Mark that we've tried the direct URL
    } else if (imageId) {
      // && !thumbnailUrl implies we need to fetch
      CLogger.debug(`No thumbnailUrl, attempting to fetch blob for imageId: ${imageId}`);
      // Attempt to retrieve from local storage first
      const storedImage = localStorage.getItem(`thumbnail-${imageId}`);
      if (storedImage) {
        CLogger.debug(`Found cached blob URL for imageId: ${imageId}`);
        setImageSrc(storedImage);
        setTriedDirectUrl(false); // This wasn't a direct URL try, but a cache hit
        return; // Exit early if we found a cached image
      }
      // If not in local storage, fetch from API
      apiClient
        .get(`/api/images/${imageId}/thumbnail`, { responseType: 'blob' })
        .then((response) => {
          const blobUrl = URL.createObjectURL(response.data);
          CLogger.debug(`Fetched blob, created URL: ${blobUrl} for imageId: ${imageId}`);
          localStorage.setItem(`thumbnail-${imageId}`, blobUrl); // Cache the blob URL
          setImageSrc(blobUrl);
          setTriedDirectUrl(false); // Mark that we've fetched it
        })
        .catch((error) => {
          CLogger.error(`Error fetching thumbnail for ${imageId}:`, error);
          if (fallbackSrc) {
            CLogger.warn(`Falling back to placeholder for ${imageId}`);
            setImageSrc(fallbackSrc);
            setIsFallback(true);
          }
          setTriedDirectUrl(false); // Mark that we've tried and failed to fetch
        });
    } else if (fallbackSrc) {
      CLogger.debug(`No imageId or thumbnailUrl, using fallback directly.`);
      setImageSrc(fallbackSrc);
      setIsFallback(true);
      setTriedDirectUrl(false); // Not a direct URL try for the main image
    }

    // If imageSize is null, it means neither API nor image load has set it. Use component props.
    if (!imageSize && (width || height)) {
      CLogger.info(`imageSize is null, using default/prop width/height for initial imageSize`, { width, height });
      setImageSize({ width: width || 100, height: height || 100 });
    }
  }, [imageId, thumbnailUrl, fallbackSrc, width, height, imageSize]);

  // Handle image load to get dimensions if not provided
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (e.currentTarget) {
      const newImageSize = {
        width: e.currentTarget.naturalWidth,
        height: e.currentTarget.naturalHeight,
      };

      // Only update if the new size is different and valid,
      // and if we haven't already received dimensions from the API
      if (
        newImageSize.width > 0 &&
        newImageSize.height > 0 &&
        (!imageSize || // if imageSize is not set yet by API
          // Or if API didn't provide valid dimensions (width/height might be 0 or undefined from API response)
          // This condition checks if imageSize is not set OR if it was set but to invalid values (e.g. 0x0 or default 100x100 if API failed)
          (!(
            imageSize &&
            imageSize.width > 0 &&
            imageSize.height > 0 &&
            (imageSize.width !== 100 || imageSize.height !== 100)
          ) && // Avoid overwriting valid API dimensions (unless they were the default 100x100)
            (imageSize?.width !== newImageSize.width || imageSize?.height !== newImageSize.height))) // and new dimensions are different
      ) {
        CLogger.info(
          `Image ${imageId} loaded, natural dimensions: ${newImageSize.width}x${newImageSize.height}. API did not provide valid dimensions or they were default. Updating imageSize based on thumbnail.`,
        );
        setImageSize(newImageSize);
      } else if (imageSize && imageSize.width === newImageSize.width && imageSize.height === newImageSize.height) {
        CLogger.info(
          `Image ${imageId} loaded, natural dimensions match API/existing dimensions: ${newImageSize.width}x${newImageSize.height}. No update to imageSize needed.`,
        );
      } else {
        CLogger.info(
          `Image ${imageId} loaded, natural dimensions: ${newImageSize.width}x${newImageSize.height}. API/existing dimensions (${imageSize?.width}x${imageSize?.height}) will be preferred or already set.`,
        );
      }
    }
    setIsLoading(false); // Image element itself has loaded
  };

  // Effect to scale polygons when imageSize, containerRef, or segmentationData changes
  useEffect(() => {
    CLogger.debug('Scaling effect triggered. Deps:', {
      segmentationDataPolys: segmentationData?.polygons?.length,
      imageSize,
      offsetWidth: containerRef.current?.offsetWidth,
      offsetHeight: containerRef.current?.offsetHeight,
      width,
      height,
    });

    if (
      segmentationData && // Explicit check for segmentationData
      Array.isArray(segmentationData.polygons) && // Explicit check for polygons array
      segmentationData.polygons.length > 0 && // Now length check is safe
      imageSize &&
      imageSize.width > 0 &&
      imageSize.height > 0 &&
      containerRef.current
    ) {
      const containerWidth = containerRef.current.offsetWidth;
      const containerHeight = containerRef.current.offsetHeight;

      if (containerWidth === 0 || containerHeight === 0) {
        CLogger.warn('Container dimensions are zero, skipping scaling for now. Will re-evaluate on resize.');
        setScaledPolygons([]); // Clear polygons if container is not ready
        return;
      }

      CLogger.info('Scaling polygons with:', {
        polygonsCount: segmentationData.polygons.length, // Safe to access due to check above
        originalWidth: imageSize.width,
        originalHeight: imageSize.height,
        targetWidth: containerWidth,
        targetHeight: containerHeight,
      });

      const scaled = scalePolygons(
        segmentationData.polygons, // Safe to access
        imageSize.width,
        imageSize.height,
        containerWidth,
        containerHeight,
      );

      if (scaled && scaled.length > 0) {
        // Map scaled ApiPolygons to DisplayPolygons, adding color
        const displayPolygons: DisplayPolygon[] = scaled.map((poly) => ({
          ...poly,
          // Example color logic, can be refined based on poly.class or other props
          color: poly.type === 'internal' ? '#0000ff' : '#ff0000', // Blue for internal, red for external
        }));

        setScaledPolygons(displayPolygons);
      } else {
        setScaledPolygons([]); // Ensure scaledPolygons is an empty array if scaling results in no polygons
      }
    } else if (segmentationData && Array.isArray(segmentationData.polygons) && segmentationData.polygons.length === 0) {
      // Use optional chaining here too for consistency
      // If there are explicitly zero polygons, clear scaledPolygons
      CLogger.info('Segmentation data present but has zero polygons. Clearing scaled polygons.');
      setScaledPolygons([]);
    }
    // Do not clear if segmentationData is null/undefined yet, as it might still be loading
  }, [
    segmentationData,
    imageSize,
    // Using offsetWidth/Height as deps for resize handling
    containerRef.current?.offsetWidth,
    containerRef.current?.offsetHeight,
    width, // Prop width, for initial sizing if containerRef not ready
    height, // Prop height
  ]);

  // Handle image error
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    // Prevent infinite error loop
    if (isFallback) {
      e.preventDefault();
      return;
    }

    try {
      // Only try direct URL once, and only if we're not already showing fallback
      if (!triedDirectUrl && thumbnailUrl && !thumbnailUrl.startsWith('blob:')) {
        setTriedDirectUrl(true);

        const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
        const thumbnailPath =
          thumbnailUrl && thumbnailUrl.includes('uploads/')
            ? thumbnailUrl.substring(thumbnailUrl.indexOf('uploads/') + 8)
            : thumbnailUrl || '';

        // Only try backendUrl if thumbnailPath is valid
        if (thumbnailPath && thumbnailPath.length > 0) {
          const directPath = `${backendUrl}/uploads/${thumbnailPath}`;
          e.currentTarget.src = directPath;
          return;
        }
      }
    } catch (err) {
      CLogger.error('Error handling thumbnail fallback:', err);
    }

    // Set to fallback mode
    setIsFallback(true);
    setImageSrc(fallbackSrc);
  };

  // Only log state when debugging is needed
  if (segmentationData && Array.isArray(segmentationData.polygons) && segmentationData.polygons.length > 0) {
    CLogger.debug(`Rendering state:`, {
      imageId,
      hasSegmentationData: !!segmentationData,
      polygonsCount: segmentationData.polygons.length, // Use optional chaining
      scaledPolygonsCount: scaledPolygons?.length || 0,
    });
  }

  const showNoSegmentationMessage =
    !isLoading &&
    segmentationData &&
    Array.isArray(segmentationData.polygons) &&
    segmentationData.polygons.length === 0;

  // Render the image and SVG overlay
  // Note: viewBox might need adjustment if aspect ratios differ significantly
  // and we want to maintain polygon aspect ratio relative to the image content.
  // Current setup assumes image fills the container, and polygons are scaled to that container.
  return (
    <div ref={containerRef} className={`relative ${className}`} style={{ width: `${width}px`, height: `${height}px` }}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 opacity-50">
          <p>Loading Seg...</p>
        </div>
      )}
      <img
        src={imageSrc || (isFallback ? fallbackSrc : '/transparent.png')} // Use transparent png if still no src and not yet fallback
        alt={altText}
        onLoad={handleImageLoad}
        onError={handleImageError}
        className="object-contain w-full h-full"
        style={{ display: isLoading && !imageSrc ? 'none' : 'block' }} // Hide broken image icon during load
      />
      {/* Render polygons only if scaledPolygons exist and have items */}
      {scaledPolygons && scaledPolygons.length > 0 ? (
        <svg
          className="absolute top-0 left-0 w-full h-full"
          viewBox={`0 0 ${containerRef.current?.offsetWidth || width} ${containerRef.current?.offsetHeight || height}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {scaledPolygons.map((polygon) => (
            <path
              key={polygon.id}
              d={createSvgPath(polygon.points, polygon.holes)}
              fill={polygon.color || 'rgba(255, 0, 0, 0.3)'} // Fallback color if somehow not set
              stroke={polygon.color ? darkenColor(polygon.color, 30) : 'rgba(200,0,0,0.7)'}
              strokeWidth="1"
              vectorEffect="non-scaling-stroke" // Ensures consistent stroke width regardless of scaling
            />
          ))}
        </svg>
      ) : (
        showNoSegmentationMessage && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs text-gray-500 p-1 bg-white bg-opacity-75 rounded">No seg</p>
          </div>
        )
      )}
      {/* Fallback text if everything fails */}
      {isFallback && imageSrc === fallbackSrc && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-xs text-red-500">Image N/A</p>
        </div>
      )}
    </div>
  );
};

export default SegmentationThumbnail;
