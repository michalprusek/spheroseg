import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { useProjectForm } from "@/hooks/useProjectForm";
import { useLanguage } from "@/contexts/LanguageContext";

interface ProjectDialogFormProps {
  onSuccess?: (projectId: string) => void;
  onClose: () => void;
}

const ProjectDialogForm = ({ onSuccess, onClose }: ProjectDialogFormProps) => {
  const { t } = useLanguage();
  const {
    projectName,
    setProjectName,
    projectDescription,
    setProjectDescription,
    isCreating,
    handleCreateProject
  } = useProjectForm({ onSuccess, onClose });

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('projects.createProject')}</DialogTitle>
        <DialogDescription>
          {t('projects.createProjectDesc')}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={(e) => handleCreateProject(e)}>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="projectName" className="text-right">
              {t('common.projectName')}
            </Label>
            <Input
              id="projectName"
              placeholder={t('projects.projectNamePlaceholder')}
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              required
              autoFocus
              data-testid="project-name-input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="projectDescription" className="text-right">
              {t('common.description')} ({t('common.optional')})
            </Label>
            <Input
              id="projectDescription"
              placeholder={t('projects.projectDescPlaceholder')}
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              data-testid="project-description-input"
            />
          </div>
        </div>
        <DialogFooter>
          <Button 
            type="submit" 
            disabled={isCreating || !projectName.trim()}
            data-testid="create-project-button"
          >
            {isCreating ? t('projects.creatingProject') : t('projects.createProject')}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
};

export default ProjectDialogForm;
