import React from 'react';
import { Trash2, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/useTranslations';

interface ImageActionsProps {
  onDelete: () => void;
  onResegment?: () => void;
  isProcessing?: boolean;
}

const ImageActions = ({ onDelete, onResegment, isProcessing = false }: ImageActionsProps) => {
  const { t } = useTranslations();

  return (
    <div className="absolute top-2 right-2 z-10 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
      {onResegment && (
        <Button
          variant="info"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => {
            e.stopPropagation();
            if (!isProcessing) {
              onResegment();
            }
          }}
          disabled={isProcessing}
          title={isProcessing ? t('segmentation.processingImage') : t('project.resegmentImage')}
        >
          <RefreshCcw className={`h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`} />
        </Button>
      )}
      <Button
        variant="destructive"
        size="icon"
        className="h-7 w-7"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        disabled={isProcessing}
        title={t('project.deleteImage')}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default ImageActions;
