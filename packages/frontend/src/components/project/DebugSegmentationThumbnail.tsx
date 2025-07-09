import React, { useEffect, useState, useRef } from 'react';
import apiClient from '@/lib/apiClient';
import { scalePolygons, createSvgPath } from '@/lib/svgUtils';
import { createNamespacedLogger } from '@/utils/logger';

const CLogger = createNamespacedLogger('DebugSegmentationThumbnail');

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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchSegmentation = async () => {
      try {
        console.log(`[DEBUG] Fetching segmentation for image ${imageId} in project ${projectId}`);

        // First, try to get the original image dimensions from the image API
        let originalWidth = 0;
        let originalHeight = 0;

        try {
          const imageResponse = await apiClient.get(`/api/projects/${projectId}/images/${imageId}`);
          if (imageResponse.data && imageResponse.data.width && imageResponse.data.height) {
            originalWidth = imageResponse.data.width;
            originalHeight = imageResponse.data.height;
            console.log('[DEBUG] Got original image dimensions from image API:', {
              width: originalWidth,
              height: originalHeight,
            });
          }
        } catch (imageErr) {
          console.warn('[DEBUG] Could not get image dimensions from image API:', imageErr);
        }

        // Then get the segmentation data
        const response = await apiClient.get(`/api/images/${imageId}/segmentation`);
        console.log('[DEBUG] Segmentation API response:', response.data);

        // Check if segmentation data includes dimensions
        if (response.data && response.data.result_data) {
          if (response.data.result_data.imageWidth && response.data.result_data.imageHeight) {
            console.log('[DEBUG] API provided image dimensions in result_data:', {
              width: response.data.result_data.imageWidth,
              height: response.data.result_data.imageHeight,
            });

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

        console.log('[DEBUG] Final segmentation data with dimensions:', {
          imageWidth: segData.imageWidth,
          imageHeight: segData.imageHeight,
          polygonsCount: segData.polygons ? segData.polygons.length : 0,
        });

        setSegmentationData(segData);
      } catch (err) {
        console.error('[DEBUG] Error fetching segmentation:', err);
        setError('Failed to load segmentation data');
      }
    };

    fetchSegmentation();
  }, [imageId, projectId]);

  if (error) {
    console.log('[DEBUG] Rendering error state');
    return <div style={{ color: 'red' }}>{error}</div>;
  }

  if (!segmentationData) {
    console.log('[DEBUG] Rendering loading state');
    return <div>Loading segmentation data...</div>;
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

  CLogger.debug('Rendering polygons with dimensions:', {
    originalWidth,
    originalHeight,
    containerWidth,
    containerHeight,
    polygonsCount: segmentationData.polygons.length,
    scaledPolygonsCount: scaledPolygons.length,
  });

  // Log first polygon for debugging
  if (segmentationData.polygons.length > 0) {
    const firstPoly = segmentationData.polygons[0];
    CLogger.debug('First polygon sample:', {
      id: firstPoly.id,
      type: firstPoly.type,
      class: firstPoly.class,
      pointCount: firstPoly.points.length,
      firstPoint: firstPoly.points[0],
      hasHoles: firstPoly.holes && firstPoly.holes.length > 0,
    });
  }

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

          CLogger.debug(`Polygon ${index}:`, {
            id: polygon.id,
            type: polygon.type || 'external',
            class: polygon.class,
            pointCount: polygon.points.length,
            hasHoles: polygon.holes && polygon.holes.length > 0,
          });

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
