import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import apiClient from '@/lib/apiClient';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface ProjectDuplicationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
}

export const ProjectDuplicationDialog: React.FC<ProjectDuplicationDialogProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newProjectName, setNewProjectName] = useState(`${projectName} (Copy)`);

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/api/projects/${projectId}/duplicate`, {
        name: newProjectName,
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success(t('project.duplicateSuccess'));
      onClose();
      // Navigate to the new project
      navigate(`/project/${data.id}`);
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || t('project.duplicateError');
      toast.error(message);
    },
  });

  const handleDuplicate = () => {
    if (!newProjectName.trim()) {
      toast.error(t('project.nameRequired'));
      return;
    }
    duplicateMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            {t('project.duplicateProject')}
          </DialogTitle>
          <DialogDescription>{t('project.duplicateDescription')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="project-name">{t('project.newProjectName')}</Label>
            <Input
              id="project-name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder={t('project.enterProjectName')}
              disabled={duplicateMutation.isPending}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={duplicateMutation.isPending}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleDuplicate}
            disabled={duplicateMutation.isPending || !newProjectName.trim()}
          >
            {duplicateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('project.duplicating')}
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                {t('project.duplicate')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
