import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProjectCard from '@/components/project/ProjectCard';
import ProjectListItem from '@/components/ProjectListItem';
import NewProjectListItem from '@/components/NewProjectListItem';
import { useLanguage } from '@/contexts/LanguageContext';
import { Project } from '@/types';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import ProjectDialogForm from '@/components/project/ProjectDialogForm';
import NewProjectCardUI from '@/components/project/NewProjectCardUI';
import { formatDistanceToNow } from 'date-fns';
import { cs, enUS } from 'date-fns/locale';

export interface ProjectsListProps {
  projects: Array<
    Project & {
      is_owner?: boolean;
      permission?: string;
      owner_name?: string;
      owner_email?: string;
    }
  >;
  viewMode: 'grid' | 'list';
  onDeleteProject: (projectId: string, projectName: string) => void;
  onOpenProject?: (projectId: string) => void;
  loading: boolean;
  showCreateCard?: boolean;
}

const ProjectsList = ({
  projects,
  viewMode,
  onDeleteProject,
  _onOpenProject,
  loading,
  showCreateCard = false,
}: ProjectsListProps) => {
  const { t, language } = useLanguage();
  const [newProjectDialogOpen, setNewProjectDialogOpen] = useState(false);
  const navigate = useNavigate();

  const dateLocale = language === 'cs' ? cs : enUS;

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm h-64 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          {t('projects.noProjects') || 'No projects found. Create your first project to get started.'}
        </p>

        {showCreateCard && (
          <div className="flex justify-center">
            <button
              onClick={() => setNewProjectDialogOpen(true)}
              className="px-4 py-2 bg-primary text-white rounded-md shadow-sm hover:bg-primary/90 transition-colors"
            >
              {t('projects.createNew') || 'Create New Project'}
            </button>

            <Dialog open={newProjectDialogOpen} onOpenChange={setNewProjectDialogOpen}>
              <DialogContent className="sm:max-w-[425px]">
                <ProjectDialogForm onClose={() => setNewProjectDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>
    );
  }

  if (viewMode === 'list') {
    const projectItems = projects.map((project) => (
      <ProjectListItem
        key={project.id}
        id={project.id}
        title={project.title}
        description={project.description || ''}
        thumbnailUrl={project.thumbnail_url}
        date={formatDistanceToNow(new Date(project.updated_at), {
          addSuffix: true,
          locale: dateLocale,
        })}
        imageCount={project.image_count ?? 0}
        onClick={() => navigate(`/project/${project.id}`)}
        projectName={project.title}
        onDelete={
          project.is_owner !== false && project.id ? () => onDeleteProject(project.id, project.title) : undefined
        }
        onDuplicate={(newProject) => {
          console.log(`ProjectsList: Project duplicated:`, newProject);
          window.dispatchEvent(new CustomEvent('project-created'));
        }}
        isOwner={project.is_owner}
        permission={project.permission}
        ownerName={project.owner_name}
        ownerEmail={project.owner_email}
      />
    ));

    return (
      <div className="flex flex-col space-y-3 w-full">
        {projectItems}
        {showCreateCard && (
          <>
            <NewProjectListItem key="new-project" onClick={() => setNewProjectDialogOpen(true)} />
            <Dialog open={newProjectDialogOpen} onOpenChange={setNewProjectDialogOpen}>
              <DialogContent className="sm:max-w-[425px]">
                <ProjectDialogForm onClose={() => setNewProjectDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    );
  }

  // Grid mode
  const projectItems = projects.map((project) => (
    <ProjectCard
      key={project.id}
      project={{
        id: project.id,
        title: project.title,
        description:
          !project.is_owner && project.owner_name
            ? `${t('shared.sharedBy') || 'Shared by'}: ${project.owner_name}`
            : project.description || '',
        thumbnail_url: project.thumbnail_url,
        created_at: project.created_at,
        updated_at: project.updated_at,
        image_count: project.image_count ?? 0,
        is_owner: project.is_owner,
        permission: project.permission,
        owner_name: project.owner_name,
        owner_email: project.owner_email,
      }}
      onProjectDeleted={
        project.is_owner !== false && project.id
          ? // Ensure we pass both projectId and projectName
            () => onDeleteProject(project.id, project.title)
          : undefined
      }
      onProjectDuplicated={(newProject) => {
        console.log(`ProjectsList: Project duplicated:`, newProject);
        // Trigger a project list refresh by dispatching a custom event
        window.dispatchEvent(new CustomEvent('project-created'));
      }}
    />
  ));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {projectItems}
      {showCreateCard && (
        <>
          <div onClick={() => setNewProjectDialogOpen(true)} className="cursor-pointer">
            <NewProjectCardUI onClick={() => setNewProjectDialogOpen(true)} />
          </div>
          <Dialog open={newProjectDialogOpen} onOpenChange={setNewProjectDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <ProjectDialogForm onClose={() => setNewProjectDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
};

export default React.memo(ProjectsList);
