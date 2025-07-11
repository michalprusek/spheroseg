import React from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { Trash, Copy } from 'lucide-react';
import { useTranslations } from '@/hooks/useTranslations';

interface VertexContextMenuProps {
  children: React.ReactNode;
  onDelete: () => void;
  onDuplicate: () => void;
  vertexIndex: number;
  polygonId: string;
}

const VertexContextMenu = ({ children, onDelete, onDuplicate, vertexIndex, polygonId }: VertexContextMenuProps) => {
  const { t } = useTranslations();

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        <ContextMenuItem onClick={onDuplicate} className="cursor-pointer">
          <Copy className="mr-2 h-4 w-4" />
          <span>{t('segmentation.contextMenu.duplicateVertex')}</span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onDelete} className="cursor-pointer text-red-600">
          <Trash className="mr-2 h-4 w-4" />
          <span>{t('segmentation.contextMenu.deleteVertex')}</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

export default VertexContextMenu;
