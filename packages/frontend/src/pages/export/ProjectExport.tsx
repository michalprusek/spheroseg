import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectData } from '@/hooks/useProjectData';
import ProjectHeader from '@/components/project/ProjectHeader';
import ExportOptionsCard from './components/ExportOptionsCard';
import ImageSelectionCard from './components/ImageSelectionCard';
import { useExportFunctions } from './hooks/useExportFunctions';
import { useLanguage } from '@/contexts/LanguageContext';

const ProjectExport = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const { projectTitle, images, loading } = useProjectData(projectId, user?.id);

  const {
    selectedImages,
    includeMetadata,
    includeObjectMetrics,
    includeSegmentation,
    includeImages,
    annotationFormat,
    metricsFormat,
    isExporting,
    handleSelectAll,
    handleSelectImage,
    getSelectedCount,
    handleExport,
    handleExportMetricsAsXlsx,
    setIncludeMetadata,
    setIncludeObjectMetrics,
    setIncludeSegmentation,
    setIncludeImages,
    setAnnotationFormat,
    setMetricsFormat,
  } = useExportFunctions(images, projectTitle);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <ProjectHeader projectTitle={projectTitle} imagesCount={images.length} loading={loading} />

      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <Button
            variant="outline"
            size="sm"
            className="flex items-center"
            onClick={() => navigate(`/project/${projectId}`)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('export.backToProject')}
          </Button>

          <Button
            disabled={getSelectedCount() === 0 || isExporting}
            onClick={() => {
              // Filtrujeme pouze vybrané obrázky
              const selectedImagesToExport = images.filter((img) => selectedImages[img.id]);
              // Voláme handleExport s filtrovanými obrázky
              handleExport(selectedImagesToExport);
            }}
            className="flex items-center"
          >
            {isExporting ? (
              <span className="mr-2 h-4 w-4 animate-spin">⏳</span>
            ) : (
              <span className="mr-2 h-4 w-4">📥</span>
            )}
            {t('export.exportImages', { count: getSelectedCount() })}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ExportOptionsCard
            includeMetadata={includeMetadata}
            setIncludeMetadata={setIncludeMetadata}
            includeSegmentation={includeSegmentation}
            setIncludeSegmentation={setIncludeSegmentation}
            includeObjectMetrics={includeObjectMetrics}
            setIncludeObjectMetrics={setIncludeObjectMetrics}
            includeImages={includeImages}
            setIncludeImages={setIncludeImages}
            annotationFormat={annotationFormat}
            setAnnotationFormat={setAnnotationFormat}
            metricsFormat={metricsFormat}
            setMetricsFormat={setMetricsFormat}
            handleExportMetricsAsXlsx={handleExportMetricsAsXlsx}
            getSelectedCount={getSelectedCount}
            isExporting={isExporting}
          />

          <ImageSelectionCard
            images={images}
            loading={loading}
            selectedImages={selectedImages}
            handleSelectAll={handleSelectAll}
            handleSelectImage={handleSelectImage}
          />
        </div>
      </div>
    </div>
  );
};

export default ProjectExport;
