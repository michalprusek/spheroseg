import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Share2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import ProjectThumbnail from '@/components/project/ProjectThumbnail';
import ProjectActions from '@/components/project/ProjectActions';
import ProjectMetadata from '@/components/project/ProjectMetadata';
import ShareDialog from '@/components/project/ShareDialog';
import { useLanguage } from '@/contexts/LanguageContext';

interface ProjectListItemProps {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string | null | undefined;
  date: string;
  imageCount: number;
  onClick?: () => void;
  projectName: string;
  onDelete?: () => void;
  onDuplicate?: (newProject: any) => void;
  isOwner?: boolean;
  permission?: string;
  ownerName?: string;
  ownerEmail?: string;
}

const ProjectListItem = ({
  id,
  title,
  description,
  thumbnailUrl,
  date,
  imageCount,
  onClick,
  projectName,
  onDelete,
  onDuplicate,
  isOwner = true,
  permission,
  ownerName,
  ownerEmail,
}: ProjectListItemProps) => {
  const { t } = useLanguage();
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  const handleCardClick = () => {
    if (onClick) {
      onClick();
    }
  };

  const handleShare = () => {
    setShareDialogOpen(true);
  };

  const isShared = isOwner === false;

  return (
    <Card
      className="overflow-hidden transition-all duration-300 hover:shadow-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 w-full"
      onClick={handleCardClick}
    >
      <div className="flex items-center p-4">
        <div className="flex-shrink-0 w-16 h-16 mr-4 overflow-hidden rounded-md">
          <ProjectThumbnail thumbnailUrl={thumbnailUrl} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-medium truncate dark:text-white">{title}</h3>
            {isShared && (
              <Badge variant="outline" className="font-normal">
                {t(`shared.permission.${permission}`) || permission}
              </Badge>
            )}
          </div>
          {isShared && ownerName ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 mt-1">
              <span className="text-gray-400">{t('shared.sharedBy') || 'Shared by'}: </span>
              {ownerName}
            </p>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 mt-1">{description}</p>
          )}
          <div className="flex items-center mt-1">
            <ProjectMetadata date={date} imageCount={imageCount} />
          </div>
        </div>

        <div className="flex items-center ml-4 space-x-2">
          <ProjectActions
            projectId={id}
            projectTitle={projectName}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            onShare={isOwner ? handleShare : undefined}
          />
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Share Dialog */}
      {isOwner && (
        <ShareDialog
          projectId={id}
          projectName={projectName}
          isOwner={true}
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
        />
      )}
    </Card>
  );
};

export default ProjectListItem;
