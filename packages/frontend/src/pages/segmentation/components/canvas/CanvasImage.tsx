import React from 'react';
import { cn } from '@/lib/utils';
import { constructUrl } from '@/lib/urlUtils';

interface CanvasImageProps {
  src: string;
  alt?: string;
  loading?: boolean;
}

/**
 * Komponenta pro zobrazení podkladového obrázku na plátně
 */
const CanvasImage = ({ src, alt = "Image to segment", loading = true }: CanvasImageProps): JSX.Element => {
  // Process the URL to ensure it's correctly formatted
  const processedSrc = constructUrl(src);

  // Always render as SVG <image> for SVG context
  return (
    <image
      href={processedSrc}
      x={0}
      y={0}
      width="100%"
      height="100%"
      style={{ imageRendering: "crisp-edges" }}
      data-testid="canvas-image"
    />
  );
};

export default CanvasImage;
