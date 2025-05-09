import React from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ProjectImage } from '@spheroseg/types';
import { Badge } from '@/components/ui/badge';
import ImageActions from './ImageActions';
import { constructUrl } from '@/lib/urlUtils';

interface ImageCardProps {
  image: ProjectImage;
  onDelete: (imageId: string) => void;
  onOpen?: (imageId: string) => void;
  onResegment: (imageId: string) => void;
  className?: string;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (event?: React.MouseEvent) => void;
}

export const ImageCard = ({
  image,
  onDelete,
  onOpen,
  onResegment,
  className,
  selectionMode = false,
  isSelected = false,
  onToggleSelection
}: ImageCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      layout
    >
      <Card
        className={cn(
          "overflow-hidden border-gray-200 dark:border-gray-700 transition-all group hover:shadow-md relative",
          isSelected ? "ring-2 ring-blue-500" : "",
          className
        )}
        onClick={(e) => {
          if (selectionMode) {
            onToggleSelection?.(e);
          } else if (onOpen) {
            onOpen(image.id);
          }
        }}
      >
        {/* Selection checkbox or actions */}
        {selectionMode ? (
          <div className="absolute top-2 right-2 z-10">
            <div onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => onToggleSelection?.(e.nativeEvent)}
                className="h-5 w-5 rounded border-gray-300"
              />
            </div>
          </div>
        ) : (
          <ImageActions
            onDelete={() => onDelete(image.id)}
            onResegment={() => onResegment(image.id)}
          />
        )}

        {/* Image preview - clickable to open segmentation editor */}
        <div
          className="aspect-square bg-gray-100 dark:bg-gray-800 relative overflow-hidden cursor-pointer"
        >
          {image.thumbnail_url ? (
            <img
              src={constructUrl(image.thumbnail_url)}
              alt={image.name || 'Image'}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={(e) => {
                console.error(`Failed to load thumbnail: ${image.thumbnail_url}`);
                try {
                  // Try with direct URL to backend including port
                  const backendUrl = import.meta.env.VITE_API_URL || 'http://backend:5001';
                  const directPath = `${backendUrl}/uploads/${image.thumbnail_url?.replace(/^.*uploads\//, '')}`;
                  console.log(`Trying direct backend URL: ${directPath}`);
                  e.currentTarget.src = directPath;
                } catch (err) {
                  // Fallback to original image if thumbnail fails
                  if (image.url) {
                    e.currentTarget.src = constructUrl(image.url);
                  } else {
                    e.currentTarget.src = '/placeholder.svg';
                  }
                }
              }}
            />
          ) : image.url ? (
            <img
              src={constructUrl(image.url)}
              alt={image.name || 'Image'}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-700">
              <span className="text-gray-400 dark:text-gray-500">No preview</span>
            </div>
          )}

          {/* Status badge */}
          <Badge className={cn(
            "absolute bottom-2 left-2",
            image.segmentationStatus === 'completed'
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
              : image.segmentationStatus === 'processing'
              ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100"
              : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100"
          )}>
            {image.segmentationStatus === 'completed' ? 'Zpracováno' :
             image.segmentationStatus === 'processing' ? 'Zpracovává se' : 'Čeká'}
          </Badge>
        </div>

        <CardContent className="p-3">
          <div className="truncate">
            <h3 className="font-medium text-sm truncate" title={image.name || 'Image'}>
              {image.name || 'Image'}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {image.createdAt && format(image.createdAt, 'PPP')}
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
