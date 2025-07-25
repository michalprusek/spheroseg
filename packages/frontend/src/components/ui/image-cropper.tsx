import React, { useState, useRef, useEffect } from 'react';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Button } from '@/components/ui/button';
import { RotateCw, Check } from 'lucide-react';

interface ImageCropperProps {
  src: string;
  aspectRatio?: number | 'square';
  cropShape?: 'rect' | 'round';
  showControls?: boolean;
  showZoom?: boolean;
  showRotation?: boolean;
  minZoom?: number;
  maxZoom?: number;
  onComplete: (data: { croppedImageData: string }) => void;
}

const ImageCropper: React.FC<ImageCropperProps> = ({
  src,
  aspectRatio = 1,
  cropShape = 'rect',
  showControls = true,
  showZoom = false,
  showRotation = false,
  minZoom = 1,
  maxZoom = 3,
  onComplete,
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    width: 80,
    height: 80,
    x: 10,
    y: 10,
  });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [rotation, setRotation] = useState<number>(0);

  // Set aspect ratio
  useEffect(() => {
    const ratio = aspectRatio === 'square' ? 1 : aspectRatio;
    setCrop((prev) => ({
      ...prev,
      aspect: ratio,
    }));
  }, [aspectRatio]);

  // Handle rotation
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Generate cropped image
  const generateCroppedImage = () => {
    if (!imgRef.current) return;

    // Use completedCrop if available, otherwise use default crop
    const cropToUse = completedCrop || {
      x: crop.x,
      y: crop.y,
      width: crop.width,
      height: crop.height,
      unit: 'px' as const,
    };

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const image = imgRef.current;
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // Calculate pixel crop values if crop is in percentage
    let pixelCrop = cropToUse;
    if (crop.unit === '%') {
      pixelCrop = {
        x: (crop.x / 100) * image.width,
        y: (crop.y / 100) * image.height,
        width: (crop.width / 100) * image.width,
        height: (crop.height / 100) * image.height,
        unit: 'px' as const,
      };
    }

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    // Apply rotation if needed
    if (rotation > 0) {
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);
    }

    // Draw the cropped image
    ctx.drawImage(
      image,
      pixelCrop.x * scaleX,
      pixelCrop.y * scaleY,
      pixelCrop.width * scaleX,
      pixelCrop.height * scaleY,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height,
    );

    if (rotation > 0) {
      ctx.restore();
    }

    // Convert to data URL
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    onComplete({ croppedImageData: dataUrl });
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative">
        <div className="relative max-w-full overflow-hidden">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={aspectRatio === 'square' ? 1 : aspectRatio}
            circularCrop={cropShape === 'round'}
          >
            <img
              ref={imgRef}
              src={src}
              alt="Crop preview"
              style={{
                transform: `rotate(${rotation}deg)`,
                maxWidth: '100%',
                transition: 'transform 0.3s ease',
              }}
            />
          </ReactCrop>
        </div>

        {/* Rotate button positioned absolutely in top-right corner */}
        {showRotation && (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={handleRotate}
            className="absolute top-2 right-2 bg-white/80 dark:bg-gray-800/80 hover:bg-white/90 dark:hover:bg-gray-800/90 backdrop-blur-sm shadow-md"
            title="Rotate image"
          >
            <RotateCw className="h-4 w-4" />
          </Button>
        )}
      </div>

      {showControls && (
        <div className="w-full">
          <Button type="button" onClick={generateCroppedImage} className="w-full">
            <Check className="mr-2 h-4 w-4" />
            Apply Changes
          </Button>
        </div>
      )}
    </div>
  );
};

export default ImageCropper;
