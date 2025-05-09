
import React from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ProjectImage } from '@/types';
import { Badge } from '@/components/ui/badge';
import ImageListActions from './ImageListActions';
import { useLanguage } from '@/contexts/LanguageContext';
import { constructUrl } from '@/lib/urlUtils';

interface ImageListItemProps {
  image: ProjectImage;
  onDelete: (imageId: string) => void;
  onOpen?: (imageId: string) => void;
  onResegment?: (imageId: string) => void;
  className?: string;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (event?: React.MouseEvent) => void;
}

export const ImageListItem = ({
  image,
  onDelete,
  onOpen,
  onResegment,
  className,
  selectionMode = false,
  isSelected = false,
  onToggleSelection
}: ImageListItemProps) => {
  const { t } = useLanguage();
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      layout
      className={cn(
        'flex items-center p-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-750 group',
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
      {/* Thumbnail */}
      <div
        className="h-10 w-10 rounded overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0 cursor-pointer"
      >
        {image.thumbnail_url ? (
          <img
            src={constructUrl(image.thumbnail_url)}
            alt={image.name || 'Image'}
            className="h-full w-full object-cover"
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
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <span className="text-xs text-gray-400">{t('imageStatus.noImage')}</span>
          </div>
        )}
      </div>

      {/* Image details */}
      <div className="ml-3 flex-1 min-w-0 cursor-pointer">
        <div className="flex items-center">
          <h4 className="text-sm font-medium truncate">
            {image.name || t('imageStatus.untitledImage')}
          </h4>
          {image.segmentationStatus && (
            <Badge
              variant="outline"
              className={cn(
                'ml-2 text-xs',
                image.segmentationStatus === 'completed'
                  ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/40'
                  : image.segmentationStatus === 'processing'
                  ? 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/40'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              )}
            >
              {image.segmentationStatus === 'completed'
                ? t('imageStatus.completed')
                : image.segmentationStatus === 'processing'
                ? t('imageStatus.processing')
                : t('imageStatus.pending')}
            </Badge>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {image.createdAt && format(image.createdAt, 'PPP')}
        </p>
      </div>

      {/* Selection checkbox or actions */}
      <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        {selectionMode ? (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onToggleSelection?.(e.nativeEvent)}
            className="h-5 w-5 rounded border-gray-300"
          />
        ) : (
          <ImageListActions
            onDelete={() => onDelete(image.id)}
            onResegment={() => onResegment?.(image.id)}
          />
        )}
      </div>
    </motion.div>
  );
};
