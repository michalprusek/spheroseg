import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { PlusCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { v4 as uuidv4 } from 'uuid';

interface NewProjectProps {
  onProjectCreated?: (projectId: string) => void;
}

const NewProject = ({ onProjectCreated }: NewProjectProps) => {
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { t } = useLanguage();

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!projectName.trim()) {
      toast.error(t('projects.projectNameRequired'));
      return;
    }

    if (!user) {
      toast.error(t('projects.loginRequired'));
      return;
    }

    setIsCreating(true);

    const projectData = {
      user_id: user.id,
      title: projectName,
      description: projectDescription,
      // Add any other default fields needed for your new backend
    };

    try {
      // Replace with API call to your backend
      console.log('Creating new project:', projectData);
      await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate API call

      // Mock created project ID for potential callback use
      const mockProjectId = uuidv4();

      toast.success(t('newProject.createSuccess'));
      setProjectName('');
      setProjectDescription('');
      setOpen(false); // Close the dialog
      if (onProjectCreated) {
        onProjectCreated(mockProjectId); // Pass mock ID
      }
    } catch (error: unknown) {
      console.error('Error creating project:', error);
      toast.error(t('newProject.createError'));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-md">
          <PlusCircle size={18} className="mr-2" />
          {t('common.newProject')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('projects.createProject')}</DialogTitle>
          <DialogDescription>{t('projects.createProjectDesc')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreateProject}>
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
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? t('projects.creatingProject') : t('projects.createProject')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default NewProject;
