import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import DuplicationTasksList from '../project/DuplicationTasksList';

interface DuplicationTasksWidgetProps {
  className?: string;
}

const DuplicationTasksWidget: React.FC<DuplicationTasksWidgetProps> = ({ className }) => {
  const { t } = useLanguage();

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium">{t('projects.duplicateProgress') || 'Duplication Tasks'}</CardTitle>
      </CardHeader>
      <CardContent>
        <DuplicationTasksList showActiveOnly={false} maxTasks={3} refreshInterval={5000} />
      </CardContent>
    </Card>
  );
};

export default DuplicationTasksWidget;
