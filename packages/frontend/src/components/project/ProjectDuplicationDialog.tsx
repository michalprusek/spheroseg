import React, { useState } from 'react';
import { Copy, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useProjectDuplicate } from '@/hooks/useProjectDuplicate';
import { useLanguage } from '@/contexts/LanguageContext';
import logger from '@/lib/logger';

interface ProjectDuplicationDialogProps {
  /**
   * ID of the project to duplicate
   */
  projectId: string;

  /**
   * Title of the project (used to generate a default title for the copy)
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
   * Callback when a project is successfully duplicated
   * @param newProject The newly created project
   */
  onDuplicate?: (newProject: any) => void;

  /**
   * Whether to automatically navigate to the new project after duplication
   * @default false
   */
  navigateToNewProject?: boolean;
}

/**
 * Dialog for duplicating a project with progress tracking
 */
export function ProjectDuplicationDialog({
  projectId,
  projectTitle,
  open,
  onClose,
  onDuplicate,
  navigateToNewProject = false,
}: ProjectDuplicationDialogProps) {
  const { t } = useLanguage();

  // State for form inputs
  const [newTitle, setNewTitle] = useState(`${projectTitle} (Copy)`);
  const [copySegmentations, setCopySegmentations] = useState(false);
  const [resetStatus, setResetStatus] = useState(true);

  // Use the project duplication hook
  const { duplicateProject, isDuplicating, error, newProject, duplicationTask, cancelDuplication } =
    useProjectDuplicate({
      onSuccess: (project) => {
        logger.info('Project duplicated successfully', { projectId: project.id });
        if (onDuplicate) {
          onDuplicate(project);
        }

        // Auto-close dialog after 2 seconds when complete
        if (!navigateToNewProject) {
          setTimeout(() => {
            handleClose();
          }, 2000);
        }
      },
      navigateToNewProject,
      // Always use async mode in the dialog
      async: true,
    });

  /**
   * Handle duplication start
   */
  const handleDuplicate = async () => {
    try {
      await duplicateProject({
        projectId,
        newTitle,
        copySegmentations,
        resetStatus,
      });
    } catch (err) {
      logger.error('Error starting project duplication', { error: err });
    }
  };

  /**
   * Handle dialog close
   */
  const handleClose = () => {
    // Don't close if duplication is in progress, unless explicitly cancelled
    if (isDuplicating && duplicationTask?.status !== 'cancelled') {
      return;
    }

    // Reset form state
    setNewTitle(`${projectTitle} (Copy)`);
    setCopySegmentations(false);
    setResetStatus(true);
    onClose();
  };

  /**
   * Format status for display
   */
  const getStatusDisplay = () => {
    if (!duplicationTask) return '';

    switch (duplicationTask.status) {
      case 'pending':
        return t('projects.duplicationPending') || 'Queued...';
      case 'processing':
        return t('projects.duplicationProcessing') || 'Processing...';
      case 'completed':
        return t('projects.duplicationCompleted') || 'Completed';
      case 'failed':
        return t('projects.duplicationFailed') || 'Failed';
      case 'cancelled':
        return t('projects.duplicationCancelled') || 'Cancelled';
      default:
        return duplicationTask.status;
    }
  };

  /**
   * Get icon for current status
   */
  const getStatusIcon = () => {
    if (!duplicationTask) return null;

    switch (duplicationTask.status) {
      case 'pending':
      case 'processing':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
      case 'cancelled':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            {t('projects.duplicateProject') || 'Duplicate Project'}
          </DialogTitle>
          <DialogDescription>
            {t('projects.duplicateProjectDescription') ||
              'Create a copy of this project including all images. You can customize the options below.'}
          </DialogDescription>
        </DialogHeader>

        {/* Input form - disabled during duplication */}
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="title">{t('projects.newProjectTitle') || 'New Project Title'}</Label>
            <Input
              id="title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              disabled={isDuplicating}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="copy-segmentations"
                checked={copySegmentations}
                onCheckedChange={(checked) => setCopySegmentations(!!checked)}
                disabled={isDuplicating}
              />
              <Label htmlFor="copy-segmentations">
                {t('projects.copySegmentations') || 'Copy segmentation results'}
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="reset-status"
                checked={resetStatus}
                onCheckedChange={(checked) => setResetStatus(!!checked)}
                disabled={isDuplicating}
              />
              <Label htmlFor="reset-status">{t('projects.resetImageStatus') || 'Reset image processing status'}</Label>
            </div>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Progress display */}
        {isDuplicating && duplicationTask && (
          <div className="mt-4 space-y-3">
            <Separator />

            <div className="flex items-center space-x-2">
              {getStatusIcon()}
              <span className="font-medium">{getStatusDisplay()}</span>
            </div>

            <Progress value={duplicationTask.progress} className="h-2" />

            <div className="text-sm text-muted-foreground">
              {duplicationTask.processedItems} / {duplicationTask.totalItems}{' '}
              {t('projects.itemsProcessed') || 'items processed'}
            </div>

            {duplicationTask.status === 'failed' && duplicationTask.errorMessage && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{duplicationTask.errorMessage}</AlertDescription>
              </Alert>
            )}

            {duplicationTask.status === 'completed' && (
              <Alert variant="success" className="bg-green-50 text-green-800 dark:bg-green-900 dark:text-green-50">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  {t('projects.duplicationSuccessMessage') ||
                    'Project duplicated successfully! You can now access the new project.'}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter className="flex justify-between sm:justify-between">
          {isDuplicating && duplicationTask?.status !== 'completed' ? (
            <Button
              onClick={cancelDuplication}
              variant="destructive"
              disabled={duplicationTask?.status === 'cancelled'}
            >
              {t('common.cancel') || 'Cancel'}
            </Button>
          ) : (
            <Button onClick={handleClose} variant="outline">
              {isDuplicating && duplicationTask?.status === 'completed'
                ? t('common.close') || 'Close'
                : t('common.cancel') || 'Cancel'}
            </Button>
          )}

          <Button onClick={handleDuplicate} disabled={isDuplicating || !newTitle.trim()} className="gap-1">
            {isDuplicating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
            {isDuplicating ? t('projects.duplicating') || 'Duplicating...' : t('projects.duplicate') || 'Duplicate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ProjectDuplicationDialog;
