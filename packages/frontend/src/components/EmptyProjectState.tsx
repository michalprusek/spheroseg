import React from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Image } from 'lucide-react';
import { Link } from 'react-router-dom';

interface EmptyProjectStateProps {
  projectId: string;
  onUploadClick?: () => void;
}

/**
 * Component displayed when a project has no images
 *
 * @param projectId - The ID of the current project
 * @param onUploadClick - Optional callback for when the upload button is clicked
 */
const EmptyProjectState: React.FC<EmptyProjectStateProps> = ({ projectId, onUploadClick }) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center p-8 my-8 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
      <Image className="w-16 h-16 text-gray-400 mb-4" />

      <h3 className="text-xl font-medium text-gray-700 dark:text-gray-200 mb-2">{t('project.noImages.title')}</h3>

      <p className="text-gray-500 dark:text-gray-400 text-center mb-6 max-w-md">{t('project.noImages.description')}</p>

      <div className="flex flex-col sm:flex-row gap-4">
        {onUploadClick ? (
          <button
            onClick={onUploadClick}
            className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Upload className="mr-2" />
            {t('project.noImages.uploadButton')}
          </button>
        ) : (
          <Link
            to={`/project/${projectId}/upload`}
            className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Upload className="mr-2" />
            {t('project.noImages.uploadButton')}
          </Link>
        )}
      </div>
    </div>
  );
};

export default EmptyProjectState;
