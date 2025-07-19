import { Grid2X2, List as ListIcon } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from './ui/button';



interface DashboardActionsProps {
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
  onSort?: (field: string, direction: 'asc' | 'desc') => void;
  sortOptions?: Array<{ field: string; label: string }>;
}

const DashboardActions = ({ viewMode, setViewMode, onSort: _onSort, sortOptions: _sortOptions = [] }: DashboardActionsProps) => {
  const { t } = useLanguage();

  return (
    <div className="flex items-center space-x-2">
      <div className="flex items-center h-9 border rounded-md bg-background">
        <Button
          variant={viewMode === 'grid' ? 'default' : 'ghost'}
          size="sm"
          className="h-9 px-2.5 rounded-r-none"
          onClick={() => setViewMode('grid')}
        >
          <Grid2X2 className="h-4 w-4" />
        </Button>
        <Button
          variant={viewMode === 'list' ? 'default' : 'ghost'}
          size="sm"
          className="h-9 px-2.5 rounded-l-none"
          onClick={() => setViewMode('list')}
        >
          <ListIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default DashboardActions;
