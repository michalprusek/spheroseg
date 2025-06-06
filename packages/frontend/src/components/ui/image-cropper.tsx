import React, { useState, useRef, useEffect } from 'react';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { RotateCw, ZoomIn, ZoomOut, Check } from 'lucide-react';

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
    width: 90,
    height: 90,
    x: 5,
    y: 5,
  });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);

  // Set aspect ratio
  useEffect(() => {
    const ratio = aspectRatio === 'square' ? 1 : aspectRatio;
    setCrop((prev) => ({
      ...prev,
      aspect: ratio,
    }));
  }, [aspectRatio]);

  // Handle zoom change
  const handleZoomChange = (value: number[]) => {
    setZoom(value[0]);
  };

  // Handle rotation
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Generate cropped image
  const generateCroppedImage = () => {
    if (!imgRef.current || !completedCrop) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const image = imgRef.current;
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;

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
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height,
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
      <div
        className="relative max-w-full overflow-hidden"
        style={{
          transform: `scale(${zoom})`,
          transition: 'transform 0.3s ease',
        }}
      >
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

      {showControls && (
        <div className="w-full space-y-4">
          {showZoom && (
            <div className="flex items-center space-x-4">
              <ZoomOut className="h-4 w-4 text-gray-500" />
              <Slider
                value={[zoom]}
                min={minZoom}
                max={maxZoom}
                step={0.1}
                onValueChange={handleZoomChange}
                className="flex-1"
              />
              <ZoomIn className="h-4 w-4 text-gray-500" />
            </div>
          )}

          {showRotation && (
            <Button type="button" variant="outline" size="sm" onClick={handleRotate} className="flex items-center">
              <RotateCw className="mr-2 h-4 w-4" />
              Rotate
            </Button>
          )}

          <Button type="button" onClick={generateCroppedImage} className="w-full">
            <Check className="mr-2 h-4 w-4" />
            Apply Crop
          </Button>
        </div>
      )}
    </div>
  );
};

export default ImageCropper;
