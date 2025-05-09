
import React, { useCallback } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator
} from '@/components/ui/context-menu';
import { Trash, Scissors, Edit } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface PolygonContextMenuProps {
  children: React.ReactNode;
  onDelete: () => void;
  onSlice: () => void;
  onEdit: () => void;
  polygonId: string;
}

const PolygonContextMenu = ({
  children,
  onDelete,
  onSlice,
  onEdit,
  polygonId
}: PolygonContextMenuProps) => {
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);

  // Přidáme handler pro pravé tlačítko myši
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    // Zastavíme výchozí kontextové menu prohlížeče
    e.preventDefault();
    e.stopPropagation();

    // Otevřeme dialog pro potvrzení smazání
    setShowDeleteDialog(true);

    return false;
  }, []);

  // Obalíme children do div s handlerem pro pravé tlačítko
  const wrappedChildren = React.cloneElement(
    React.Children.only(children) as React.ReactElement,
    {
      onContextMenu: handleContextMenu
    }
  );

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {wrappedChildren}
        </ContextMenuTrigger>
        <ContextMenuContent className="w-64">
          <ContextMenuItem onClick={onEdit} className="cursor-pointer">
            <Edit className="mr-2 h-4 w-4" />
            <span>Upravit polygon</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={onSlice} className="cursor-pointer">
            <Scissors className="mr-2 h-4 w-4" />
            <span>Rozdělit polygon</span>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => setShowDeleteDialog(true)}
            className="cursor-pointer text-red-600"
          >
            <Trash className="mr-2 h-4 w-4" />
            <span>Smazat polygon</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Opravdu chcete smazat polygon?</AlertDialogTitle>
            <AlertDialogDescription>
              Tato akce je nevratná. Polygon bude trvale odstraněn ze segmentace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete();
                setShowDeleteDialog(false);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Smazat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PolygonContextMenu;
