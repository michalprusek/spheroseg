import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trash2, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useProjectDelete } from '@/hooks/useProjectDelete';

interface DeleteProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  onDeleteSuccess?: () => void;
}

export const DeleteProjectDialog: React.FC<DeleteProjectDialogProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName,
  onDeleteSuccess,
}) => {
  const { t } = useTranslation();
  const { deleteProject, isDeleting } = useProjectDelete();

  const handleDelete = () => {
    deleteProject(projectId, {
      onSuccess: () => {
        onClose();
        onDeleteSuccess?.();
      },
    });
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            {t('project.deleteProject')}
          </AlertDialogTitle>
          <AlertDialogDescription>{t('project.deleteConfirmation', { projectName })}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('project.deleting')}
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                {t('common.delete')}
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
