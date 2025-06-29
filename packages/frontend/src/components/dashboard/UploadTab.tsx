import React, { useState, useEffect } from 'react';
import ImageUploader from '@/components/ImageUploader';
import ProjectSelector from '@/components/ProjectSelector';
import { useDashboardProjects } from '@/hooks/useDashboardProjects';
import { useLanguage } from '@/contexts/LanguageContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';

const UploadTab = () => {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const { projects, loading: projectsLoading, error: projectsError } = useDashboardProjects();
  const { t } = useLanguage();

  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const handleUploadComplete = () => {
    console.log('Upload complete in UploadTab');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg border border-gray-200 dark:bg-gray-800 dark:border-gray-700 shadow-sm">
        <h3 className="text-lg font-semibold mb-3 dark:text-white">{t('projects.projectSelection')}</h3>
        {projectsLoading && <p>{t('common.loading')}...</p>}
        {projectsError && (
          <p className="text-red-500">
            {t('common.error')}: {projectsError}
          </p>
        )}
        {!projectsLoading && !projectsError && projects.length > 0 && (
          <ProjectSelector selectedProjectId={selectedProjectId} onProjectChange={setSelectedProjectId} />
        )}
        {!projectsLoading && !projectsError && projects.length === 0 && (
          <p className="text-gray-500">{t('images.noProjectsToUpload')}</p>
        )}
      </div>

      {selectedProjectId ? (
        <div className="bg-white p-6 rounded-lg border border-gray-200 dark:bg-gray-800 dark:border-gray-700 shadow-sm">
          <ImageUploader projectId={selectedProjectId} onUploadComplete={handleUploadComplete} />
        </div>
      ) : (
        <Alert className="dark:border-blue-800 dark:bg-blue-900/20">
          <Info className="h-4 w-4 text-blue-500 dark:text-blue-400" />
          <AlertTitle className="dark:text-blue-300">{t('images.selectProjectFirst')}</AlertTitle>
          <AlertDescription className="dark:text-blue-400">{t('images.projectRequired')}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default UploadTab;
