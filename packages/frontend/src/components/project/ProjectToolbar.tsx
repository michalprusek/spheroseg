import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate, useParams } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

interface ProjectToolbarProps {
  searchTerm?: string;
  onSearchChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  sortField: 'name' | 'updatedAt' | 'segmentationStatus';
  sortDirection: 'asc' | 'desc';
  onSort: (field: 'name' | 'updatedAt' | 'segmentationStatus') => void;
  onToggleUploader?: () => void;
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
  showSearchBar?: boolean;
  showUploadButton?: boolean;
  showExportButton?: boolean;
  selectionMode: boolean;
  onToggleSelectionMode: () => void;
  showSelectionButton?: boolean;
  showStatusSort?: boolean;
  onClearCache?: () => void;
}

const ProjectToolbar = ({
  searchTerm,
  onSearchChange,
  sortField,
  sortDirection,
  onSort,
  onToggleUploader,
  viewMode,
  setViewMode,
  showSearchBar = true,
  showUploadButton = true,
  showExportButton = true,
  selectionMode = false,
  onToggleSelectionMode,
  showSelectionButton = true,
  showStatusSort = false,
  onClearCache,
}: ProjectToolbarProps) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { id: projectId } = useParams<{ id: string }>();

  const handleExport = () => {
    if (projectId) {
      navigate(`/project/${projectId}/export`);
    }
  };

  return (
    <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
      {/* Tlačítko pro výběr více obrázků - vlevo */}
      {showSelectionButton && (
        <div className="flex items-center">
          <Button
            variant={selectionMode ? 'default' : 'outline'}
            size="sm"
            className="flex items-center h-9"
            onClick={onToggleSelectionMode}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-1 h-4 w-4"
            >
              <rect width="8" height="8" x="3" y="3" rx="1" />
              <path d="M7 11v4a1 1 0 0 0 1 1h4" />
              <rect width="8" height="8" x="13" y="13" rx="1" />
            </svg>
            {selectionMode ? t('projectToolbar.cancelSelection') : t('projectToolbar.selectImages')}
          </Button>
        </div>
      )}

      {/* Ostatní toolbar akce - vpravo */}
      <div className="flex gap-2 items-center">
        {/* Vyhledávací pole zobrazit pouze pokud je požadováno */}
        {showSearchBar && searchTerm !== undefined && onSearchChange && (
          <div className="relative flex-grow max-w-md">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              className="pl-10 pr-4 w-full border rounded-md h-9 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              placeholder={t('dashboard.searchImagesPlaceholder')}
              value={searchTerm}
              onChange={onSearchChange}
            />
          </div>
        )}

        {/* Upload tlačítko zobrazit pouze pokud je požadováno */}
        {showUploadButton && onToggleUploader && (
          <Button variant="outline" size="sm" className="flex items-center h-9" onClick={onToggleUploader}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-1 h-4 w-4"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" x2="12" y1="3" y2="15" />
            </svg>
            {t('common.uploadImages')}
          </Button>
        )}

        {/* Export tlačítko zobrazit pouze pokud je požadováno */}
        {showExportButton && projectId && (
          <Button variant="outline" size="sm" className="flex items-center h-9" onClick={handleExport}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-1 h-4 w-4"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" x2="12" y1="15" y2="3" />
            </svg>
            {t('projectToolbar.export')}
          </Button>
        )}

        {/* Sort dropdown menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center h-9">
              <SlidersHorizontal className="mr-1 h-4 w-4" />
              {t('common.sort')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onSort('name')}>
              <div className="flex justify-between w-full items-center">
                <span>{t('common.name')}</span>
                {sortField === 'name' && <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onSort('updatedAt')}>
              <div className="flex justify-between w-full items-center">
                <span>{t('dashboard.lastChange')}</span>
                {sortField === 'updatedAt' && <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
              </div>
            </DropdownMenuItem>

            {showStatusSort && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onSort('segmentationStatus')}>
                  <div className="flex justify-between w-full items-center">
                    <span>{t('common.status')}</span>
                    {sortField === 'segmentationStatus' && (
                      <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </DropdownMenuItem>
              </>
            )}
            
            {onClearCache && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onClearCache}>
                  <div className="flex items-center w-full">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mr-2 h-4 w-4"
                    >
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                    <span>{t('projectToolbar.clearCache') || 'Clear Cache'}</span>
                  </div>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* View mode buttons */}
        <div className="flex items-center h-9 border rounded-md bg-background">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            className="h-9 px-2.5 rounded-r-none"
            onClick={() => setViewMode('grid')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-grid-2x2"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M3 12h18" />
              <path d="M12 3v18" />
            </svg>
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            className="h-9 px-2.5 rounded-l-none"
            onClick={() => setViewMode('list')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-list"
            >
              <line x1="8" x2="21" y1="6" y2="6" />
              <line x1="8" x2="21" y1="12" y2="12" />
              <line x1="8" x2="21" y1="18" y2="18" />
              <line x1="3" x2="3.01" y1="6" y2="6" />
              <line x1="3" x2="3.01" y1="12" y2="12" />
              <line x1="3" x2="3.01" y1="18" y2="18" />
            </svg>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProjectToolbar;
