import React, { useEffect, useState, useRef } from 'react';
import apiClient from '@/lib/apiClient';
import { scalePolygons, createSvgPath } from '@/lib/svgUtils';
import logger from '@/utils/logger';

// Simple in-memory cache for segmentation data
const segmentationCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface Point {
  x: number;
  y: number;
}

interface Polygon {
  id: string;
  points: Point[];
  type?: string;
  class?: string;
  holes?: Point[][];
}

interface SegmentationData {
  polygons: Polygon[];
  imageWidth?: number;
  imageHeight?: number;
}

interface DebugSegmentationThumbnailProps {
  imageId: string;
  projectId: string;
  width: number;
  height: number;
}

const DebugSegmentationThumbnail: React.FC<DebugSegmentationThumbnailProps> = ({
  imageId,
  projectId,
  width,
  height,
}) => {
  const [segmentationData, setSegmentationData] = useState<SegmentationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchSegmentation = async () => {
      // Check cache first
      const cacheKey = `${projectId}-${imageId}`;
      const cached = segmentationCache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        setSegmentationData(cached.data);
        setIsLoading(false);
        return;
      }

      try {
        // First, try to get the original image dimensions from the image API
        let originalWidth = 0;
        let originalHeight = 0;

        try {
          const imageResponse = await apiClient.get(`/api/projects/${projectId}/images/${imageId}`);
          if (imageResponse.data && imageResponse.data.width && imageResponse.data.height) {
            originalWidth = imageResponse.data.width;
            originalHeight = imageResponse.data.height;
          }
        } catch (imageErr) {
          // Silently ignore - will try to get dimensions from segmentation data
        }

        // Then get the segmentation data
        const response = await apiClient.get(`/api/images/${imageId}/segmentation`);

        // Check if segmentation data includes dimensions
        if (response.data && response.data.result_data) {
          if (response.data.result_data.imageWidth && response.data.result_data.imageHeight) {
            // Use these dimensions if we didn't get them from the image API
            if (originalWidth === 0 || originalHeight === 0) {
              originalWidth = response.data.result_data.imageWidth;
              originalHeight = response.data.result_data.imageHeight;
            }
          }
        }

        // Set the dimensions in the segmentation data
        const segData = {
          ...response.data,
          imageWidth: originalWidth || response.data.imageWidth,
          imageHeight: originalHeight || response.data.imageHeight,
          polygons: response.data.polygons || (response.data.result_data ? response.data.result_data.polygons : []),
        };

        // Cache the result
        segmentationCache.set(cacheKey, { data: segData, timestamp: Date.now() });

        setSegmentationData(segData);
        setIsLoading(false);
      } catch (err: unknown) {
        // Only set error for non-429 errors or show nothing for rate limits
        if (err?.response?.status === 429) {
          // Don't show error for rate limiting, just hide the component
          setError(null);
        } else {
          logger.error('Failed to load segmentation:', err);
          setError('Failed to load segmentation');
        }
        setIsLoading(false);
      }
    };

    fetchSegmentation();
  }, [imageId, projectId]);

  // Don't render anything if rate limited or error
  if (error || (!segmentationData && !isLoading)) {
    return null;
  }

  // Don't render loading state - just return null
  if (!segmentationData) {
    return null;
  }

  // Use available dimensions from the API or fallback to defaults
  // We should have the original image dimensions from our API calls
  const originalWidth = segmentationData.imageWidth || 800;
  const originalHeight = segmentationData.imageHeight || 600;

  // Get container dimensions or use props
  const containerWidth = containerRef.current?.offsetWidth || width;
  const containerHeight = containerRef.current?.offsetHeight || height;

  // Scale polygons using the same function as SegmentationThumbnail
  const scaledPolygons = scalePolygons(
    segmentationData.polygons,
    originalWidth,
    originalHeight,
    containerWidth,
    containerHeight,
  );

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
      <svg
        width="100%"
        height="100%"
        style={{ display: 'block' }}
        viewBox={`0 0 ${containerWidth} ${containerHeight}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {scaledPolygons.map((polygon, index) => {
          // Skip invalid polygons
          if (!polygon.points || polygon.points.length < 3) {
            return null;
          }

          // Determine color based on polygon type (external=red, internal=blue)
          const isInternal = polygon.type === 'internal' || polygon.class === 'hole';
          const fillColor = isInternal ? '#0000ff' : '#ff0000';
          const strokeColor = isInternal ? '#0000ff' : '#ff0000';

          // Use the createSvgPath utility from svgUtils
          const svgPath =
            polygon.holes && polygon.holes.length > 0
              ? createSvgPath(polygon.points, polygon.holes)
              : createSvgPath(polygon.points);

          // Always use path for consistency
          return (
            <path
              key={polygon.id || `polygon-${index}`}
              d={svgPath}
              fill={fillColor}
              fillOpacity={0.5}
              stroke={strokeColor}
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke" // Ensures consistent stroke width regardless of scaling
            />
          );
        })}
      </svg>
    </div>
  );
};

export default DebugSegmentationThumbnail;
