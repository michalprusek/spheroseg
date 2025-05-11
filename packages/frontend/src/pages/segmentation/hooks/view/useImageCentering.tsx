import { useCallback } from 'react';

/**
 * Hook for centering the image in the canvas
 */
export const useImageCentering = (
  canvasContainerRef: React.RefObject<HTMLDivElement>,
  imageSrc: string,
  imageRef: React.MutableRefObject<HTMLImageElement | null>,
  setZoom: (zoom: number) => void,
  setOffset: (offset: { x: number; y: number }) => void,
  MIN_ZOOM: number,
  MAX_ZOOM: number,
) => {
  // Center the image in the canvas with size adjustment
  const centerImage = useCallback(() => {
    if (!canvasContainerRef.current || !imageSrc) return;

    const container = canvasContainerRef.current;
    const containerRect = container.getBoundingClientRect();

    const img = new Image();
    img.src = imageSrc;
    imageRef.current = img;

    img.onload = () => {
      const containerWidth = containerRect.width;
      const containerHeight = containerRect.height;

      // Calculate aspect ratios
      const imgRatio = img.width / img.height;
      const containerRatio = containerWidth / containerHeight;

      // Calculate new size while maintaining aspect ratio
      let newZoom = 1;

      // Always fit to container so the entire image fits in the canvas
      if (imgRatio > containerRatio) {
        // Image is wider than container - limit by width
        newZoom = (containerWidth * 0.8) / img.width;
      } else {
        // Image is taller than container - limit by height
        newZoom = (containerHeight * 0.8) / img.height;
      }

      // Limit zoom for very small or very large images
      newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));

      // Precise centering - calculate offset to center the image
      // This places the image exactly in the center of the canvas
      // For CSS transform: translate(${offset.x * zoom}px, ${offset.y * zoom}px) scale(${zoom})
      // We need to calculate offset in image coordinates
      const centerOffsetX = containerWidth / 2 / newZoom - img.width / 2;
      const centerOffsetY = containerHeight / 2 / newZoom - img.height / 2;

      // Alternative calculation for verification
      const altCenterOffsetX = (containerWidth - img.width * newZoom) / (2 * newZoom);
      const altCenterOffsetY = (containerHeight - img.height * newZoom) / (2 * newZoom);

      // Log centering calculations for debugging
      console.log('[CENTER IMAGE] Centering calculations:', {
        containerSize: { width: containerWidth, height: containerHeight },
        imageSize: { width: img.width, height: img.height },
        newZoom,
        centerOffset: { x: centerOffsetX, y: centerOffsetY },
        altCenterOffset: { x: altCenterOffsetX, y: altCenterOffsetY },
        imageCenter: { x: img.width / 2, y: img.height / 2 },
        containerCenter: { x: containerWidth / 2, y: containerHeight / 2 },
      });

      // Verify the centering calculation
      const imageCenterX = img.width / 2;
      const imageCenterY = img.height / 2;
      const screenCenterX = containerWidth / 2;
      const screenCenterY = containerHeight / 2;

      // Calculate where the image center would be on screen with this offset
      const imageCenterOnScreenX = (imageCenterX + centerOffsetX) * newZoom;
      const imageCenterOnScreenY = (imageCenterY + centerOffsetY) * newZoom;

      console.log('[CENTER IMAGE] Verification:', {
        imageCenterOnScreen: {
          x: imageCenterOnScreenX,
          y: imageCenterOnScreenY,
        },
        screenCenter: { x: screenCenterX, y: screenCenterY },
        difference: {
          x: Math.abs(imageCenterOnScreenX - screenCenterX),
          y: Math.abs(imageCenterOnScreenY - screenCenterY),
        },
      });

      setZoom(newZoom);
      setOffset({ x: centerOffsetX, y: centerOffsetY });
    };
  }, [canvasContainerRef, imageSrc, imageRef, setZoom, setOffset, MIN_ZOOM, MAX_ZOOM]);

  return { centerImage };
};
