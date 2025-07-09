import React, { useEffect } from 'react';
import useImageLoader from '@/hooks/useImageLoader';
import { createNamespacedLogger } from '@/utils/logger';

const logger = createNamespacedLogger('segmentation:canvas:imageLayer');

interface ImageData {
  width: number;
  height: number;
  src: string;
  alternativeUrls?: string[];
}

interface CanvasImageLayerProps {
  imageData: ImageData | null;
  transform: { zoom: number };
}

const CanvasImageLayer: React.FC<CanvasImageLayerProps> = ({
  imageData,
  transform,
}) => {
  // Use a stable cache buster based on image data, not current time
  const [stableCacheBuster] = React.useState(() => Date.now());
  
  const {
    image,
    isLoading: isImageLoading,
    error: imageError,
  } = useImageLoader(imageData?.src || null, {
    crossOrigin: 'anonymous',
    cacheBuster: false, // Disable automatic cache busting
    maxRetries: 5,
    timeout: 60000,
    alternativeUrls: imageData?.alternativeUrls || [],
  });

  useEffect(() => {
    if (!imageData) {
      logger.debug('No image data provided');
      return;
    }

    if (isImageLoading) {
      logger.debug(`Loading image: ${imageData.src}`);
    } else if (imageError) {
      logger.error(`Failed to load image: ${imageData.src}`, imageError);
    } else if (image) {
      logger.info(`Image loaded successfully: ${imageData.src} (${image.width}x${image.height})`);
    }
  }, [imageData, image, isImageLoading, imageError]);

  return (
    <>
      {imageData && image && (
        <image
          href={image.src}
          x="0"
          y="0"
          width={imageData.width}
          height={imageData.height}
          style={{ imageRendering: 'pixelated' }} // Preserve pixels on zoom
        />
      )}

      {imageData && (isImageLoading || !image) && (
        <g>
          <rect x="0" y="0" width={imageData.width} height={imageData.height} fill="#333" />
          <text
            x={imageData.width / 2}
            y={imageData.height / 2}
            fill="white"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={20 / transform.zoom}
          >
            Načítání obrázku...
          </text>
        </g>
      )}

      {imageData && imageError && (
        <g>
          <rect x="0" y="0" width={imageData.width} height={imageData.height} fill="#500" opacity={0.7} />
          <text
            x={imageData.width / 2}
            y={imageData.height / 2}
            fill="white"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={20 / transform.zoom}
          >
            Chyba při načítání obrázku
          </text>
        </g>
      )}

      {!imageData && (
        <g>
          <rect x="0" y="0" width={800} height={600} fill="#333" />
          <text
            x="400"
            y="300"
            fill="white"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={20 / transform.zoom}
          >
            Nepodařilo se načíst data obrázku
          </text>
          <text
            x="400"
            y="330"
            fill="white"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={16 / transform.zoom}
          >
            Zkuste to znovu nebo kontaktujte správce systému
          </text>
        </g>
      )}
    </>
  );
};

CanvasImageLayer.displayName = 'CanvasImageLayer';

export default CanvasImageLayer;
