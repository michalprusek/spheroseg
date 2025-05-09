import React from 'react';
import { Link } from 'react-router-dom';
import { Image, Share2 } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ProjectActions from '@/components/project/ProjectActions';
import { formatRelativeTime } from '@/utils/dateUtils';
import { constructUrl } from '@/lib/urlUtils';
import { useLanguage } from '@/contexts/LanguageContext';

interface Project {
  id: string;
  name: string;
  title?: string; // For backward compatibility
  description: string;
  created_at: string;
  updated_at: string;
  image_count: number;
  thumbnail_url?: string;
  is_owner?: boolean;
  permission?: string;
  owner_name?: string;
  owner_email?: string;
}

interface ProjectCardProps {
  project: Project;
  onProjectDeleted?: (projectId: string) => void;
  onProjectDuplicated: (project: { id: string; name: string }) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onProjectDeleted,
  onProjectDuplicated,
}) => {
  const { t } = useLanguage();

  const handleDelete = (deletedProjectId: string) => {
    if (!project.id) {
      console.error('ProjectCard: Cannot delete project with undefined ID');
      return;
    }
    console.log(`ProjectCard: Deleting project ${project.id}`);
    onProjectDeleted?.(project.id);
  };

  const handleDuplicateSuccess = (newProject: { id: string; name: string }) => {
    onProjectDuplicated(newProject);
  };

  const formattedTime = formatRelativeTime(project.updated_at);

  const imageCountText = project.image_count === 1
    ? `1 image`
    : `${project.image_count} images`;

  const isShared = project.is_owner === false;

  return (
    <Card
      className="overflow-hidden transition-all duration-300 hover:shadow-lg"
    >
      <Link to={`/project/${project.id}`} className="block">
        <div className="relative aspect-video bg-gray-100">
          {project.thumbnail_url ? (
            <img
              src={constructUrl(project.thumbnail_url)}
              alt={project.name || project.title || 'Project'}
              className="h-full w-full object-cover"
              onError={(e) => {
                console.error(`Failed to load project thumbnail: ${project.thumbnail_url}`);
                e.currentTarget.src = '/placeholder.svg';
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-gray-400">
              <Image className="h-12 w-12" />
            </div>
          )}
          <Badge
            className="absolute right-2 top-2 bg-blue-500 text-white"
          >
            {imageCountText}
          </Badge>
        </div>
      </Link>

      <CardHeader className="pb-2 pt-4">
        <Link to={`/project/${project.id}`}>
          <div className="flex items-center gap-2">
            <CardTitle className="text-xl hover:text-blue-600 transition-colors">
              {project.name || project.title || 'Untitled Project'}
            </CardTitle>
            {isShared && (
              <Badge variant="outline" className="font-normal">
                <Share2 className="h-3 w-3 mr-1" />
                {t(`shared.permission.${project.permission}`) || project.permission}
              </Badge>
            )}
          </div>
        </Link>
      </CardHeader>

      <CardContent className="pb-2">
        {isShared && project.owner_name ? (
          <div className="text-gray-500 line-clamp-2">
            <span className="text-gray-400">{t('shared.sharedBy') || 'Shared by'}: </span>
            {project.owner_name}
          </div>
        ) : (
          <p className="text-gray-500 line-clamp-2">
            {project.description || "No description provided"}
          </p>
        )}
      </CardContent>

      <CardFooter className="flex justify-between items-center pt-2">
        <p className="text-sm text-gray-500">
          {formattedTime}
        </p>

        <ProjectActions
          projectId={project.id}
          projectTitle={project.name || project.title || 'Untitled Project'}
          onDelete={() => onProjectDeleted?.(project.id)}
          onDuplicate={handleDuplicateSuccess}
        />
      </CardFooter>
    </Card>
  );
};

export default ProjectCard;