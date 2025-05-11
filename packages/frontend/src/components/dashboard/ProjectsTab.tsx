import React from 'react';
import ProjectsList from '@/components/ProjectsList';
import { Project } from '@/types';

interface ProjectsTabProps {
  projects: Project[];
  viewMode: 'grid' | 'list';
  loading: boolean;
  onOpenProject: (id: string) => void;
  onDeleteProject: (projectId: string, projectName: string) => void;
}

const ProjectsTab = ({ projects, viewMode, loading, onOpenProject, onDeleteProject }: ProjectsTabProps) => {
  return (
    <ProjectsList
      projects={projects}
      viewMode={viewMode}
      onOpenProject={onOpenProject}
      onDeleteProject={onDeleteProject}
      loading={loading}
      showCreateCard={true}
    />
  );
};

export default ProjectsTab;
