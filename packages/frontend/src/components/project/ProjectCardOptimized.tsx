import React, { useState, memo, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Image, Share2 } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ProjectActions from '@/components/project/ProjectActions';
import ShareDialog from '@/components/project/ShareDialog';
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

const ProjectCard: React.FC<ProjectCardProps> = memo(
  ({ project, onProjectDeleted, onProjectDuplicated }) => {
    const { t } = useLanguage();
    const [shareDialogOpen, setShareDialogOpen] = useState(false);

    // Memoized handlers
    const handleDelete = useCallback(
      (deletedProjectId: string) => {
        if (!project.id) {
          console.error('ProjectCard: Cannot delete project with undefined ID');
          return;
        }
        console.log(`ProjectCard: Deleting project ${project.id}`);
        onProjectDeleted?.(project.id);
      },
      [project.id, onProjectDeleted],
    );

    const handleDuplicateSuccess = useCallback(
      (newProject: { id: string; name: string }) => {
        onProjectDuplicated(newProject);
      },
      [onProjectDuplicated],
    );

    const handleShare = useCallback(() => {
      setShareDialogOpen(true);
    }, []);

    // Memoized computed values
    const projectTitle = useMemo(
      () => project.name || project.title || 'Untitled Project',
      [project.name, project.title],
    );

    const thumbnailUrl = useMemo(() => {
      if (!project.thumbnail_url) return null;
      return constructUrl(project.thumbnail_url);
    }, [project.thumbnail_url]);

    const formattedUpdateTime = useMemo(() => {
      return formatRelativeTime(project.updated_at);
    }, [project.updated_at]);

    const ownerBadge = useMemo(() => {
      if (project.is_owner === false) {
        return (
          <Badge variant="secondary" className="ml-auto">
            {t('project.shared')}
            {project.permission && <span className="ml-1 text-xs">({project.permission})</span>}
          </Badge>
        );
      }
      return null;
    }, [project.is_owner, project.permission, t]);

    const ownerInfo = useMemo(() => {
      if (project.is_owner === false && (project.owner_name || project.owner_email)) {
        return (
          <div className="text-xs text-muted-foreground mt-1">
            {t('common.owner')}: {project.owner_name || project.owner_email}
          </div>
        );
      }
      return null;
    }, [project.is_owner, project.owner_name, project.owner_email, t]);

    return (
      <>
        <Card className="group relative overflow-hidden hover:shadow-lg transition-all duration-200">
          <Link to={`/projects/${project.id}`} className="block">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg font-semibold line-clamp-1">{projectTitle}</CardTitle>
                {ownerBadge}
              </div>
              {ownerInfo}
            </CardHeader>

            <CardContent className="pb-3">
              {/* Thumbnail Preview */}
              <div className="aspect-video mb-3 overflow-hidden rounded-md bg-muted">
                {thumbnailUrl ? (
                  <img src={thumbnailUrl} alt={projectTitle} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Image className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Description */}
              {project.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{project.description}</p>
              )}

              {/* Stats */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <Image className="h-4 w-4" />
                    <span>{project.image_count || 0}</span>
                  </span>
                </div>
                <span className="text-muted-foreground">{formattedUpdateTime}</span>
              </div>
            </CardContent>
          </Link>

          <CardFooter className="border-t pt-3">
            <div className="flex w-full items-center justify-between">
              <ProjectActions
                projectId={project.id}
                projectName={projectTitle}
                onDeleteSuccess={handleDelete}
                onDuplicateSuccess={handleDuplicateSuccess}
                onShare={handleShare}
                isOwner={project.is_owner !== false}
              />
            </div>
          </CardFooter>
        </Card>

        {/* Share Dialog */}
        {shareDialogOpen && project.is_owner !== false && (
          <ShareDialog
            projectId={project.id}
            projectName={projectTitle}
            open={shareDialogOpen}
            onClose={() => setShareDialogOpen(false)}
          />
        )}
      </>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison for React.memo
    return (
      prevProps.project.id === nextProps.project.id &&
      prevProps.project.updated_at === nextProps.project.updated_at &&
      prevProps.project.image_count === nextProps.project.image_count &&
      prevProps.project.thumbnail_url === nextProps.project.thumbnail_url &&
      prevProps.project.is_owner === nextProps.project.is_owner &&
      prevProps.project.permission === nextProps.project.permission
    );
  },
);

ProjectCard.displayName = 'ProjectCard';

export default ProjectCard;
