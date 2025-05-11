import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Folder } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import ProjectToolbar from '@/components/project/ProjectToolbar';

interface DashboardTabsProps {
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
  onSort: (field: 'name' | 'updatedAt' | 'segmentationStatus') => void;
  sortField: 'name' | 'updatedAt' | 'segmentationStatus';
  sortDirection: 'asc' | 'desc';
  children: React.ReactNode;
}

const DashboardTabs = ({ viewMode, setViewMode, onSort, sortField, sortDirection, children }: DashboardTabsProps) => {
  const { t } = useLanguage();

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6">
        <div className="flex items-center mb-4 sm:mb-0">
          <h2 className="text-xl font-semibold">{t('common.projects')}</h2>
        </div>

        <ProjectToolbar
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={onSort}
          viewMode={viewMode}
          setViewMode={setViewMode}
          showSearchBar={false}
          showUploadButton={false}
          showExportButton={false}
          selectionMode={false}
          onToggleSelectionMode={() => {}}
          showSelectionButton={false}
        />
      </div>

      {children}
    </div>
  );
};

export default DashboardTabs;
