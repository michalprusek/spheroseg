import React from 'react';
import { Trash2, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageListActionsProps {
  onDelete: () => void;
  onResegment?: () => void;
}

const ImageListActions = ({ onDelete, onResegment }: ImageListActionsProps) => {
  return (
    <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
      {onResegment && (
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => {
            e.stopPropagation();
            onResegment();
          }}
          title="Opětovná segmentace"
        >
          <RefreshCcw className="h-4 w-4" />
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
        title="Smazat obrázek"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default ImageListActions;
