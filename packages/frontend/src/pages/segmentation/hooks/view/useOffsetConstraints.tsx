import { useCallback } from 'react';

/**
 * Hook pro omezení posunu obrázku, aby nevyjel z canvasu
 * Pracuje s offset jako souřadnicemi světa (world coordinates).
 */
export const useOffsetConstraints = (
  canvasContainerRef: React.RefObject<HTMLDivElement>,
  imageRef: React.MutableRefObject<HTMLImageElement | null>
) => {
  const constrainOffset = useCallback((newOffset: { x: number; y: number }, currentZoom: number) => {
    if (!canvasContainerRef.current || !imageRef.current || currentZoom <= 0) {
        console.warn("Cannot constrain offset: missing refs or invalid zoom");
        return newOffset; 
    }
    
    const container = canvasContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    const img = imageRef.current;
    
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    
    if (containerWidth <= 0 || containerHeight <= 0) {
        console.warn("Cannot constrain offset: invalid container dimensions");
        return newOffset; 
    }
    
    const imgWidth = img.width;
    const imgHeight = img.height;
    
    // Min visible portion (e.g., 25% of the image must be visible ON SCREEN)
    const minVisiblePortion = 0.25; 

    // Viewport size in world coordinates
    const viewportWidthWorld = containerWidth / currentZoom;
    const viewportHeightWorld = containerHeight / currentZoom;

    // --- Corrected Min/Max Calculation for World Offset --- 

    // Minimum X offset:
    // Prevents the image's right edge from going too far left relative to the viewport's right edge.
    // The right edge of the image (in world coords relative to viewport left) is offset.x + imgWidth.
    // The right edge of the viewport (in world coords relative to viewport left) is viewportWidthWorld.
    // We want: offset.x + imgWidth >= viewportWidthWorld * minVisiblePortion 
    // (Right edge of image must be at least minVisiblePortion screen width from left edge of viewport)
    // Alternative view: screen_coord(img_right) >= screen_coord(viewport_right) - screen_coord(viewport_width) * (1 - minVisiblePortion)
    // (offset.x + imgWidth) * currentZoom >= containerWidth * minVisiblePortion
    const minX = (containerWidth * minVisiblePortion / currentZoom) - imgWidth;
    // Also ensure left edge doesn't go beyond viewport right edge
    // offset.x <= viewportWidthWorld
    const minX_alt = viewportWidthWorld - imgWidth; // Ensure right edge is at least at viewport right edge
    // This simpler constraint might be enough: ensure right image edge >= viewport right edge
    // const minX = viewportWidthWorld - imgWidth;

    // Maximum X offset:
    // Prevents the image's left edge from going too far right relative to the viewport's left edge.
    // The left edge of the image (world coords) is offset.x.
    // The left edge of the viewport (world coords) is 0.
    // We want: offset.x <= viewportWidthWorld * (1 - minVisiblePortion)
    // (Left edge of image must be at most (1 - minVisiblePortion) screen width from left edge of viewport)
    // Alternative view: screen_coord(img_left) <= containerWidth * (1 - minVisiblePortion)
    // offset.x * currentZoom <= containerWidth * (1 - minVisiblePortion)
    const maxX = (containerWidth * (1 - minVisiblePortion)) / currentZoom;
    // Also ensure right edge doesn't go beyond viewport left edge
    // offset.x + imgWidth >= 0 => offset.x >= -imgWidth
    const maxX_alt = 0; // Ensure left edge is at most at viewport left edge
    // This simpler constraint might be enough: ensure left image edge <= viewport left edge
    // const maxX = 0; 

    // Minimum Y offset (similar logic to X)
    const minY = (containerHeight * minVisiblePortion / currentZoom) - imgHeight;
    // const minY = viewportHeightWorld - imgHeight; // Simpler: bottom edge >= viewport bottom

    // Maximum Y offset (similar logic to X)
    const maxY = (containerHeight * (1 - minVisiblePortion)) / currentZoom;
    // const maxY = 0; // Simpler: top edge <= viewport top

    // Clamp the new offset
    // Use the corrected min/max values
    return {
      x: Math.min(Math.max(newOffset.x, minX), maxX),
      y: Math.min(Math.max(newOffset.y, minY), maxY)
    };
  }, [canvasContainerRef, imageRef]);

  return { constrainOffset };
};
