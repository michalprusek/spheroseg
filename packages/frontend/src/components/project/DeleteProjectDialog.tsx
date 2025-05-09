/**
 * Delete Project Dialog Component
 * 
 * A dialog for confirming project deletion with a more user-friendly interface
 * than the native browser confirm dialog.
 */
import React, { useState } from 'react';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useProjectDelete } from '@/hooks/useProjectDelete';
import { useLanguage } from '@/contexts/LanguageContext';
import logger from '@/lib/logger';

interface DeleteProjectDialogProps {
  /**
   * ID of the project to delete
   */
  projectId: string;

  /**
   * Title of the project (for display purposes)
   */
  projectTitle: string;

  /**
   * Whether the dialog is open
   */
  open: boolean;

  /**
   * Callback when the dialog is closed
   */
  onClose: () => void;

  /**
   * Callback when a project is successfully deleted
   * @param deletedProjectId The ID of the deleted project
   */
  onDelete?: (deletedProjectId: string) => void;

  /**
   * Whether to navigate to dashboard after deletion
   * @default true
   */
  navigateToDashboard?: boolean;
}

/**
 * Dialog for confirming project deletion
 */
export function DeleteProjectDialog({
  projectId,
  projectTitle,
  open,
  onClose,
  onDelete,
  navigateToDashboard = true
}: DeleteProjectDialogProps) {
  const { t } = useLanguage();
  
  // State for confirmation input
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Use the project delete hook
  const {
    deleteProject,
    isDeleting,
    error: deleteError
  } = useProjectDelete({
    onSuccess: (deletedId) => {
      logger.info('Project deleted successfully', { projectId: deletedId });
      if (onDelete) {
        onDelete(deletedId);
      }
      
      // Auto-close dialog after deletion
      handleClose();
    },
    // Don't show confirmation dialog since we're using our own
    showConfirmation: false,
    // Always navigate to dashboard after deletion for consistent behavior
    navigateToDashboard: true, // Always navigate to dashboard after deletion
    // Show toast notifications
    showToasts: true
  });
  
  /**
   * Handle deletion confirmation
   */
  const handleDelete = async () => {
    // Get a safe project title or default if undefined
    const safeTitleLower = (projectTitle || '').toLowerCase();

    // Validate confirmation text
    if (confirmText.toLowerCase() !== safeTitleLower) {
      setError(t('projects.confirmDeleteError') || `Please type "${projectTitle || ''}" to confirm`);
      return;
    }

    setError(null);

    try {
      // Attempt project deletion and check for success
      const result = await deleteProject(projectId, projectTitle);

      // Log the result for debugging
      logger.info('Delete project result from dialog', { result, projectId });
    } catch (err) {
      logger.error('Error deleting project', { error: err });
      // Error is already handled by the hook
    }
  };
  
  /**
   * Handle dialog close
   */
  const handleClose = () => {
    // Don't close if deletion is in progress
    if (isDeleting) {
      return;
    }
    
    // Reset form state
    setConfirmText('');
    setError(null);
    onClose();
  };
  
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            {t('projects.deleteProject') || 'Delete Project'}
          </DialogTitle>
          <DialogDescription>
            {t('projects.deleteProjectDescription') || 
             'This action cannot be undone. This will permanently delete the project and all associated data.'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          <Alert variant="destructive" className="bg-destructive/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {t('projects.deleteWarning') || 
               'You are about to delete the following project:'}
            </AlertDescription>
          </Alert>
          
          <div className="font-medium text-center py-2 border border-destructive/20 rounded-md bg-destructive/5">
            {projectTitle || t('projects.untitledProject') || 'Untitled Project'}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="confirm-delete">
              {t('projects.typeToConfirm') || `Type "${projectTitle || ''}" to confirm`}
            </Label>
            <Input
              id="confirm-delete"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              disabled={isDeleting}
              placeholder={projectTitle}
              className="border-destructive/50 focus:border-destructive"
              autoFocus
            />
          </div>
          
          {(error || deleteError) && (
            <Alert variant="destructive">
              <AlertDescription>
                {error || deleteError}
              </AlertDescription>
            </Alert>
          )}
        </div>
        
        <DialogFooter className="flex justify-between sm:justify-between">
          <Button 
            onClick={handleClose} 
            variant="outline"
            disabled={isDeleting}
          >
            {t('common.cancel') || 'Cancel'}
          </Button>
          
          <Button
            onClick={handleDelete}
            variant="destructive"
            disabled={isDeleting || confirmText.toLowerCase() !== (projectTitle || '').toLowerCase()}
            className="gap-1"
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {isDeleting ? 
              (t('projects.deleting') || 'Deleting...') : 
              (t('projects.delete') || 'Delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DeleteProjectDialog;
