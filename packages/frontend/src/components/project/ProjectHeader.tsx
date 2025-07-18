import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import DashboardHeader from '@/components/DashboardHeader';
import SegmentationProgress from './SegmentationProgress';

interface ProjectHeaderProps {
  projectTitle: string;
  imagesCount: number;
  loading: boolean;
  projectId: string;
}

const ProjectHeader = ({ projectTitle, imagesCount, loading, projectId }: ProjectHeaderProps) => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <>
      <DashboardHeader />
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center">
              <Button variant="outline" size="sm" className="mr-4" onClick={() => navigate('/dashboard')}>
                {t('common.back')}
              </Button>
              <div>
                <h1 className="text-xl font-semibold dark:text-white">{projectTitle}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {loading ? t('common.loading') : `${imagesCount} ${t('common.images').toLowerCase()}`}
                </p>
              </div>
            </div>

            {/* Ukazatel progresu segmentace */}
            <SegmentationProgress projectId={projectId} />
          </div>
        </div>
      </div>
    </>
  );
};

export default ProjectHeader;
