/**
 * Project action buttons component
 */
import React, { useState } from 'react';
import { MoreVertical, Edit, Trash2, Copy, Share2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/contexts/LanguageContext';
import ProjectDuplicationDialog from './ProjectDuplicationDialog';
import DeleteProjectDialog from './DeleteProjectDialog';

interface ProjectActionsProps {
  /**
   * Project ID
   */
  projectId: string;

  /**
   * Project title
   */
  projectTitle: string;

  /**
   * Handler for edit action
   */
  onEdit?: () => void;

  /**
   * Handler for delete action
   */
  onDelete?: () => void;

  /**
   * Handler for share action
   */
  onShare?: () => void;

  /**
   * Handler for export action
   */
  onExport?: () => void;

  /**
   * Handler for successful duplication
   */
  onDuplicate?: (newProject: any) => void;
}

/**
 * Component for project actions (edit, delete, duplicate, share, export)
 */
export function ProjectActions({
  projectId,
  projectTitle,
  onEdit,
  onDelete,
  onShare,
  onExport,
  onDuplicate
}: ProjectActionsProps) {
  const { t } = useLanguage();

  // Dialog states
  const [duplicationDialogOpen, setDuplicationDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Handle edit action
  const handleEdit = () => {
    if (onEdit) {
      onEdit();
    }
  };

  // Handle delete action
  const handleDelete = () => {
    if (!projectId) {
      console.error('ProjectActions: Cannot delete project with undefined ID');
      return;
    }
    // Open delete dialog instead of directly calling onDelete
    setDeleteDialogOpen(true);
  };

  // Handle delete success - we don't actually need to do anything here
  // because the delete operation is already completed by the DeleteProjectDialog
  const handleDeleteSuccess = (deletedProjectId: string) => {
    // Log successful deletion for debugging
    console.log(`ProjectActions: Project ${deletedProjectId} deleted successfully`);

    // We only notify the parent that deletion was successful
    if (onDelete) {
      onDelete();
    }
  };

  // Handle duplicate action
  const handleDuplicate = () => {
    setDuplicationDialogOpen(true);
  };

  // Handle share action
  const handleShare = () => {
    if (onShare) {
      onShare();
    }
  };

  // Handle export action
  const handleExport = () => {
    if (onExport) {
      onExport();
    }
  };

  // Handle duplication success
  const handleDuplicationSuccess = (newProject: any) => {
    if (onDuplicate) {
      onDuplicate(newProject);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('common.actions') || 'Actions'}
            title={t('common.actions') || 'Actions'}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onEdit && (
            <DropdownMenuItem onClick={handleEdit}>
              <Edit className="h-4 w-4 mr-2" />
              {t('projects.edit') || 'Edit'}
            </DropdownMenuItem>
          )}

          <DropdownMenuItem onClick={handleDuplicate}>
            <Copy className="h-4 w-4 mr-2" />
            {t('projects.duplicate') || 'Duplicate'}
          </DropdownMenuItem>

          {onShare && (
            <DropdownMenuItem onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-2" />
              {t('projects.share') || 'Share'}
            </DropdownMenuItem>
          )}

          {onExport && (
            <DropdownMenuItem onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              {t('projects.export') || 'Export'}
            </DropdownMenuItem>
          )}

          {onDelete && (
            <DropdownMenuItem onClick={handleDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2 text-destructive" />
              {t('projects.delete') || 'Delete'}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Duplication Dialog */}
      <ProjectDuplicationDialog
        projectId={projectId}
        projectTitle={projectTitle}
        open={duplicationDialogOpen}
        onClose={() => setDuplicationDialogOpen(false)}
        onDuplicate={handleDuplicationSuccess}
      />

      {/* Delete Dialog */}
      <DeleteProjectDialog
        projectId={projectId}
        projectTitle={projectTitle}
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onDelete={handleDeleteSuccess}
      />
    </>
  );
}

export default ProjectActions;