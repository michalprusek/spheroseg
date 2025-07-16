import { Button } from '@/components/ui/button';
import ImageUploader from '@/components/ImageUploader';
import { useLanguage } from '@/contexts/LanguageContext';
import { ProjectImage } from '@/types';

interface ProjectUploaderSectionProps {
  projectId: string;
  onCancel: () => void;
  onUploadComplete: (uploadedImages: ProjectImage[]) => void;
  segmentAfterUpload?: boolean;
  onSegmentAfterUploadChange?: (value: boolean) => void;
}

const ProjectUploaderSection = ({
  projectId,
  onCancel,
  onUploadComplete,
  segmentAfterUpload,
  onSegmentAfterUploadChange,
}: ProjectUploaderSectionProps) => {
  const { t } = useLanguage();

  return (
    <div className="mb-6 p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold dark:text-white">{t('common.uploadImages', {}, 'Upload Images')}</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="border border-gray-300 dark:border-gray-600 rounded-md shadow-sm"
        >
          {t('common.cancel')}
        </Button>
      </div>

      <ImageUploader
        projectId={projectId}
        onUploadComplete={(_projId, uploadedImages) => onUploadComplete(uploadedImages)}
        segmentAfterUpload={segmentAfterUpload}
        onSegmentAfterUploadChange={onSegmentAfterUploadChange}
      />
    </div>
  );
};

export default ProjectUploaderSection;
